// ─── Recipe enum normalisation ───────────────────────────────────────────────
//
// The `recipes` table has CHECK constraints on:
//   • region    — nullable, must be in VALID_REGIONS if set
//   • dish_role — NOT NULL, must be in VALID_DISH_ROLES
//
// Agent B1 (and occasional manual edits) sometimes produce values outside the
// allowed set (e.g. "indian" instead of "pan_indian", "main" instead of "hero"),
// which trips Postgres error 23514. This module coerces them to valid values
// via an alias map, falling back to null (region) or "hero" (dish_role).
//
// Used by:
//   • admin/app/recipes/new/actions.ts           — saveRecipe
//   • admin/app/recipes/[id]/actions.ts          — updateRecipe

export const VALID_REGIONS = new Set([
  "north_indian", "south_indian", "east_indian",
  "west_indian", "pan_indian", "continental", "other",
]);

export const VALID_DISH_ROLES = new Set(["hero", "side", "staple", "condiment", "snack"]);

const REGION_ALIASES: Record<string, string> = {
  "indian":     "pan_indian",
  "pan-indian": "pan_indian",
  "pan indian": "pan_indian",
  "all":        "pan_indian",
  "mixed":      "pan_indian",
  "north":      "north_indian",
  "south":      "south_indian",
  "east":       "east_indian",
  "west":       "west_indian",
  "northern":   "north_indian",
  "southern":   "south_indian",
  "eastern":    "east_indian",
  "western":    "west_indian",
};

const DISH_ROLE_ALIASES: Record<string, string> = {
  "main":           "hero",
  "main_dish":      "hero",
  "main dish":      "hero",
  "main course":    "hero",
  "entree":         "hero",
  "entrée":         "hero",
  "accompaniment":  "side",
  "dessert":        "snack",
  "drink":          "snack",
  "beverage":       "snack",
  "appetizer":      "snack",
  "starter":        "snack",
};

export function normaliseRecipeEnums(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload };

  // region — nullable; unknown → null, known alias → canonical
  if (typeof out.region === "string") {
    const r = out.region.toLowerCase().trim();
    if (VALID_REGIONS.has(r))           out.region = r;
    else if (REGION_ALIASES[r])         out.region = REGION_ALIASES[r];
    else                                out.region = null;
  }

  // dish_role — NOT NULL; unknown → "hero"
  if (typeof out.dish_role === "string") {
    const d = out.dish_role.toLowerCase().trim();
    if (VALID_DISH_ROLES.has(d))        out.dish_role = d;
    else if (DISH_ROLE_ALIASES[d])      out.dish_role = DISH_ROLE_ALIASES[d];
    else                                out.dish_role = "hero";
  } else if (out.dish_role == null) {
    out.dish_role = "hero";
  }

  return out;
}
