"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { normaliseRecipeEnums } from "@/lib/recipe-enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedRecipe {
  canonical_name: string;
  display_name: string;
  description: string;
  cuisine: string;
  region: string;
  dish_role: string;
  dish_type: string;
  meal_types: string[];
  diet_tags: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  base_servings: number;
  source_url: string;
  source_name: string;
  source_author: string;
  pairs_well_with: string[];
  key_ingredients: string[];
  ingredients: IngredientItem[];
  steps: StepGroup[];
  prep_components: PrepComponent[];
  tips: string[];
  faqs: FAQ[];
  notes: string[];
  nutrition: NutritionInfo | null;
  source_image_url: string | null;  // og:image from source page
  video_url: string | null;         // YouTube/Vimeo link if found on page
}

interface IngredientItem {
  canonical_id: string;
  display_name: string;
  quantity: number | null;
  unit: string;
  is_optional: boolean;
  group: string;
  notes: string;
  raw_text: string;   // VERBATIM line from the recipe — for fidelity auditing
}

interface StepGroup {
  heading: string;
  steps: string[];
}

interface PrepComponent {
  id: string;
  task: string;
  time_minutes: number;
  storage_options: { location: string; shelf_life_days: number }[];
  default_location: string;
  portion_note: string;
}

interface FAQ {
  q: string;
  a: string;
}

/**
 * Nutrition is intentionally flexible: recipe sites publish different subsets
 * (some have sodium, some have sugar, some only calories). Store what the
 * page shows — verbatim — and nothing more.
 */
interface NutritionInfo {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  saturated_fat_g?: number | null;
  trans_fat_g?: number | null;
  polyunsaturated_fat_g?: number | null;
  monounsaturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  sodium_mg?: number | null;
  potassium_mg?: number | null;
  sugar_g?: number | null;
  vitamin_a_iu?: number | null;
  vitamin_c_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  serving_note?: string;
  raw_text?: string;
}

export type ExtractionResult =
  | { ok: true; data: ExtractedRecipe }
  | { ok: false; error: string };

// ─── Main action ──────────────────────────────────────────────────────────────

export async function extractRecipe(url: string): Promise<ExtractionResult> {
  if (!url || !url.startsWith("http")) {
    return { ok: false, error: "Please enter a valid URL starting with http." };
  }

  try {
    // 1. Fetch og:image + video_url in one HTML pass
    const media = await fetchMedia(url);

    // 2. Fetch markdown content via Jina reader
    const jinaResult = await fetchJinaMarkdown(url);
    if (!jinaResult.ok) {
      return { ok: false, error: `Jina fetch failed: ${jinaResult.error}` };
    }

    // 3. Get ingredient catalog for context (top 200 canonical IDs)
    const catalog = await fetchCatalogContext();

    // 4. Call Groq to extract structured recipe
    const extracted = await callGroqExtractor(url, jinaResult.markdown, catalog);

    // 5. Prefer programmatic video_url from HTML scan (more reliable);
    //    fall back to whatever the LLM may have pulled from markdown.
    const finalVideoUrl = media.videoUrl ?? extracted.video_url ?? null;

    // 6. Deterministic timing fallback — regex against the FULL (un-trimmed) markdown.
    //    The recipe-card metadata often lives near the bottom of the page, past the
    //    9k-char truncation, so the LLM can't always see it.
    const regexTimings = extractTimings(jinaResult.rawMarkdown);
    const prep_time_minutes  = extracted.prep_time_minutes  ?? regexTimings.prep_time_minutes;
    const cook_time_minutes  = extracted.cook_time_minutes  ?? regexTimings.cook_time_minutes;
    const total_time_minutes = extracted.total_time_minutes ?? regexTimings.total_time_minutes
      ?? ((prep_time_minutes && cook_time_minutes) ? prep_time_minutes + cook_time_minutes : null);

    // 7. Deterministic nutrition fallback — same reason, same solution. WPRM/Tasty Recipes
    //    emit a standardised nutrition block we can reliably parse with regex.
    //    Merge strategy: prefer LLM value per field; fill gaps from regex.
    const regexNutrition = extractNutrition(jinaResult.rawMarkdown);
    const nutrition = mergeNutrition(extracted.nutrition, regexNutrition);

    return {
      ok: true,
      data: {
        ...extracted,
        prep_time_minutes,
        cook_time_minutes,
        total_time_minutes,
        nutrition,
        source_image_url: media.ogImage,
        source_url: url,
        video_url: finalVideoUrl,
      },
    };
  } catch (e) {
    console.error("[B1 extractRecipe]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Extraction failed. Try again or fill manually.",
    };
  }
}

// ─── Step 1: og:image + video scan ────────────────────────────────────────────

async function fetchMedia(url: string): Promise<{ ogImage: string | null; videoUrl: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 GharOS-Admin/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // og:image
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogMatch?.[1] ?? null;

    // YouTube video — scan for iframe embed, watch URL, youtu.be, og:video
    const videoUrl = extractYouTubeUrl(html);

    return { ogImage, videoUrl };
  } catch {
    return { ogImage: null, videoUrl: null };
  }
}

function extractYouTubeUrl(html: string): string | null {
  // Normalise YouTube URL candidates found in HTML
  // Priority: explicit og:video / twitter:player → iframe src → anchor href → bare URL
  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i,
    /<iframe[^>]+src=["']([^"']*youtube(?:-nocookie)?\.com\/embed\/[^"']+)["']/i,
    /<iframe[^>]+src=["']([^"']*youtu\.be\/[^"']+)["']/i,
    /<a[^>]+href=["'](https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[^"']+)["']/i,
    /<a[^>]+href=["'](https?:\/\/youtu\.be\/[^"']+)["']/i,
    /(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_\-]{6,})/i,
    /(https?:\/\/youtu\.be\/[A-Za-z0-9_\-]{6,})/i,
    /(https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_\-]{6,})/i,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) {
      return normaliseYouTubeUrl(match[1]);
    }
  }
  return null;
}

/** Convert any YouTube URL variant → canonical youtube.com/watch?v=ID form. */
function normaliseYouTubeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // youtu.be/ID
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    // youtube.com/embed/ID or -nocookie variant
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.replace("/embed/", "").split("/")[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    // Already a watch URL — preserve video id only (drop tracking params)
    if (u.searchParams.has("v")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

// ─── Step 2: Jina reader ──────────────────────────────────────────────────────

type JinaResult = { ok: true; markdown: string; rawMarkdown: string } | { ok: false; error: string };

async function fetchJinaMarkdown(url: string): Promise<JinaResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers: Record<string, string> = {
    "Accept": "text/markdown",
    "X-Return-Format": "markdown",
    "X-Remove-Selector": "header,footer,nav,.ads,.comments",
  };
  const jinaKey = process.env.JINA_API_KEY;
  if (jinaKey) headers.Authorization = `Bearer ${jinaKey}`;

  try {
    const res = await fetch(jinaUrl, {
      headers,
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Jina ${res.status} ${res.statusText}${body ? " — " + body.slice(0, 150) : ""}` };
    }
    const raw = await res.text();
    if (!raw || raw.trim().length < 200) {
      return { ok: false, error: "Jina returned empty / too-little content (page may be blocked or JS-rendered)." };
    }
    // Slim the markdown — recipe sites are ~60% boilerplate (ads, related posts, social links).
    // Removing noise gets us more useful recipe content under the same token budget.
    const cleaned = cleanMarkdown(raw);
    // Cap the LLM-bound copy at 9000 chars (~2250 tokens) to stay under Groq's 12k TPM.
    // Keep the full rawMarkdown around for deterministic regex fallbacks (timings, video_url).
    return { ok: true, markdown: cleaned.slice(0, 9000), rawMarkdown: raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Network error — ${msg}` };
  }
}

/**
 * Deterministic timing extraction from the markdown.
 * Covers common recipe-card formats used by Indian food blogs:
 *   "Prep Time: 15 minutes" / "Prep Time — 15 mins" / "Preparation 15 min"
 *   "Cook Time 20 mins" / "Cooking Time: 20 minutes"
 *   "Total Time 35 mins" / "Ready in 1 hour 15 minutes"
 * Used as a fallback when the LLM misses these fields.
 */
function extractTimings(md: string): {
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
} {
  const parseDuration = (raw: string): number | null => {
    const s = raw.toLowerCase();
    // "1 hour 15 minutes" / "1h 15m" / "1:15"
    const hm = s.match(/(\d+)\s*(?:h|hr|hour|hours)\s*(\d+)\s*(?:m|min|minute|minutes)?/);
    if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
    const colon = s.match(/(\d+):(\d{2})\b/);
    if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
    const hOnly = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours)\b/);
    if (hOnly) return Math.round(parseFloat(hOnly[1]) * 60);
    const mOnly = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
    if (mOnly) return parseInt(mOnly[1]);
    // Bare number assumed to be minutes
    const bare = s.match(/\b(\d+)\b/);
    if (bare) return parseInt(bare[1]);
    return null;
  };

  const findField = (...labels: string[]): number | null => {
    for (const label of labels) {
      const re = new RegExp(`${label}\\s*[:\\-–—]?\\s*([^\\n|·•]{1,40})`, "i");
      const m = md.match(re);
      if (m) {
        const parsed = parseDuration(m[1]);
        if (parsed && parsed > 0 && parsed < 24 * 60) return parsed;
      }
    }
    return null;
  };

  const prep  = findField("prep\\s*time", "preparation\\s*time", "preparation");
  const cook  = findField("cook\\s*time", "cooking\\s*time", "cook");
  let total   = findField("total\\s*time", "ready\\s*in", "total");

  if (!total && prep && cook) total = prep + cook;

  return { prep_time_minutes: prep, cook_time_minutes: cook, total_time_minutes: total };
}

/**
 * Deterministic nutrition extraction.
 * WordPress Recipe Maker / Tasty Recipes / ZipList output nutrition in patterns like:
 *   "Calories: 320kcal"  /  "Calories 320"  /  "320 calories"
 *   "Protein: 18g"       /  "Protein 18 grams"
 *   "Carbohydrates: 12g" /  "Total Carbs 12g"
 *   "Fat: 22g"           /  "Saturated Fat: 11g"
 *   "Fiber: 4g"          /  "Sugar: 5g"
 *   "Sodium: 480mg"      /  "Cholesterol: 45mg"
 *   "Vitamin C: 12mg"    /  "Calcium: 220mg"  /  "Iron: 2mg"
 * Ignores per-100g blocks unless that's all the page has (copied into serving_note).
 * Used as a fallback when the LLM misses nutrition fields.
 */
function extractNutrition(md: string): NutritionInfo | null {
  // Find the "Nutrition" / "Nutrition Information" / "Nutrition Facts" section first,
  // then run all numeric pulls against that slice — avoids false positives elsewhere.
  const sectionMatch = md.match(
    /(?:^|\n)#{0,6}\s*Nutrition(?:\s+(?:Information|Facts|Info|Values|per serving))?\b[^\n]*\n([\s\S]{0,2000})/i
  );
  // If we find a section header, use the next ~2k chars; else use the whole page.
  const scope = sectionMatch ? sectionMatch[1] : md;

  const pickNumber = (pattern: RegExp): number | null => {
    const m = scope.match(pattern);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // Label + ":" (optional) + number + unit (optional)
  // Label can come before OR after the number ("320 calories" / "Calories 320").
  const labelFirst = (label: string, unit?: string) =>
    new RegExp(
      `\\b${label}\\s*[:\\-–—]?\\s*(\\d+(?:[.,]\\d+)?)${unit ? `\\s*${unit}` : ""}`,
      "i"
    );
  const numberFirst = (label: string, unit?: string) =>
    new RegExp(
      `(\\d+(?:[.,]\\d+)?)${unit ? `\\s*${unit}` : ""}\\s*${label}`,
      "i"
    );

  const find = (labels: string[], unit?: string) => {
    for (const label of labels) {
      const n = pickNumber(labelFirst(label, unit)) ?? pickNumber(numberFirst(label, unit));
      if (n !== null) return n;
    }
    return null;
  };

  const nutrition: NutritionInfo = {};

  const calories               = find(["calories", "energy", "kcal"], "(?:kcal|calories|cal)?");
  const protein_g              = find(["protein"], "g(?:rams?)?");
  const carbs_g                = find(["carbohydrates", "carbs", "total\\s*carbs", "carbohydrate"], "g(?:rams?)?");
  const fat_g                  = find(["total\\s*fat", "\\bfat\\b"], "g(?:rams?)?");
  const saturated_fat_g        = find(["saturated\\s*fat", "sat\\.?\\s*fat", "saturates?"], "g(?:rams?)?");
  const trans_fat_g            = find(["trans\\s*fat"], "g(?:rams?)?");
  const polyunsaturated_fat_g  = find(["polyunsaturated\\s*fat"], "g(?:rams?)?");
  const monounsaturated_fat_g  = find(["monounsaturated\\s*fat"], "g(?:rams?)?");
  const fiber_g                = find(["fiber", "fibre", "dietary\\s*fiber", "dietary\\s*fibre"], "g(?:rams?)?");
  const sugar_g                = find(["sugar", "sugars", "total\\s*sugars?"], "g(?:rams?)?");
  const sodium_mg              = find(["sodium"], "mg");
  const cholesterol_mg         = find(["cholesterol"], "mg");
  const potassium_mg           = find(["potassium"], "mg");
  const vitamin_a_iu           = find(["vitamin\\s*a"], "(?:iu|i\\.u\\.)");
  const vitamin_c_mg           = find(["vitamin\\s*c"], "mg");
  const calcium_mg             = find(["calcium"], "mg");
  const iron_mg                = find(["iron"], "mg");

  if (calories              !== null) nutrition.calories = calories;
  if (protein_g             !== null) nutrition.protein_g = protein_g;
  if (carbs_g               !== null) nutrition.carbs_g = carbs_g;
  if (fat_g                 !== null) nutrition.fat_g = fat_g;
  if (saturated_fat_g       !== null) nutrition.saturated_fat_g = saturated_fat_g;
  if (trans_fat_g           !== null) nutrition.trans_fat_g = trans_fat_g;
  if (polyunsaturated_fat_g !== null) nutrition.polyunsaturated_fat_g = polyunsaturated_fat_g;
  if (monounsaturated_fat_g !== null) nutrition.monounsaturated_fat_g = monounsaturated_fat_g;
  if (fiber_g               !== null) nutrition.fiber_g = fiber_g;
  if (sugar_g               !== null) nutrition.sugar_g = sugar_g;
  if (sodium_mg             !== null) nutrition.sodium_mg = sodium_mg;
  if (cholesterol_mg        !== null) nutrition.cholesterol_mg = cholesterol_mg;
  if (potassium_mg          !== null) nutrition.potassium_mg = potassium_mg;
  if (vitamin_a_iu          !== null) nutrition.vitamin_a_iu = vitamin_a_iu;
  if (vitamin_c_mg          !== null) nutrition.vitamin_c_mg = vitamin_c_mg;
  if (calcium_mg            !== null) nutrition.calcium_mg = calcium_mg;
  if (iron_mg               !== null) nutrition.iron_mg = iron_mg;

  // Only return an object if we actually found something
  if (Object.keys(nutrition).length === 0) return null;

  // Detect serving basis
  const servingNote = (scope.match(/\bper\s+(serving|100\s*g|100\s*grams|plate|cup|portion)\b/i)?.[0])
    ?? "per serving";
  nutrition.serving_note = servingNote.toLowerCase();

  // Preserve the raw nutrition block for auditability (~400 chars max)
  nutrition.raw_text = scope.replace(/\s+/g, " ").trim().slice(0, 400);

  return nutrition;
}

/**
 * Merge LLM-extracted nutrition with regex-extracted nutrition.
 * Per-field preference: LLM value wins if present; regex fills in the gaps.
 * Returns null only if BOTH sources are empty.
 */
function mergeNutrition(
  llm: NutritionInfo | null | undefined,
  regex: NutritionInfo | null
): NutritionInfo | null {
  if (!llm && !regex) return null;
  if (!llm) return regex;
  if (!regex) return llm;

  const merged: NutritionInfo = { ...regex, ...llm };

  // If LLM didn't supply raw_text or serving_note, use the regex ones
  merged.serving_note = llm.serving_note ?? regex.serving_note;
  merged.raw_text     = llm.raw_text     ?? regex.raw_text;

  return merged;
}

/** Strip recipe-site boilerplate so the token budget gets spent on actual recipe content. */
function cleanMarkdown(md: string): string {
  return md
    // Drop the Jina header block before the actual content starts
    .replace(/^Title:.*?\n(URL Source:.*?\n)?(Published Time:.*?\n)?(Markdown Content:\n)?/is, "")
    // Remove image markdown: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // Collapse link markdown [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove bare URLs
    .replace(/https?:\/\/[^\s)]+/g, "")
    // Drop common boilerplate sections (case-insensitive, up to the next heading)
    .replace(/#+\s*(Related|You may also like|More recipes|Recommended|Share this|Follow us|Subscribe|Comments|Leave a comment|Reader interactions|Primary sidebar)[\s\S]*?(?=\n#|\n\s*$)/gi, "")
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    // Strip trailing whitespace on every line
    .replace(/[ \t]+$/gm, "")
    .trim();
}

// ─── Step 3: Catalog context ──────────────────────────────────────────────────

async function fetchCatalogContext(): Promise<string> {
  try {
    const supabase = createAdminClient();
    // Only the most-common 60 ingredients — enough to anchor canonical_id choices
    // without blowing the TPM budget. Curator can fix mismatches on review.
    const { data } = await supabase
      .from("ingredient_catalog")
      .select("canonical_id")
      .order("is_staple", { ascending: false })
      .limit(60);
    if (!data || data.length === 0) return "";
    const ids = (data as { canonical_id: string }[]).map(r => r.canonical_id).join(", ");
    return `Prefer these canonical_ids where they match: ${ids}`;
  } catch {
    return "";
  }
}

// ─── Step 4: Groq extraction ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Agent B1, an Indian recipe extractor for the GharOS meal-planning app.
Your job is ARCHIVAL, not editorial. You are a transcription machine, not a summariser.

══════════════════════════════════════════════════════════════════════════════
TWO ABSOLUTE LAWS
══════════════════════════════════════════════════════════════════════════════

LAW 1 — FIDELITY: Copy what the recipe says, word for word where possible.
        Never normalise, round, estimate, or invent. If the page doesn't state
        something, leave it null or omit the key. Never fill gaps from general
        knowledge of Indian cooking.

LAW 2 — COMPLETENESS: Extract EVERY item the page shows.
        If the page lists 9 tips, return 9 tips.
        If the page lists 7 FAQs, return 7 FAQs.
        If the page has 5 step sections (Prep, Gravy, Paneer prep, Assembly,
        Serving), return 5 step groups.
        Under no circumstances sample, condense, or pick "the important ones".
        A missing item is a bug, not a style choice.

══════════════════════════════════════════════════════════════════════════════
FIDELITY RULES (detail)
══════════════════════════════════════════════════════════════════════════════

1. RAW TEXT ALWAYS:
   Every ingredient MUST include "raw_text" — the ingredient line copied verbatim.
   Example: "¾ tsp ginger garlic paste"

2. NEVER SPLIT COMPOUND INGREDIENTS:
   "ginger garlic paste", "ginger-garlic paste", "GG paste", "½ tsp ginger & garlic paste"
   → ONE entry with canonical_id "ginger_garlic_paste".
   Same for: tomato puree, onion-tomato masala, curd chilli paste, etc.

3. PRESERVE QUANTITIES EXACTLY:
   - "¾ tsp" → quantity: 0.75, unit: "teaspoon"
   - "½ cup" → quantity: 0.5, unit: "cup"
   - "1½ tbsp" → quantity: 1.5, unit: "tablespoon"
   - "1-2 tsp" → quantity: 1, unit: "teaspoon", notes: "1 to 2 tsp"
   - "to taste" → quantity: null, unit: "to_taste"
   - "a pinch" → quantity: null, unit: "pinch"
   NEVER round. NEVER invent.

4. PRESERVE UNITS AS WRITTEN:
   Use the recipe's own unit (tsp/teaspoon, tbsp/tablespoon, g/grams, ml/millilitres,
   cup, whole, inch, leaves, sprig, pod, pinch). Never convert between units.

5. NEVER HALLUCINATE INGREDIENTS:
   Do not add "salt to taste" unless the page says so. Do not add "oil" or "water"
   unless they appear in the ingredient list.

6. NUTRITION FIDELITY:
   - If the page has NO nutrition block → nutrition: null. DO NOT estimate.
   - If the page HAS nutrition → copy every number verbatim. Include ONLY the keys
     the page actually shows. Omit others (don't invent).
   - Set "serving_note" to the exact phrasing ("per serving", "per 100g", etc.)
   - Copy the entire nutrition block verbatim into "raw_text".

══════════════════════════════════════════════════════════════════════════════
COMPLETENESS RULES (detail — do this carefully)
══════════════════════════════════════════════════════════════════════════════

TIMING (prep_time_minutes / cook_time_minutes / total_time_minutes):
  MANDATORY when the page shows them. Most recipe sites have a metadata block
  near the top OR in the recipe card at the bottom with labels like:
    • "Prep Time: 15 minutes" / "Prep Time — 15 mins" / "Preparation 15 min"
    • "Cook Time: 20 minutes" / "Cooking Time 20 mins"
    • "Total Time: 35 minutes" / "Ready in 35 mins"
  Convert HH:MM or "1 hour 15 minutes" into integer minutes (e.g. 75).
  If the page has only "Total Time" → populate total_time_minutes, leave prep/cook null.
  If the page has prep + cook but no total → compute total_time_minutes = prep + cook.
  If the page has NO timing info at all → all three null.

STEPS:
  A full recipe typically has MULTIPLE phases. For a dish like palak paneer, a
  complete steps array should include SEPARATE groups such as:
    1. "Preparation" or "Prep work"  — blanching spinach, prepping paneer, etc.
    2. "Making the gravy / base"     — onion-tomato-cashew masala
    3. "Making the main dish"        — combining gravy + spinach puree
    4. "Adding paneer / final cook"  — tempering, kasuri methi, cream, paneer
    5. "Serving" / "How to serve"    — garnish + pairing suggestions

  Walk through the recipe page section by section. Copy the HEADING verbatim from
  the page (don't invent headings like "Preparation" if the page says "Prep Work").
  Each step within a group must be a single action. Do not merge two steps into one.

  If the page has 18 numbered steps total across 4 sections → return 4 groups whose
  steps arrays together contain all 18 items. Never truncate.

TIPS & NOTES:
  Extract EVERY tip paragraph/bullet under the "Tips", "Pro Tips", "Expert Tips",
  "Notes", "Substitutions", or similar sections. Keep each as a separate string.
  Copy the tip text verbatim (light cleanup of surrounding whitespace only).
  If the page has 12 tips, tips[] must have length 12.

FAQs:
  Extract every Q&A pair under "FAQs", "Frequently Asked Questions", "People also
  ask", or similar. If the page has 8 FAQs, faqs[] must have length 8.
  Copy question and answer verbatim.

NOTES vs TIPS distinction:
  • "tips" = practical cooking advice ("use young tender spinach", "blanch briefly").
  • "notes" = substitutions, scaling, storage, nutrition notes, recipe variations.
  If the page labels a section "Notes", put those in notes[]. If it labels a section
  "Tips", put them in tips[]. If both exist, populate both arrays.

PREP COMPONENTS (make-ahead tasks):
  Identify sub-tasks that can be prepared hours or days ahead of the final cook.
  EVERY prep component MUST include:
    • id: snake_case identifier
    • task: short action phrase (e.g. "Blanch and purée spinach")
    • time_minutes: estimated time for this sub-task
    • storage_options: MANDATORY — array with AT LEAST one {location, shelf_life_days}.
        Typical defaults if the recipe doesn't specify explicitly:
          - Leafy purées (spinach, coriander): fridge 2d, freezer 30d
          - Onion-tomato masala: fridge 3d, freezer 60d
          - Cashew paste: fridge 2d, freezer 30d
          - Boiled potatoes/peas: fridge 3d, freezer 30d
          - Marinated paneer/tofu: fridge 1d (do not freeze)
    • default_location: one of "refrigerator", "freezer", "counter"
    • portion_note: how to divvy up (e.g. "freeze in ice-cube tray, 2 cubes per serving",
      "store in small ziplock pouches for single-batch cooks")

YOUTUBE VIDEO:
  Scan the markdown for any YouTube link (youtube.com/watch, youtu.be, youtube.com/embed).
  If found, set "video_url" to that URL. If not found → video_url: null.

══════════════════════════════════════════════════════════════════════════════
OPTIONAL INGREDIENT DETECTION
══════════════════════════════════════════════════════════════════════════════

Set is_optional: true if ANY of these apply:
  • "optional" or "(optional)" in the line
  • Under a heading called "Optional", "Optional ingredients", "For garnish"
  • "or skip if…", "if available", "if you like", "if desired"
  • After an "or" showing an alternative
  • "for garnish", "to garnish", "to serve", "to sprinkle on top"
  • "can be replaced with…" / "you may add" / "you can add"

Otherwise is_optional: false. When in doubt, set is_optional: true and add reason to "notes".

══════════════════════════════════════════════════════════════════════════════
FORMAT RULES
══════════════════════════════════════════════════════════════════════════════

- Return ONLY valid JSON — no markdown fences, no explanation text
- canonical_name: lowercase_snake_case, unique
- canonical_id: match the provided catalog where possible; else snake_case
- dish_role: hero | side | staple | condiment | snack
- dish_type: gravy | dry_sabzi | dal | rice | roti | chutney | raita | biryani | salad | bread | sweet | snack
- cuisine/region: north_indian | south_indian | east_indian | west_indian | pan_indian | continental | other
- meal_types: breakfast | lunch | dinner | snack | dessert
- diet_tags: vegetarian | vegan | jain | non_vegetarian | eggetarian
- pairs_well_with: 2–4 recipe canonical_names
- key_ingredients: 3–5 defining ingredient canonical_ids
- Unknown scalar → null; unknown array → []

══════════════════════════════════════════════════════════════════════════════
SELF-CHECK BEFORE RETURNING
══════════════════════════════════════════════════════════════════════════════

Before producing your JSON, silently verify:
  ☐ Did I capture prep_time_minutes, cook_time_minutes, total_time_minutes
     if the page shows them anywhere (top metadata OR bottom recipe card)?
  ☐ Did I count the tip items on the page and match that count in tips[]?
  ☐ Did I count the FAQ pairs and match that count in faqs[]?
  ☐ Did I count the notes items and match that count in notes[]?
  ☐ Did I include ALL recipe phases in steps[] (prep, gravy, assembly, serving)?
  ☐ Does every ingredient have a raw_text field?
  ☐ Does every prep_component have a non-empty storage_options array?
  ☐ If the page has a YouTube video, did I capture its URL in video_url?

Only then return the JSON.`;

async function callGroqExtractor(
  url: string,
  markdown: string,
  catalogContext: string
): Promise<ExtractedRecipe> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const sourceHost = new URL(url).hostname.replace("www.", "");

  const userMessage = `Extract this recipe from ${sourceHost} and return structured JSON.

LAWS (reminder):
  1. FIDELITY — copy verbatim, never normalise or invent
  2. COMPLETENESS — capture EVERY tip, FAQ, note, and step phase the page shows

${catalogContext ? catalogContext + "\n\n" : ""}---RECIPE CONTENT---
${markdown}
---END CONTENT---

Return JSON matching this exact schema. Study the ingredient + nutrition + prep_component examples:
{
  "canonical_name": "string",
  "display_name": "string",
  "description": "string",
  "cuisine": "string",
  "region": "string",
  "dish_role": "hero|side|staple|condiment|snack",
  "dish_type": "string",
  "meal_types": ["string"],
  "diet_tags": ["string"],
  "prep_time_minutes": number|null,
  "cook_time_minutes": number|null,
  "total_time_minutes": number|null,
  "base_servings": number,
  "source_name": "string",
  "source_author": "string",
  "video_url": "https://www.youtube.com/watch?v=XXX" or null,
  "pairs_well_with": ["canonical_name"],
  "key_ingredients": ["canonical_id"],
  "ingredients": [
    { "canonical_id": "paneer", "display_name": "Paneer", "quantity": 200, "unit": "grams", "is_optional": false, "group": "main", "notes": "", "raw_text": "200 grams paneer, cubed" },
    { "canonical_id": "ginger_garlic_paste", "display_name": "Ginger Garlic Paste", "quantity": 0.75, "unit": "teaspoon", "is_optional": false, "group": "main", "notes": "", "raw_text": "¾ tsp ginger garlic paste" },
    { "canonical_id": "kasuri_methi", "display_name": "Kasuri Methi", "quantity": 1, "unit": "teaspoon", "is_optional": true, "group": "garnish", "notes": "for garnish", "raw_text": "1 tsp kasuri methi (optional, for garnish)" },
    { "canonical_id": "salt", "display_name": "Salt", "quantity": null, "unit": "to_taste", "is_optional": false, "group": "main", "notes": "", "raw_text": "salt as required" }
  ],
  "steps": [
    {"heading": "Preparation", "steps": ["Wash and blanch the spinach…", "Drain and plunge into ice water…", "Cube the paneer…"]},
    {"heading": "Making the base / gravy", "steps": ["Heat oil + butter…", "Add whole spices…", "Sauté onions…", "Add ginger garlic paste…", "Add tomatoes, cook till mushy…", "Cool and blend with cashews…"]},
    {"heading": "Making palak paneer", "steps": ["Return purée to pan…", "Add spinach purée…", "Simmer 3–4 minutes…", "Add garam masala…", "Add paneer cubes…", "Add kasuri methi + cream…"]},
    {"heading": "Serving", "steps": ["Garnish with cream swirl…", "Serve hot with roti, naan, or jeera rice…"]}
  ],
  "prep_components": [
    {
      "id": "spinach_puree",
      "task": "Blanch and purée spinach",
      "time_minutes": 10,
      "storage_options": [
        {"location": "refrigerator", "shelf_life_days": 2},
        {"location": "freezer",      "shelf_life_days": 30}
      ],
      "default_location": "refrigerator",
      "portion_note": "Freeze in ice-cube tray; 2 cubes per serving"
    },
    {
      "id": "onion_tomato_base",
      "task": "Sauté onion-tomato-cashew base and blend",
      "time_minutes": 20,
      "storage_options": [
        {"location": "refrigerator", "shelf_life_days": 3},
        {"location": "freezer",      "shelf_life_days": 60}
      ],
      "default_location": "refrigerator",
      "portion_note": "Store in small ziplock pouches per single batch"
    }
  ],
  "tips": ["EVERY tip from the page, verbatim, as a separate string"],
  "faqs": [{"q": "EVERY question, verbatim", "a": "EVERY answer, verbatim"}],
  "notes": ["EVERY substitution / storage / scaling / variation note from the page, verbatim"],
  "nutrition": {
    "calories": 320,
    "protein_g": 18,
    "carbs_g": 12,
    "fat_g": 22,
    "saturated_fat_g": 11,
    "fiber_g": 4,
    "sugar_g": 5,
    "sodium_mg": 480,
    "cholesterol_mg": 45,
    "vitamin_c_mg": 12,
    "calcium_mg": 220,
    "iron_mg": 2,
    "serving_note": "per serving",
    "raw_text": "Calories 320kcal · Carbs 12g · Protein 18g · Fat 22g …"
  }
}

REMINDERS:
• NUTRITION: include only keys the page actually shows. If the page has no nutrition, set nutrition: null. Never estimate.
• STEPS: include ALL phases of cooking (prep → base → main dish → serving). Don't stop at "making gravy".
• TIPS / NOTES / FAQs: count them on the page, match the count exactly. Zero tolerance for sampling.
• PREP COMPONENTS: storage_options MUST be a non-empty array. Use sensible defaults if the recipe doesn't spell them out.
• VIDEO: if you see a youtube.com or youtu.be link anywhere in the page content, set video_url to it. Otherwise null.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.05,
      // Groq free tier TPM = 12 000 (input + output combined per minute).
      // Budgeting: system ~1 500 + user ~2 800 + markdown ~2 250 = ~6.5k input.
      // Leave ~5 000 for output (plenty for full steps/tips/FAQs/notes with raw_text).
      max_tokens: 5000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 413 || res.status === 429) {
      // TPM rate limit or payload too large — tell the user to wait a minute
      throw new Error(
        `Groq rate limit hit (${res.status}). Free tier allows 12 000 tokens/min. Wait ~60 seconds and try again, or try a shorter recipe.`
      );
    }
    throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");

  let parsed: ExtractedRecipe;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq returned invalid JSON (possibly truncated — try again).");
  }

  // Defensive array coercion + enforce storage_options on every prep_component
  const ensureArr = (v: unknown) => (Array.isArray(v) ? v : []);
  const prepWithStorage = ensureArr(parsed.prep_components).map((p: PrepComponent) => ({
    ...p,
    storage_options:
      Array.isArray(p.storage_options) && p.storage_options.length > 0
        ? p.storage_options
        : [{ location: "refrigerator", shelf_life_days: 2 }],  // last-resort fallback
    default_location: p.default_location || "refrigerator",
  }));

  return {
    ...parsed,
    meal_types:        ensureArr(parsed.meal_types),
    diet_tags:         ensureArr(parsed.diet_tags),
    pairs_well_with:   ensureArr(parsed.pairs_well_with),
    key_ingredients:   ensureArr(parsed.key_ingredients),
    ingredients:       ensureArr(parsed.ingredients),
    steps:             ensureArr(parsed.steps),
    prep_components:   prepWithStorage,
    tips:              ensureArr(parsed.tips),
    faqs:              ensureArr(parsed.faqs),
    notes:             ensureArr(parsed.notes),
    source_image_url:  null, // populated by caller
    source_url:        url,  // populated by caller
    video_url:         parsed.video_url ?? null,
  };
}

// ─── Save action ──────────────────────────────────────────────────────────────

/**
 * Writes recipes via the service-role admin client, bypassing RLS.
 * Browser-side saves via anon key fail because the recipes RLS policy is
 * "TO service_role" for writes. Server action is the correct pattern.
 */
export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveRecipe(payload: Record<string, unknown>): Promise<SaveResult> {
  try {
    const supabase = createAdminClient();
    const safePayload = normaliseRecipeEnums(payload);
    const { data, error } = await supabase
      .from("recipes")
      .insert(safePayload)
      .select("id")
      .single();

    if (error) {
      const msg = error.message || "Unknown DB error";
      const code = error.code ? ` (code ${error.code})` : "";
      const hint = error.hint ? ` · hint: ${error.hint}` : "";
      const details = error.details ? ` · ${error.details}` : "";
      return { ok: false, error: `${msg}${code}${hint}${details}` };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[saveRecipe]", e);
    const msg = e instanceof Error ? e.message : "Save failed.";
    return { ok: false, error: msg };
  }
}
