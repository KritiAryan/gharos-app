// ─── Agent A — Catalog-based meal suggestion ────────────────────────────────
//
// Replaces the old LLM-invents-cards flow.
//
// Pipeline:
//   1. Fetch verified recipes from Supabase filtered by diet
//   2. Fetch user's meal_history (last 14 days) for novelty signal
//   3. Score each recipe per slot using services/scoring.ts
//   4. Rank + tier (T1/T2/T3)
//   5. Return T1+T2 cards sorted by score, dedupe across slots
//
// Output shape matches the old generateSuggestions() so meal-cards.tsx is
// unchanged.
//
// If Supabase has too few verified recipes (< SEED_MIN), returns [] and the
// caller falls back to LLM-generated cards.

import { supabase } from "../lib/supabase";
import {
  scoreAll, rankAndTier, DEFAULT_WEIGHTS,
  type CandidateRecipe, type UserContext, type ScoredRecipe,
} from "./scoring";

export interface Card {
  id:               string;
  recipe_id?:       string;
  name:             string;
  cuisine:          string;
  mealType:         string[];
  cookTime:         number;
  prepAhead:        boolean;
  prepNote:         string | null;
  macros:           { cal: number; protein: number; carbs: number; fat: number };
  extraIngredients: number;
  whyRecommended:   string | null;
  imageUrl:         string | null;
  sourceUrl:        string | null;
  sourceName:       string | null;
  ingredients:      any[];
  steps:            any[];
  isAIEnriched:     boolean;
  isFavourite:      boolean;
  tier?:            string;
  score?:           number;
}

export interface GenerateInput {
  cuisines:      string[];
  diet:          string;
  pantry:        unknown[];                // array of strings OR {canonical_name, …} objects
  persons:       number;
  days:          number;
  mealsPerDay:   string[];                 // e.g. ['breakfast','lunch','dinner']
  calorieTarget: number | null;
  favourites?:   unknown[];                // array of ids OR {id, …} objects
  alreadySeen?:  string[];                 // card names already shown
}

const SEED_MIN  = 20;   // below this, catalog mode gives up and we fall back
const POOL_SIZE = 40;   // how many T1/T2 candidates we keep per slot

// ─── Full catalog recipe shape (superset of CandidateRecipe for card build) ─
interface CatalogRecipe extends CandidateRecipe {
  source_url:         string | null;
  source_name:        string | null;
  source_image_url:   string | null;
  image_storage_path: string | null;
  ingredients:        unknown[] | null;
  steps:              unknown[] | null;
  // CandidateRecipe fields already include nutrition / total_time / etc.
}

// ─── Main ──────────────────────────────────────────────────────────────────

export async function generateSuggestionsFromCatalog(input: GenerateInput): Promise<Card[]> {
  const { cuisines, diet, pantry, mealsPerDay, calorieTarget, favourites, alreadySeen } = input;

  // 1. Fetch verified recipes (diet filter done in scoring; here we just
  //    pre-narrow by cuisines so we don't over-fetch).
  const supaUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  let query = supabase.from("recipes").select(`
    id, display_name, cuisine, region, dish_role, dish_type,
    diet_tags, meal_types, key_ingredients, prep_components,
    prep_time_minutes, cook_time_minutes, total_time_minutes,
    base_servings, nutrition, verified,
    source_url, source_name, source_image_url, image_storage_path,
    ingredients, steps
  `).eq("verified", true);

  if (cuisines && cuisines.length > 0) {
    // match canonical form from profile (user may have "North Indian" or "north_indian")
    const canonical = cuisines.map(c => toCanonicalCuisine(c));
    query = query.in("cuisine", canonical);
  }

  const { data: recipesRaw, error } = await query;
  if (error) {
    console.warn("[agentA] recipe query failed:", error.message);
    return [];
  }

  const recipes = (recipesRaw ?? []) as unknown as CatalogRecipe[];
  if (recipes.length < SEED_MIN) {
    console.info(`[agentA] catalog has only ${recipes.length} verified ${cuisines?.join("/")} recipes — falling back to LLM`);
    return [];
  }

  // 2. Fetch meal_history for novelty + cuisine variety
  const { data: { user } } = await supabase.auth.getUser();
  const recipeLastShown: Map<string, Date> = new Map();
  const cuisinesUsedThisWeek: string[] = [];

  if (user) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: history } = await supabase
      .from("meal_history")
      .select("recipe_id, shown_at, cuisine")
      .eq("user_id", user.id)
      .gte("shown_at", since)
      .order("shown_at", { ascending: false });
    (history ?? []).forEach((h: { recipe_id?: string; shown_at?: string; cuisine?: string }) => {
      if (h.recipe_id && !recipeLastShown.has(h.recipe_id)) {
        recipeLastShown.set(h.recipe_id, new Date(h.shown_at as string));
      }
      if (h.cuisine) cuisinesUsedThisWeek.push(h.cuisine);
    });
  }

  // 3. Normalise pantry + favourites to canonical_id / uuid strings
  const pantryIds = (Array.isArray(pantry) ? pantry : [])
    .map((p: unknown) => {
      if (typeof p === "string") return p;
      const obj = p as { canonical_name?: string; canonical_id?: string; item_key?: string; name?: string };
      return obj?.canonical_name ?? obj?.canonical_id ?? obj?.item_key ?? obj?.name ?? "";
    })
    .filter(Boolean);

  const favouriteIds = (Array.isArray(favourites) ? favourites : [])
    .map((f: unknown) => {
      if (typeof f === "string") return f;
      const obj = f as { id?: string; recipe_id?: string };
      return obj?.id ?? obj?.recipe_id ?? "";
    })
    .filter(Boolean);

  const mealsCount = Math.max(1, mealsPerDay.length);
  const calorieTargetPerMeal = Math.round((calorieTarget ?? 1800) / mealsCount);

  // 4. Run scoring for each slot, collect best score per recipe
  const seenNames = new Set((alreadySeen ?? []).map(n => n.toLowerCase()));
  const bestByRecipe: Map<string, ScoredRecipe> = new Map();

  const today    = new Date();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;

  for (const slot of mealsPerDay) {
    const ctx: UserContext = {
      diet,
      cuisines,
      pantryIds,
      favouriteRecipeIds: favouriteIds,
      calorieTargetPerMeal,
      mealTypeSlot: slot,
      isWeekend,
      recipeLastShown,
      cuisinesUsedThisWeek,
    };

    const scored = scoreAll(recipes as CandidateRecipe[], ctx);
    const ranked = rankAndTier(scored);
    const pool   = ranked.filter(r => r.tier === "T1" || r.tier === "T2").slice(0, POOL_SIZE);

    pool.forEach(p => {
      const prev = bestByRecipe.get(p.recipe.id);
      if (!prev || p.score > prev.score) bestByRecipe.set(p.recipe.id, p);
    });
  }

  // 5. Convert to cards, dedupe by name against alreadySeen, sort by score
  const cards: Card[] = Array.from(bestByRecipe.values())
    .filter(s => !seenNames.has(s.recipe.display_name.toLowerCase()))
    .sort((a, b) => b.score - a.score)
    .map(s => toCard(s, recipes.find(r => r.id === s.recipe.id)!, supaUrl, favouriteIds));

  console.info(`[agentA] catalog returned ${cards.length} cards (from ${recipes.length} verified)`);
  return cards;
}

// ─── Card builder ──────────────────────────────────────────────────────────

function toCard(scored: ScoredRecipe, full: CatalogRecipe, supaUrl: string | undefined, favouriteIds: string[]): Card {
  const nut = full.nutrition as { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } | null;
  const servings = full.base_servings ?? 1;
  const macros = nut ? {
    cal:     Math.round((nut.calories  ?? 0) / servings),
    protein: Math.round((nut.protein_g ?? 0) / servings),
    carbs:   Math.round((nut.carbs_g   ?? 0) / servings),
    fat:     Math.round((nut.fat_g     ?? 0) / servings),
  } : { cal: 300, protein: 10, carbs: 40, fat: 8 };

  const imageUrl = full.image_storage_path && supaUrl
    ? `${supaUrl}/storage/v1/object/public/recipe-images/${full.image_storage_path}`
    : full.source_image_url ?? null;

  const keyLen     = full.key_ingredients?.length ?? 0;
  const pantryRaw  = scored.breakdown.pantry_match.raw; // fraction matched
  const missing    = Math.max(0, Math.round(keyLen * (1 - pantryRaw)));

  return {
    id:               `cat_${full.id}`,
    recipe_id:        full.id,
    name:             full.display_name,
    cuisine:          full.cuisine ?? "Pan-Indian",
    mealType:         full.meal_types ?? ["lunch"],
    cookTime:         (full.total_time_minutes ?? ((full.prep_time_minutes ?? 0) + (full.cook_time_minutes ?? 0))) || 30,
    prepAhead:        (full.prep_components?.length ?? 0) > 0,
    prepNote:         null,
    macros,
    extraIngredients: missing,
    whyRecommended:   scored.topReasons.slice(0, 2).join(" · "),
    imageUrl,
    sourceUrl:        full.source_url,
    sourceName:       full.source_name,
    ingredients:      full.ingredients ?? [],
    steps:            full.steps ?? [],
    isAIEnriched:     true,
    isFavourite:      favouriteIds.includes(full.id),
    tier:             scored.tier,
    score:            scored.score,
  };
}

// ─── Cuisine canonicalisation ──────────────────────────────────────────────
//
// User profile may store cuisines in various forms ("North Indian", "north_indian").
// Supabase uses snake_case canonical. Normalise for the `in` query.
function toCanonicalCuisine(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/[^\w]/g, "");
  const map: Record<string, string> = {
    "north_indian":     "north_indian",
    "south_indian":     "south_indian",
    "east_indian":      "east_indian",
    "west_indian":      "west_indian",
    "panindian":        "pan_indian",
    "pan_indian":       "pan_indian",
    "continental":      "continental",
    "other":            "other",
  };
  return map[s] ?? s;
}
