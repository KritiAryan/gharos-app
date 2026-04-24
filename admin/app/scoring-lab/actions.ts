"use server";

// ─── Scoring Lab — server action ─────────────────────────────────────────────
//
// Loads all verified recipes + user context (profile / pantry / meal history)
// and runs the pure scoring module against them. Returns the ranked list
// plus metadata so the UI can show breakdowns.

import { createAdminClient } from "@/lib/supabase/server";
import {
  scoreAll, rankAndTier,
  type CandidateRecipe, type UserContext, type ScoringWeights, type ScoredRecipe,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring";

export interface LabInput {
  /** Either pass a real user_id OR use the `testProfile` fallback. */
  userId?:      string;
  testProfile?: {
    diet:                 string;
    cuisines:             string[];
    pantryIds:            string[];
    favouriteRecipeIds:   string[];
    calorieTargetPerMeal: number;
  };
  mealTypeSlot: string;   // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  isWeekend:    boolean;
  weights?:     ScoringWeights;
}

export interface LabResult {
  ok:           true;
  candidates:   ScoredRecipe[];
  meta: {
    totalRecipes:      number;
    filteredCount:     number;
    t1Count:           number;
    t2Count:           number;
    t3Count:           number;
    pantryIds:         string[];
    favouriteIds:      string[];
    recentMealsCount:  number;
  };
}

export type LabResponse = LabResult | { ok: false; error: string };

export async function runScoringLab(input: LabInput): Promise<LabResponse> {
  try {
    const supabase = createAdminClient();

    // 1. Resolve user context
    let pantryIds:         string[] = [];
    let favouriteRecipeIds: string[] = [];
    let diet:     string = input.testProfile?.diet               ?? "vegetarian";
    let cuisines: string[] = input.testProfile?.cuisines         ?? ["north_indian", "south_indian"];
    let calorieTargetPerMeal = input.testProfile?.calorieTargetPerMeal ?? 500;
    let recipeLastShown: Map<string, Date> = new Map();
    let cuisinesUsedThisWeek: string[] = [];

    if (input.userId) {
      // Load real profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("config, pantry, favourites")
        .eq("id", input.userId)
        .single();
      if (profile) {
        const cfg = (profile.config as Record<string, unknown>) ?? {};
        diet     = (cfg.diet     as string)   ?? diet;
        cuisines = (cfg.cuisines as string[]) ?? cuisines;
        const dailyTarget = Number((cfg.calorieTarget as number | string | undefined) ?? 1800);
        calorieTargetPerMeal = Math.round(dailyTarget / 3);

        // Pantry can be either array of canonical_ids or array of objects
        const raw = (profile.pantry as unknown[]) ?? [];
        pantryIds = raw.map(p => typeof p === "string" ? p : (p as { canonical_id?: string }).canonical_id ?? "")
                       .filter(Boolean);

        const favRaw = (profile.favourites as unknown[]) ?? [];
        favouriteRecipeIds = favRaw.map(f => typeof f === "string" ? f : (f as { id?: string }).id ?? "")
                                   .filter(Boolean);
      }

      // meal_history — last 14 days shown_at
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data: history } = await supabase
        .from("meal_history")
        .select("recipe_id, shown_at, cuisine")
        .eq("user_id", input.userId)
        .gte("shown_at", since)
        .order("shown_at", { ascending: false });

      (history ?? []).forEach(h => {
        if (h.recipe_id && !recipeLastShown.has(h.recipe_id)) {
          recipeLastShown.set(h.recipe_id, new Date(h.shown_at as string));
        }
        if (h.cuisine) cuisinesUsedThisWeek.push(h.cuisine as string);
      });
    } else if (input.testProfile) {
      pantryIds         = input.testProfile.pantryIds ?? [];
      favouriteRecipeIds = input.testProfile.favouriteRecipeIds ?? [];
      // No meal_history for synthetic test profile.
    }

    // 2. Load candidates — only verified recipes
    const { data: recipesRaw, error: rErr } = await supabase
      .from("recipes")
      .select(`
        id, display_name, cuisine, region, dish_role, dish_type,
        diet_tags, meal_types, key_ingredients, prep_components,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        base_servings, nutrition, verified
      `)
      .eq("verified", true);

    if (rErr) return { ok: false, error: `Recipe load failed: ${rErr.message}` };

    const recipes = (recipesRaw ?? []) as unknown as CandidateRecipe[];

    // 3. Build user context
    const user: UserContext = {
      diet,
      cuisines,
      pantryIds,
      favouriteRecipeIds,
      calorieTargetPerMeal,
      mealTypeSlot: input.mealTypeSlot,
      isWeekend:    input.isWeekend,
      recipeLastShown,
      cuisinesUsedThisWeek,
    };

    // 4. Score + rank + tier
    const weights = input.weights ?? DEFAULT_WEIGHTS;
    const scored  = scoreAll(recipes, user, weights);
    const ranked  = rankAndTier(scored);

    return {
      ok: true,
      candidates: ranked,
      meta: {
        totalRecipes:     recipes.length,
        filteredCount:    ranked.filter(r => r.tier === "FILTERED").length,
        t1Count:          ranked.filter(r => r.tier === "T1").length,
        t2Count:          ranked.filter(r => r.tier === "T2").length,
        t3Count:          ranked.filter(r => r.tier === "T3").length,
        pantryIds,
        favouriteIds:     favouriteRecipeIds,
        recentMealsCount: recipeLastShown.size,
      },
    };
  } catch (e) {
    console.error("[runScoringLab]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Scoring lab failed." };
  }
}

/** Enumerate users who have a profiles row, so the lab dropdown works. */
export async function listProfiles(): Promise<{ ok: true; profiles: Array<{ id: string; email: string; full_name: string | null }> } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("email");
    if (error) return { ok: false, error: error.message };
    return { ok: true, profiles: (data ?? []) as Array<{ id: string; email: string; full_name: string | null }> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list profiles" };
  }
}
