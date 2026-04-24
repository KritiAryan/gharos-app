"use server";

// ─── Agent B2 — Prep Planner ─────────────────────────────────────────────────
//
// Post-processes a recipe (already extracted by B1) to:
//   1. Normalise ingredients[].canonical_id against the seeded catalog
//   2. Refine key_ingredients to the 3–5 defining, dish-identifying ingredients
//      (not salt, oil, water, etc.)
//   3. Rewrite prep_components with realistic batch-prep tasks, storage
//      options (refrigerator / freezer), and conservative shelf life.
//
// Does NOT touch: display_name, description, steps, tips, faqs, notes,
// nutrition, video_url, source_*, cuisine, region, etc. B2 is surgical.
//
// Uses Groq llama-3.3-70b-versatile, JSON mode, temperature 0.1.

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { B2_SYSTEM_PROMPT } from "./b2-prompt";

// ─── Types matching the subset of the recipe B2 cares about ────────────────

interface IngredientItem {
  canonical_id: string;
  display_name: string;
  quantity: number | null;
  unit: string;
  is_optional: boolean;
  group: string;
  notes: string;
  raw_text: string;
}

interface StepGroup {
  heading: string;
  steps: string[];
}

interface StorageOption {
  location: "refrigerator" | "freezer";
  shelf_life_days: number;
  container?: string;
}

interface PrepComponent {
  id: string;
  task: string;
  category?: string;                // soak | chop | boil | grind | marinate | cook_base | portion | ferment
  time_minutes: number;
  portion_note: string;
  storage_options: StorageOption[];
  default_location: "refrigerator" | "freezer";
  produced_from_ingredients?: string[]; // canonical_ids
}

interface B2Output {
  key_ingredients: string[];
  ingredients: IngredientItem[];
  prep_components: PrepComponent[];
  notes_for_curator?: string;       // free-text explaining decisions
}

export type B2Result =
  | { ok: true; applied: B2Output; changes: { ingredients_remapped: number; prep_components_count: number; key_ingredients_count: number } }
  | { ok: false; error: string };

// ─── Shelf life defaults (conservative, not invented per-run) ───────────────
//
// Used to validate LLM output: if it gives a shelf life longer than the
// category cap, we clamp to the cap. This keeps the LLM from hallucinating
// 14-day refrigerated ground masala etc.
const SHELF_LIFE_CAP_DAYS: Record<string, { refrigerator: number; freezer: number }> = {
  cook_base:      { refrigerator: 4,  freezer: 60 },   // onion-tomato gravy, dal base
  grind:          { refrigerator: 5,  freezer: 45 },   // ground pastes (ginger-garlic, masala)
  boil:           { refrigerator: 3,  freezer: 30 },   // boiled rajma, chana
  chop:           { refrigerator: 2,  freezer: 30 },   // pre-chopped veg
  marinate:       { refrigerator: 1,  freezer: 7  },   // marinated meat / paneer
  soak:           { refrigerator: 1,  freezer: 1  },   // soaked lentils — use soon
  portion:        { refrigerator: 3,  freezer: 30 },   // pre-portioned components
  ferment:        { refrigerator: 7,  freezer: 14 },   // batter, curd
  default:        { refrigerator: 3,  freezer: 30 },
};

// ─── Main action ────────────────────────────────────────────────────────────

export async function runAgentB2(recipeId: string): Promise<B2Result> {
  try {
    const supabase = createAdminClient();

    // 1. Load recipe
    const { data: recipe, error: loadErr } = await supabase
      .from("recipes")
      .select("canonical_name, display_name, cuisine, dish_role, dish_type, base_servings, ingredients, steps, prep_components, key_ingredients")
      .eq("id", recipeId)
      .single();

    if (loadErr || !recipe) {
      return { ok: false, error: loadErr?.message ?? "Recipe not found." };
    }

    // 2. Load catalog for canonical_id normalisation
    const { data: catalogRaw } = await supabase
      .from("ingredient_catalog")
      .select("canonical_id, display_name, category, aliases")
      .order("canonical_id");
    const catalog = (catalogRaw ?? []) as { canonical_id: string; display_name: string; category: string | null; aliases: string[] | null }[];

    // 3. Call Groq
    const output = await callGroqB2(recipe, catalog);

    // 4. Clamp shelf lives, enforce required fields
    const prepClamped = output.prep_components.map(pc => ({
      ...pc,
      storage_options: (pc.storage_options ?? []).map(so => {
        const caps = SHELF_LIFE_CAP_DAYS[pc.category ?? "default"] ?? SHELF_LIFE_CAP_DAYS.default;
        const cap  = so.location === "freezer" ? caps.freezer : caps.refrigerator;
        return {
          ...so,
          shelf_life_days: Math.min(so.shelf_life_days ?? cap, cap),
        };
      }),
      default_location: pc.default_location ?? "refrigerator",
      portion_note: pc.portion_note ?? "",
    }));

    // 5. Count how many ingredient canonical_ids changed
    const originalIds = new Map(
      ((recipe.ingredients ?? []) as IngredientItem[]).map(i => [i.raw_text, i.canonical_id])
    );
    const remapped = output.ingredients.filter(i =>
      originalIds.has(i.raw_text) && originalIds.get(i.raw_text) !== i.canonical_id
    ).length;

    // 6. Persist (only the three fields B2 owns)
    const payload = {
      key_ingredients: output.key_ingredients,
      ingredients:     output.ingredients,
      prep_components: prepClamped,
    };

    const { error: updateErr } = await supabase
      .from("recipes")
      .update(payload)
      .eq("id", recipeId);

    if (updateErr) {
      return { ok: false, error: `DB update failed: ${updateErr.message}` };
    }

    revalidatePath(`/recipes/${recipeId}`);

    return {
      ok: true,
      applied: { ...output, prep_components: prepClamped },
      changes: {
        ingredients_remapped:   remapped,
        prep_components_count:  prepClamped.length,
        key_ingredients_count:  output.key_ingredients.length,
      },
    };
  } catch (e) {
    console.error("[runAgentB2]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Agent B2 failed." };
  }
}

// ─── Groq call ──────────────────────────────────────────────────────────────

async function callGroqB2(
  recipe: Record<string, unknown>,
  catalog: { canonical_id: string; display_name: string; category: string | null; aliases: string[] | null }[],
): Promise<B2Output> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  // Compact catalog representation — one line per ingredient.
  // Only canonical_id + display_name + (first 3 aliases) to keep token count down.
  const catalogLines = catalog.map(c => {
    const aliases = (c.aliases ?? []).slice(0, 3).join(",");
    return aliases ? `${c.canonical_id} (${c.display_name}) [${aliases}]` : `${c.canonical_id} (${c.display_name})`;
  }).join("\n");

  const userMessage = `Recipe: ${recipe.display_name}
Cuisine: ${recipe.cuisine ?? "—"}
Dish role: ${recipe.dish_role ?? "—"}  ·  Dish type: ${recipe.dish_type ?? "—"}
Serves: ${recipe.base_servings ?? "—"}

INGREDIENTS (from B1):
${JSON.stringify(recipe.ingredients ?? [], null, 2)}

STEPS (from B1):
${JSON.stringify(recipe.steps ?? [], null, 2)}

EXISTING prep_components (from B1 — may be empty or weak):
${JSON.stringify(recipe.prep_components ?? [], null, 2)}

EXISTING key_ingredients (from B1 — may be weak):
${JSON.stringify(recipe.key_ingredients ?? [], null, 2)}

INGREDIENT CATALOG (use these canonical_ids):
${catalogLines}

---

Run Agent B2. Return JSON:
{
  "key_ingredients": ["canonical_id", ...],
  "ingredients": [
    {
      "canonical_id": "...",
      "display_name": "...",
      "quantity": number|null,
      "unit": "...",
      "is_optional": false,
      "group": "...",
      "notes": "...",
      "raw_text": "..."    // PRESERVE from B1
    }
  ],
  "prep_components": [
    {
      "id": "snake_case_id",
      "task": "imperative task",
      "category": "soak|chop|boil|grind|marinate|cook_base|portion|ferment",
      "time_minutes": 15,
      "portion_note": "...",
      "storage_options": [
        {"location": "refrigerator", "shelf_life_days": 3}
      ],
      "default_location": "refrigerator",
      "produced_from_ingredients": ["canonical_id", ...]
    }
  ],
  "notes_for_curator": "brief rationale"
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
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: B2_SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 413 || res.status === 429) {
      const remainingTpd = res.headers.get("x-ratelimit-remaining-tokens");
      const resetTpd     = res.headers.get("x-ratelimit-reset-tokens");
      const remainingRpd = res.headers.get("x-ratelimit-remaining-requests");
      const resetRpd     = res.headers.get("x-ratelimit-reset-requests");
      throw new Error(
        `Groq rate limit hit (${res.status}). ` +
        `Tokens remaining: ${remainingTpd ?? "?"} (resets in ${resetTpd ?? "?"}). ` +
        `Requests remaining: ${remainingRpd ?? "?"} (resets in ${resetRpd ?? "?"}). ` +
        `Details: ${err.slice(0, 300)}`
      );
    }
    throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");

  let parsed: B2Output;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Agent B2 returned invalid JSON (possibly truncated).");
  }

  // Defensive coercion
  const ensureArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : []);
  return {
    key_ingredients: ensureArr<string>(parsed.key_ingredients),
    ingredients:     ensureArr<IngredientItem>(parsed.ingredients),
    prep_components: ensureArr<PrepComponent>(parsed.prep_components),
    notes_for_curator: parsed.notes_for_curator ?? "",
  };
}
