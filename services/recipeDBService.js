// Recipe DB Service
// Shared recipe cache — populated by Agent B, reused across all users

import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────
// Single recipe lookup (used on card tap)
// activeSiteNames = site display names that are currently enabled
// Source check is SOFT — if source_name is null (unknown), still use the recipe
// ─────────────────────────────────────────
export const checkRecipeDB = async (name, cuisine, activeSiteNames = []) => {
  const { data } = await supabase
    .from("recipe_db")
    .select("*")
    .ilike("name", name)
    .ilike("cuisine", cuisine)
    .maybeSingle();

  if (!data) return null;

  // Soft source filter: only exclude if source is known AND user has disabled it
  const sourceDisabled =
    activeSiteNames.length > 0 &&
    data.source_name &&
    !activeSiteNames.includes(data.source_name);

  return sourceDisabled ? null : data;
};

// ─────────────────────────────────────────
// Batch lookup (used after Agent A returns suggestions)
// Returns a map: lowercase dish name → recipe row
// ─────────────────────────────────────────
export const batchCheckRecipeDB = async (meals, activeSiteNames = []) => {
  if (!meals.length) return {};

  // Build OR filter: name.ilike.Dal Makhani,name.ilike.Poha,...
  const filter = meals.map((m) => `name.ilike.${m.name}`).join(",");

  const { data, error } = await supabase
    .from("recipe_db")
    .select(
      "id, name, cuisine, image_url, macros, meal_type, source_name, source_url, cook_time, prep_ahead, prep_note"
    )
    .or(filter);

  if (error || !data) return {};

  const map = {};
  data.forEach((r) => {
    const sourceOk =
      !activeSiteNames.length ||
      !r.source_name ||
      activeSiteNames.includes(r.source_name);
    if (sourceOk) {
      map[r.name.toLowerCase()] = r;
    }
  });

  return map;
};

// ─────────────────────────────────────────
// Store a fetched recipe (fire-and-forget)
// First fetch wins — ignoreDuplicates so we never overwrite existing
// ─────────────────────────────────────────
export const storeInRecipeDB = async (recipe) => {
  const { error } = await supabase.from("recipe_db").insert({
    name: recipe.name,
    cuisine: recipe.cuisine,
    source_url: recipe.sourceUrl || null,
    source_name: recipe.sourceName || null,
    image_url: recipe.imageUrl || null,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    macros: recipe.macros || null,
    cook_time: recipe.cookTime || null,
    prep_time: recipe.prepTime || null,
    prep_ahead: recipe.prepAhead || false,
    prep_note: recipe.prepNote || null,
    serving_size: recipe.servingSize || 2,
    diet_tags: recipe.dietTags || [],
    meal_type: recipe.mealType || [],
    fetch_source: "gemini_search",
  });

  // Silently ignore duplicate key errors — expected behavior
  if (error && !error.message.includes("duplicate") && !error.message.includes("unique")) {
    console.warn("recipe_db store error:", error.message);
  }
};
