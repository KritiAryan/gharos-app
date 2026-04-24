// ─── Mobile copy of the scoring module ──────────────────────────────────────
//
// ⚠️  CANONICAL SOURCE: admin/lib/scoring.ts
//     Keep this file byte-for-byte identical to that one when tuning weights.
//     Once we have a monorepo / shared package set up, this duplicate goes away.
//
// Why a copy at all?  Metro (Expo) and Next (Vercel) compile from different
// project roots. Importing across roots requires extra config we'd rather
// avoid in the pilot.
//
// Tuning workflow: edit admin/lib/scoring.ts via the /scoring-lab preview →
// copy the updated DEFAULT_WEIGHTS here → ship mobile build.

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
  prep_components: unknown[] | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  base_servings: number | null;
  nutrition: { calories?: number | null } | null;
  verified: boolean;
}

export interface UserContext {
  diet:                 string;
  cuisines:             string[];
  pantryIds:            string[];
  favouriteRecipeIds:   string[];
  calorieTargetPerMeal: number;
  mealTypeSlot:         string;
  isWeekend:            boolean;
  recipeLastShown:      Map<string, Date>;
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
  raw:         number;
  weighted:    number;
  explanation: string;
}

export type Tier = "T1" | "T2" | "T3" | "FILTERED";

export interface ScoredRecipe {
  recipe:     CandidateRecipe;
  score:      number;
  tier:       Tier;
  breakdown:  Record<keyof ScoringWeights, SignalScore>;
  filteredReason?: string;
  topReasons: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Hard filters
// ═══════════════════════════════════════════════════════════════════════════

export function hardFilter(r: CandidateRecipe, u: UserContext): string | null {
  if (!r.verified) return "not verified";

  if (r.meal_types && r.meal_types.length > 0 && !r.meal_types.includes(u.mealTypeSlot)) {
    return `not a ${u.mealTypeSlot} dish`;
  }

  const tags = r.diet_tags ?? [];
  if (tags.length > 0) {
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
    case "vegetarian":
    case "veg":            return ["vegetarian", "vegan", "jain", "eggetarian"];
    case "eggetarian":     return ["eggetarian", "vegetarian", "vegan", "jain"];
    case "non_vegetarian":
    case "non_veg":        return null;
    default:               return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-signal scoring
// ═══════════════════════════════════════════════════════════════════════════

function scorePantryMatch(r: CandidateRecipe, u: UserContext): SignalScore {
  const key = r.key_ingredients ?? [];
  if (key.length === 0) return { raw: 0.5, weighted: 0, explanation: "no key ingredients recorded (neutral)" };
  const pantrySet = new Set(u.pantryIds);
  const matches   = key.filter(k => pantrySet.has(k));
  const raw       = matches.length / key.length;
  return {
    raw, weighted: 0,
    explanation: raw === 1
      ? `all ${key.length} key ingredients in pantry`
      : `${matches.length}/${key.length} key ingredients in pantry`,
  };
}

function scoreNovelty(r: CandidateRecipe, u: UserContext): SignalScore {
  const last = u.recipeLastShown.get(r.id);
  if (!last) return { raw: 1, weighted: 0, explanation: "never shown before" };
  const daysSince = (Date.now() - last.getTime()) / 86400000;
  const raw = Math.max(0, Math.min(1, daysSince / 14));
  if (daysSince < 3) return { raw, weighted: 0, explanation: `shown ${Math.round(daysSince)}d ago (stale)` };
  if (daysSince < 14) return { raw, weighted: 0, explanation: `shown ${Math.round(daysSince)}d ago` };
  return { raw: 1, weighted: 0, explanation: `last seen ${Math.round(daysSince)}d ago` };
}

function scoreFavourite(r: CandidateRecipe, u: UserContext): SignalScore {
  const isFav = u.favouriteRecipeIds.includes(r.id);
  return { raw: isFav ? 1 : 0.3, weighted: 0, explanation: isFav ? "one of your favourites" : "not a favourite" };
}

function scoreCalorieFit(r: CandidateRecipe, u: UserContext): SignalScore {
  const totalCal = r.nutrition?.calories;
  const servings = r.base_servings ?? 2;
  if (!totalCal || totalCal <= 0) return { raw: 0.5, weighted: 0, explanation: "no nutrition data (neutral)" };
  const perServing = totalCal / servings;
  const diff       = Math.abs(perServing - u.calorieTargetPerMeal);
  const diffPct    = diff / u.calorieTargetPerMeal;
  const raw        = Math.max(0, 1 - diffPct);
  return { raw, weighted: 0, explanation: `~${Math.round(perServing)} kcal/serving vs ${u.calorieTargetPerMeal} target` };
}

function scoreCuisineVariety(r: CandidateRecipe, u: UserContext): SignalScore {
  if (!r.cuisine) return { raw: 0.5, weighted: 0, explanation: "no cuisine tag (neutral)" };
  const used  = u.cuisinesUsedThisWeek.filter(c => c === r.cuisine).length;
  const total = u.cuisinesUsedThisWeek.length;
  if (total === 0) return { raw: 1, weighted: 0, explanation: "first meal this week" };
  const raw = Math.max(0, Math.min(1, 1 - (used / total * 2)));
  return {
    raw, weighted: 0,
    explanation: used === 0 ? `${r.cuisine} not yet this week` : `${r.cuisine} already ${used}/${total} this week`,
  };
}

function scorePrepLoad(r: CandidateRecipe, u: UserContext): SignalScore {
  const prepCount = r.prep_components?.length ?? 0;
  const total     = r.total_time_minutes ?? ((r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0));
  if (!total) return { raw: 0.5, weighted: 0, explanation: "no timing data (neutral)" };
  if (u.isWeekend) {
    const raw = total > 45 ? 1 : total > 25 ? 0.7 : 0.4;
    return { raw, weighted: 0, explanation: `${total} min · weekend-friendly` };
  } else {
    const raw = total <= 25 ? 1 : total <= 40 ? 0.7 : total <= 60 ? 0.4 : 0.2;
    return {
      raw, weighted: 0,
      explanation: prepCount > 0 ? `${total} min + ${prepCount} prep steps (weekday)` : `${total} min (weekday)`,
    };
  }
}

function scoreSeasonality(_r: CandidateRecipe, _u: UserContext): SignalScore {
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
      recipe, score: 0, tier: "FILTERED",
      breakdown: emptyBreakdown(), filteredReason: filtered, topReasons: [filtered],
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

  let total = 0, weightSum = 0;
  (Object.keys(signals) as Array<keyof ScoringWeights>).forEach(k => {
    const w = weights[k];
    signals[k].weighted = signals[k].raw * w;
    total     += signals[k].weighted;
    weightSum += w;
  });
  const finalScore = weightSum > 0 ? total / weightSum : 0;

  const topReasons = (Object.entries(signals) as Array<[keyof ScoringWeights, SignalScore]>)
    .sort((a, b) => b[1].weighted - a[1].weighted)
    .slice(0, 3)
    .map(([, s]) => s.explanation);

  return { recipe, score: finalScore, tier: "T1", breakdown: signals, topReasons };
}

function emptyBreakdown(): Record<keyof ScoringWeights, SignalScore> {
  const empty: SignalScore = { raw: 0, weighted: 0, explanation: "—" };
  return {
    pantry_match:    { ...empty }, novelty:       { ...empty },
    favourite:       { ...empty }, calorie_fit:   { ...empty },
    cuisine_variety: { ...empty }, prep_load:     { ...empty },
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

export function rankAndTier(scored: ScoredRecipe[]): ScoredRecipe[] {
  const passing  = scored.filter(s => s.tier !== "FILTERED").sort((a, b) => b.score - a.score);
  const filtered = scored.filter(s => s.tier === "FILTERED");

  const n = passing.length;
  const t1End = Math.floor(n * 0.2);
  const t2End = Math.floor(n * 0.7);

  passing.forEach((s, i) => {
    s.tier = i < t1End ? "T1" : i < t2End ? "T2" : "T3";
  });

  return [...passing, ...filtered];
}
