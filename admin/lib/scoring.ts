// ─── Phase 6 — deterministic meal-suggestion scoring ─────────────────────────
//
// Pure functions. No I/O. Given a candidate recipe and the user context,
// returns a score in [0,1] plus a per-signal breakdown so the UI can show
// "why" each recipe ranked where it did.
//
// Called from:
//   • admin/app/scoring-lab/actions.ts  — preview / tuning
//   • (future) services/agentA.ts on mobile — Stage 2 of the new Agent A
//
// Design principles:
//   • Each signal returns a RAW score in [0,1]. We multiply by weight.
//   • Missing data = neutral 0.5, not 0. Missing data shouldn't punish.
//   • Hard filters (diet, allergy, meal-type) run FIRST and short-circuit.
//   • Every signal explains itself in plain English for the "whyRecommended" string.

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CandidateRecipe {
  id: string;
  display_name: string;
  cuisine: string | null;
  region: string | null;
  dish_role: string | null;
  dish_type: string | null;
  diet_tags: string[] | null;
  meal_types: string[] | null;
  key_ingredients: string[] | null;
  prep_components: unknown[] | null;  // length used as proxy for prep load
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  base_servings: number | null;
  nutrition: { calories?: number | null } | null;
  verified: boolean;
}

export interface UserContext {
  diet:                 string;          // 'vegetarian' | 'vegan' | 'jain' | 'non_vegetarian' | 'eggetarian'
  cuisines:             string[];        // preferred cuisines
  pantryIds:            string[];        // canonical_ids in user's pantry
  favouriteRecipeIds:   string[];
  calorieTargetPerMeal: number;          // kcal — typically (daily_target / meals_per_day)
  mealTypeSlot:         string;          // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  isWeekend:            boolean;         // affects prep_load scoring
  /** recipe_id → most recent shown_at (from meal_history). Older than 14 days = full novelty. */
  recipeLastShown:      Map<string, Date>;
  /** cuisines already used in the current 7-day window (for variety score). */
  cuisinesUsedThisWeek: string[];
}

export interface ScoringWeights {
  pantry_match:    number;
  novelty:         number;
  favourite:       number;
  calorie_fit:     number;
  cuisine_variety: number;
  prep_load:       number;
  seasonality:     number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  pantry_match:    0.30,
  novelty:         0.20,
  favourite:       0.15,
  calorie_fit:     0.10,
  cuisine_variety: 0.10,
  prep_load:       0.10,
  seasonality:     0.05,
};

export interface SignalScore {
  raw:         number;   // 0..1 before weighting
  weighted:    number;   // raw * weight
  explanation: string;   // human-readable
}

export type Tier = "T1" | "T2" | "T3" | "FILTERED";

export interface ScoredRecipe {
  recipe:     CandidateRecipe;
  score:      number;    // final, weighted, 0..1
  tier:       Tier;
  breakdown:  Record<keyof ScoringWeights, SignalScore>;
  filteredReason?: string; // if tier === "FILTERED"
  topReasons: string[];    // top 2-3 explanations for UI summary
}

// ═══════════════════════════════════════════════════════════════════════════
// Hard filters — return string (reason) if rejected, null if passes
// ═══════════════════════════════════════════════════════════════════════════

export function hardFilter(r: CandidateRecipe, u: UserContext): string | null {
  // 1. Must be verified
  if (!r.verified) return "not verified";

  // 2. Meal type must include the slot (breakfast/lunch/dinner/snack)
  if (r.meal_types && r.meal_types.length > 0 && !r.meal_types.includes(u.mealTypeSlot)) {
    return `not a ${u.mealTypeSlot} dish`;
  }

  // 3. Diet compatibility
  //    User diet → allowed recipe diet_tags
  //    vegan        → ['vegan']
  //    jain         → ['jain','vegan']   (jain is strict but can eat vegan)
  //    vegetarian   → ['vegetarian','vegan','jain','eggetarian']
  //    eggetarian   → ['vegetarian','vegan','jain','eggetarian']
  //    non_veg      → any
  const tags = r.diet_tags ?? [];
  if (tags.length > 0) {  // if recipe has no tags we err optimistic
    const allowed = dietAllowance(u.diet);
    if (allowed && !tags.some(t => allowed.includes(t))) {
      return `diet mismatch (${tags.join(",")} vs ${u.diet})`;
    }
  }

  return null;
}

function dietAllowance(userDiet: string): string[] | null {
  switch (userDiet) {
    case "vegan":          return ["vegan"];
    case "jain":           return ["jain", "vegan"];
    case "vegetarian":     return ["vegetarian", "vegan", "jain", "eggetarian"];
    case "eggetarian":     return ["eggetarian", "vegetarian", "vegan", "jain"];
    case "non_vegetarian": return null; // everything allowed
    default:               return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-signal scoring functions (all return 0..1 "raw")
// ═══════════════════════════════════════════════════════════════════════════

function scorePantryMatch(r: CandidateRecipe, u: UserContext): SignalScore {
  const key = r.key_ingredients ?? [];
  if (key.length === 0) {
    return { raw: 0.5, weighted: 0, explanation: "no key ingredients recorded (neutral)" };
  }
  const pantrySet = new Set(u.pantryIds);
  const matches   = key.filter(k => pantrySet.has(k));
  const raw       = matches.length / key.length;
  return {
    raw,
    weighted: 0, // filled in later
    explanation: raw === 1
      ? `all ${key.length} key ingredients in pantry`
      : `${matches.length}/${key.length} key ingredients in pantry`,
  };
}

function scoreNovelty(r: CandidateRecipe, u: UserContext): SignalScore {
  const last = u.recipeLastShown.get(r.id);
  if (!last) return { raw: 1, weighted: 0, explanation: "never shown before" };

  const daysSince = (Date.now() - last.getTime()) / 86400000;
  // 0 days → 0, 14+ days → 1, linear ramp in between
  const raw = Math.max(0, Math.min(1, daysSince / 14));

  if (daysSince < 3) return { raw, weighted: 0, explanation: `shown ${Math.round(daysSince)}d ago (stale)` };
  if (daysSince < 14) return { raw, weighted: 0, explanation: `shown ${Math.round(daysSince)}d ago` };
  return { raw: 1, weighted: 0, explanation: `last seen ${Math.round(daysSince)}d ago` };
}

function scoreFavourite(r: CandidateRecipe, u: UserContext): SignalScore {
  const isFav = u.favouriteRecipeIds.includes(r.id);
  return {
    raw: isFav ? 1 : 0.3,   // non-favourite = 0.3, not 0 — otherwise favs dominate too hard
    weighted: 0,
    explanation: isFav ? "one of your favourites" : "not a favourite",
  };
}

function scoreCalorieFit(r: CandidateRecipe, u: UserContext): SignalScore {
  const totalCal = r.nutrition?.calories;
  const servings = r.base_servings ?? 2;
  if (!totalCal || totalCal <= 0) {
    return { raw: 0.5, weighted: 0, explanation: "no nutrition data (neutral)" };
  }
  const perServing = totalCal / servings;
  const diff       = Math.abs(perServing - u.calorieTargetPerMeal);
  // Within 20% of target → 1.0, off by >100% → 0.0, linear
  const diffPct = diff / u.calorieTargetPerMeal;
  const raw     = Math.max(0, 1 - diffPct);
  return {
    raw,
    weighted: 0,
    explanation: `~${Math.round(perServing)} kcal/serving vs ${u.calorieTargetPerMeal} target`,
  };
}

function scoreCuisineVariety(r: CandidateRecipe, u: UserContext): SignalScore {
  if (!r.cuisine) return { raw: 0.5, weighted: 0, explanation: "no cuisine tag (neutral)" };
  const used = u.cuisinesUsedThisWeek.filter(c => c === r.cuisine).length;
  const total = u.cuisinesUsedThisWeek.length;
  if (total === 0) return { raw: 1, weighted: 0, explanation: "first meal this week" };
  // If this cuisine is <25% of week → boost; >50% → penalise
  const representation = used / total;
  const raw = Math.max(0, Math.min(1, 1 - (representation * 2)));
  return {
    raw,
    weighted: 0,
    explanation: used === 0
      ? `${r.cuisine} not yet this week`
      : `${r.cuisine} already ${used}/${total} this week`,
  };
}

function scorePrepLoad(r: CandidateRecipe, u: UserContext): SignalScore {
  const prepCount = r.prep_components?.length ?? 0;
  const total = r.total_time_minutes ?? ((r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0));
  if (!total) return { raw: 0.5, weighted: 0, explanation: "no timing data (neutral)" };

  // Weekend: prefer >30 min + prep components (elaborate welcome)
  // Weekday: prefer <30 min, 0-1 prep components (quick)
  if (u.isWeekend) {
    const raw = total > 45 ? 1 : total > 25 ? 0.7 : 0.4;
    return { raw, weighted: 0, explanation: `${total} min · weekend-friendly` };
  } else {
    const raw = total <= 25 ? 1 : total <= 40 ? 0.7 : total <= 60 ? 0.4 : 0.2;
    return {
      raw,
      weighted: 0,
      explanation: prepCount > 0
        ? `${total} min + ${prepCount} prep steps (weekday)`
        : `${total} min (weekday)`,
    };
  }
}

function scoreSeasonality(_r: CandidateRecipe, _u: UserContext): SignalScore {
  // Deferred — no seasonality data yet. Neutral 0.5 for all.
  return { raw: 0.5, weighted: 0, explanation: "seasonality not scored yet" };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main scorer
// ═══════════════════════════════════════════════════════════════════════════

export function scoreRecipe(
  recipe: CandidateRecipe,
  user:   UserContext,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredRecipe {
  const filtered = hardFilter(recipe, user);
  if (filtered) {
    return {
      recipe,
      score: 0,
      tier: "FILTERED",
      breakdown: emptyBreakdown(),
      filteredReason: filtered,
      topReasons: [filtered],
    };
  }

  const signals = {
    pantry_match:    scorePantryMatch(recipe, user),
    novelty:         scoreNovelty(recipe, user),
    favourite:       scoreFavourite(recipe, user),
    calorie_fit:     scoreCalorieFit(recipe, user),
    cuisine_variety: scoreCuisineVariety(recipe, user),
    prep_load:       scorePrepLoad(recipe, user),
    seasonality:     scoreSeasonality(recipe, user),
  };

  // Weight each signal
  let total = 0;
  let weightSum = 0;
  (Object.keys(signals) as Array<keyof ScoringWeights>).forEach(k => {
    const w = weights[k];
    signals[k].weighted = signals[k].raw * w;
    total     += signals[k].weighted;
    weightSum += w;
  });
  // Normalise in case weights don't sum to 1
  const finalScore = weightSum > 0 ? total / weightSum : 0;

  // Top 3 contributing signals for the UI summary
  const topReasons = (Object.entries(signals) as Array<[keyof ScoringWeights, SignalScore]>)
    .sort((a, b) => b[1].weighted - a[1].weighted)
    .slice(0, 3)
    .map(([, s]) => s.explanation);

  return {
    recipe,
    score: finalScore,
    tier: "T1",                      // assigned later by assignTiers()
    breakdown: signals,
    topReasons,
  };
}

function emptyBreakdown(): Record<keyof ScoringWeights, SignalScore> {
  const empty: SignalScore = { raw: 0, weighted: 0, explanation: "—" };
  return {
    pantry_match:    { ...empty },
    novelty:         { ...empty },
    favourite:       { ...empty },
    calorie_fit:     { ...empty },
    cuisine_variety: { ...empty },
    prep_load:       { ...empty },
    seasonality:     { ...empty },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Batch helpers
// ═══════════════════════════════════════════════════════════════════════════

export function scoreAll(
  recipes: CandidateRecipe[],
  user:    UserContext,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredRecipe[] {
  return recipes.map(r => scoreRecipe(r, user, weights));
}

/** Sorts by score desc (filtered last), then tiers the top 80%. */
export function rankAndTier(scored: ScoredRecipe[]): ScoredRecipe[] {
  const passing = scored.filter(s => s.tier !== "FILTERED")
                        .sort((a, b) => b.score - a.score);
  const filtered = scored.filter(s => s.tier === "FILTERED");

  const n = passing.length;
  const t1End = Math.floor(n * 0.2);
  const t2End = Math.floor(n * 0.7);

  passing.forEach((s, i) => {
    s.tier = i < t1End ? "T1" : i < t2End ? "T2" : "T3";
  });

  return [...passing, ...filtered];
}
