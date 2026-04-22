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
  quantity: number;
  unit: string;
  is_optional: boolean;
  group: string;
  notes: string;
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
    // 1. Fetch og:image from source page
    const ogImage = await fetchOgImage(url);

    // 2. Fetch markdown content via Jina reader
    const markdown = await fetchJinaMarkdown(url);
    if (!markdown) {
      return { ok: false, error: "Could not fetch recipe content. Check the URL and try again." };
    }

    // 3. Get ingredient catalog for context (top 100 canonical IDs)
    const catalog = await fetchCatalogContext();

    // 4. Call Groq to extract structured recipe
    const extracted = await callGroqExtractor(url, markdown, catalog);

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

async function fetchJinaMarkdown(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/markdown",
        "X-Return-Format": "markdown",
        "X-Remove-Selector": "header,footer,nav,.ads,.comments",
        "Authorization": `Bearer ${process.env.JINA_API_KEY ?? ""}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Trim to ~12000 chars to stay well within token budget
    return text.slice(0, 12000);
  } catch {
    return null;
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

const SYSTEM_PROMPT = `You are Agent B1, an expert Indian recipe extractor for the GharOS meal-planning app.
Extract structured recipe data from recipe markdown content.

RULES:
- Return ONLY valid JSON — no markdown fences, no explanation text
- canonical_name: lowercase, underscores, unique (e.g. "palak_paneer", "dal_tadka")
- canonical_id for ingredients: match provided catalog IDs where possible; else create snake_case id
- quantity: numeric value only; unit: separate field ("grams", "cups", "tbsp", "whole", "leaves", etc.)
- dish_role: one of hero | side | staple | condiment | snack
- dish_type: one of gravy | dry_sabzi | dal | rice | roti | chutney | raita | biryani | salad | bread | sweet | snack
- cuisine: one of north_indian | south_indian | east_indian | west_indian | pan_indian | continental | other
- region: same enum as cuisine
- meal_types: array, each one of breakfast | lunch | dinner | snack | dessert
- diet_tags: array, each one of vegetarian | vegan | jain | non_vegetarian | eggetarian
- prep_components: extract makeable-ahead sub-tasks (e.g. "blanch spinach", "make tomato base")
  Each has: id (snake_case), task (action phrase), time_minutes, storage_options (array of {location, shelf_life_days}),
  default_location ("refrigerator" | "freezer" | "counter"), portion_note
- steps: array of {heading, steps: string[]} — group by phase (Prep, Cooking, Assembly, Serving)
- nutrition: per serving, with keys calories, protein_g, carbs_g, fat_g, fiber_g (all numbers)
- pairs_well_with: 2–4 recipe canonical_names that pair well as sides or mains
- key_ingredients: 3–5 defining ingredient canonical_ids
- If a field is unknown, use null for scalars and [] for arrays`;

async function callGroqExtractor(
  url: string,
  markdown: string,
  catalogContext: string
): Promise<ExtractedRecipe> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const sourceHost = new URL(url).hostname.replace("www.", "");

  const userMessage = `Extract this recipe from ${sourceHost} and return structured JSON.

${catalogContext ? catalogContext + "\n\n" : ""}---RECIPE CONTENT---
${markdown}
---END CONTENT---

Return JSON matching this exact schema:
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
  "ingredients": [{"canonical_id":"","display_name":"","quantity":0,"unit":"","is_optional":false,"group":"main","notes":""}],
  "steps": [{"heading":"","steps":[]}],
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
      temperature: 0.1,
      max_tokens: 4096,
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
