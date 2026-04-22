"use server";

import { createAdminClient } from "@/lib/supabase/server";

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

interface NutritionInfo {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
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
    // 1. Fetch og:image from source page (non-blocking — failure is OK)
    const ogImage = await fetchOgImage(url);

    // 2. Fetch markdown content via Jina reader
    const jinaResult = await fetchJinaMarkdown(url);
    if (!jinaResult.ok) {
      return { ok: false, error: `Jina fetch failed: ${jinaResult.error}` };
    }

    // 3. Get ingredient catalog for context (top 200 canonical IDs)
    const catalog = await fetchCatalogContext();

    // 4. Call Groq to extract structured recipe
    const extracted = await callGroqExtractor(url, jinaResult.markdown, catalog);

    return { ok: true, data: { ...extracted, source_image_url: ogImage, source_url: url } };
  } catch (e) {
    console.error("[B1 extractRecipe]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Extraction failed. Try again or fill manually.",
    };
  }
}

// ─── Step 1: og:image ─────────────────────────────────────────────────────────

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 GharOS-Admin/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ─── Step 2: Jina reader ──────────────────────────────────────────────────────

type JinaResult = { ok: true; markdown: string } | { ok: false; error: string };

async function fetchJinaMarkdown(url: string): Promise<JinaResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers: Record<string, string> = {
    "Accept": "text/markdown",
    "X-Return-Format": "markdown",
    "X-Remove-Selector": "header,footer,nav,.ads,.comments",
  };
  // Only send Authorization header if API key is actually set (empty Bearer is rejected)
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
    const text = await res.text();
    if (!text || text.trim().length < 200) {
      return { ok: false, error: "Jina returned empty / too-little content (page may be blocked or JS-rendered)." };
    }
    // Trim to ~12000 chars to stay well within token budget
    return { ok: true, markdown: text.slice(0, 12000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Network error — ${msg}` };
  }
}

// ─── Step 3: Catalog context ──────────────────────────────────────────────────

async function fetchCatalogContext(): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ingredient_catalog")
      .select("canonical_id, aliases, category")
      .limit(200);
    if (!data || data.length === 0) return "";
    const lines = (data as { canonical_id: string; aliases: string[]; category: string }[]).map(
      r => `${r.canonical_id} (${(r.aliases ?? []).slice(0, 3).join(", ")})`
    );
    return `Known canonical ingredient IDs:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// ─── Step 4: Groq extraction ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Agent B1, an Indian recipe extractor for the GharOS meal-planning app.
Your single most important rule: FIDELITY. Extract what the recipe actually says — do not normalize, invent, or paraphrase quantities.

══════════════════════════════════════════════════════════════════════════════
FIDELITY RULES (most important — violations = corrupted data)
══════════════════════════════════════════════════════════════════════════════

1. RAW TEXT ALWAYS:
   Every ingredient MUST include a "raw_text" field with the ingredient line copied verbatim
   from the recipe, BEFORE any normalization. Example: "¾ tsp ginger garlic paste"
   If you can't find an exact line for an ingredient, DO NOT INCLUDE that ingredient.

2. NEVER SPLIT COMPOUND INGREDIENTS:
   If the recipe says "ginger garlic paste", "ginger-garlic paste", "GG paste", or
   "½ tsp ginger & garlic paste" → output ONE entry with canonical_id "ginger_garlic_paste".
   DO NOT split into separate "ginger" + "garlic" entries.
   Same rule for: "tomato puree", "onion-tomato masala", "curd chilli paste", etc.

3. PRESERVE QUANTITIES EXACTLY:
   - "¾ tsp" → quantity: 0.75, unit: "teaspoon"
   - "½ cup" → quantity: 0.5, unit: "cup"
   - "1½ tbsp" → quantity: 1.5, unit: "tablespoon"
   - "1-2 tsp" → quantity: 1, unit: "teaspoon", notes: "1 to 2 tsp"
   - "to taste" / "as needed" / "as required" → quantity: null, unit: "to_taste"
   - "a pinch" → quantity: null, unit: "pinch"
   - "handful" → quantity: 1, unit: "handful"
   NEVER round fractions up. NEVER invent a quantity if the recipe doesn't state one.

4. PRESERVE UNITS AS WRITTEN:
   Use the recipe's own unit (tsp → teaspoon, tbsp → tablespoon, g → grams, ml → millilitres,
   cup, whole, inch, leaves, sprig, pod, pinch). Never convert cups↔grams or tsp↔ml.

5. NEVER HALLUCINATE:
   If an ingredient is not in the recipe, omit it. Do not add "salt to taste" unless the
   recipe mentions salt. Do not add "oil" unless the recipe says so.

══════════════════════════════════════════════════════════════════════════════
OPTIONAL INGREDIENT DETECTION (is_optional: true when ANY of these apply)
══════════════════════════════════════════════════════════════════════════════

Set is_optional: true if ANY of these are present in the raw line or its surrounding context:
  • The word "optional" or "(optional)" appears in or next to the ingredient line
  • Listed under a heading/section called "Optional", "Optional ingredients", or "For garnish"
  • Phrased as "or skip if…", "if available", "if you like", "if desired", "as needed for garnish"
  • Appears after an "or" showing an alternative (mark the alternative as optional)
  • Used only "for garnish", "to garnish", "to serve", "to sprinkle on top"
  • Described as a substitute ("can be replaced with…")
  • Phrased as "you may add", "you can add"

Otherwise is_optional: false. When in doubt, set is_optional: true and add reason to "notes".

══════════════════════════════════════════════════════════════════════════════
FORMAT RULES
══════════════════════════════════════════════════════════════════════════════

- Return ONLY valid JSON — no markdown fences, no explanation
- canonical_name: lowercase, underscores, unique (e.g. "palak_paneer", "dal_tadka")
- canonical_id: match provided catalog IDs where possible; else create snake_case id
  (compound pastes → "ginger_garlic_paste", "tomato_puree", etc.)
- dish_role: hero | side | staple | condiment | snack
- dish_type: gravy | dry_sabzi | dal | rice | roti | chutney | raita | biryani | salad | bread | sweet | snack
- cuisine / region: north_indian | south_indian | east_indian | west_indian | pan_indian | continental | other
- meal_types: array of breakfast | lunch | dinner | snack | dessert
- diet_tags: array of vegetarian | vegan | jain | non_vegetarian | eggetarian
- prep_components: makeable-ahead sub-tasks with storage_options and default_location
- steps: grouped as {heading, steps: string[]} by phase (Prep, Cooking, Assembly, Serving)
- nutrition: per serving {calories, protein_g, carbs_g, fat_g, fiber_g}
- pairs_well_with: 2–4 recipe canonical_names
- key_ingredients: 3–5 defining ingredient canonical_ids
- Unknown scalar → null; unknown array → []`;

async function callGroqExtractor(
  url: string,
  markdown: string,
  catalogContext: string
): Promise<ExtractedRecipe> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const sourceHost = new URL(url).hostname.replace("www.", "");

  const userMessage = `Extract this recipe from ${sourceHost} and return structured JSON.
Remember: FIDELITY FIRST. Copy the raw line into "raw_text" for every ingredient.
NEVER split compound pastes (ginger-garlic paste stays as ONE ingredient).
Flag optional ingredients accurately (check for "optional", "for garnish", "if desired").

${catalogContext ? catalogContext + "\n\n" : ""}---RECIPE CONTENT---
${markdown}
---END CONTENT---

Return JSON matching this exact schema. Study the ingredient examples carefully:
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
  "pairs_well_with": ["canonical_name"],
  "key_ingredients": ["canonical_id"],
  "ingredients": [
    { "canonical_id": "paneer", "display_name": "Paneer", "quantity": 200, "unit": "grams", "is_optional": false, "group": "main", "notes": "", "raw_text": "200 grams paneer, cubed" },
    { "canonical_id": "ginger_garlic_paste", "display_name": "Ginger Garlic Paste", "quantity": 0.75, "unit": "teaspoon", "is_optional": false, "group": "main", "notes": "", "raw_text": "¾ tsp ginger garlic paste" },
    { "canonical_id": "kasuri_methi", "display_name": "Kasuri Methi", "quantity": 1, "unit": "teaspoon", "is_optional": true, "group": "garnish", "notes": "for garnish", "raw_text": "1 tsp kasuri methi (optional, for garnish)" },
    { "canonical_id": "salt", "display_name": "Salt", "quantity": null, "unit": "to_taste", "is_optional": false, "group": "main", "notes": "", "raw_text": "salt as required" }
  ],
  "steps": [{"heading":"Preparation","steps":["step 1","step 2"]}],
  "prep_components": [{"id":"","task":"","time_minutes":0,"storage_options":[{"location":"refrigerator","shelf_life_days":2}],"default_location":"refrigerator","portion_note":""}],
  "tips": ["string"],
  "faqs": [{"q":"","a":""}],
  "notes": ["string"],
  "nutrition": {"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0}
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.05,       // lower temp for fidelity — reduce creative rephrasing
      max_tokens: 6144,        // bumped for raw_text per ingredient
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");

  let parsed: ExtractedRecipe;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq returned invalid JSON. Try again.");
  }

  // Ensure arrays are arrays (defensive)
  const ensureArr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    ...parsed,
    meal_types:        ensureArr(parsed.meal_types),
    diet_tags:         ensureArr(parsed.diet_tags),
    pairs_well_with:   ensureArr(parsed.pairs_well_with),
    key_ingredients:   ensureArr(parsed.key_ingredients),
    ingredients:       ensureArr(parsed.ingredients),
    steps:             ensureArr(parsed.steps),
    prep_components:   ensureArr(parsed.prep_components),
    tips:              ensureArr(parsed.tips),
    faqs:              ensureArr(parsed.faqs),
    notes:             ensureArr(parsed.notes),
    source_image_url:  null, // populated by caller
    source_url:        url,  // populated by caller
  };
}
