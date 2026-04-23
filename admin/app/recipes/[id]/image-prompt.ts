// ─── Image-generation prompt template ────────────────────────────────────────
//
// Used by run-image.ts (Gemini 2.5 Flash Image). Plain module — not "use server"
// — so the template can also be shown on the /prompts page without tripping
// Next's server-action export restriction.
//
// Design rationale:
//   • Brand-consistent: every photo follows the same composition / mood rules
//     so the app feels cohesive.
//   • Dish-type aware: biryani → handi/ dum pot, dry_sabzi → kadhai, dal → katori,
//     rice → plated, roti → stack on wooden board, chutney → small bowl, etc.
//   • Cuisine/region aware: north Indian dishes on copper/brass, south Indian
//     on banana leaf or steel thali, etc.
//   • Top-down 45-degree angle, warm natural light, shallow depth.
//   • No text, no watermark, no hands, no faces — just the food.

const DISH_TYPE_VESSEL: Record<string, string> = {
  gravy:      "served in a small copper katori or handi, with a side garnish",
  dry_sabzi:  "served in a black or copper kadhai, garnished with fresh coriander",
  dal:        "in a small brass or copper katori, tempering visible on top",
  rice:       "plated in a wide, shallow brass or steel bowl, fluffy and garnished",
  roti:       "a stack on a wooden chakla, one folded to show layers, with ghee glistening",
  chutney:    "in a small ceramic bowl, with the main component visible (whole spice, curry leaf, etc.)",
  raita:      "in a small ceramic or brass bowl, garnished with mint and a sprinkle of chaat masala",
  biryani:    "in a traditional copper handi or dum pot, layers visible, saffron rice on top",
  salad:      "in a shallow wooden or ceramic bowl, ingredients arranged rustically",
  bread:      "on a wooden board, torn to show texture",
  sweet:      "in a small ornate brass or silver bowl/plate, garnished with pistachio/silver leaf",
  snack:      "on a banana leaf or rustic plate, with a small bowl of chutney alongside",
};

const CUISINE_STYLING: Record<string, string> = {
  north_indian:  "warm copper and brass vessels on a dark wooden table, moody warm light",
  south_indian:  "banana leaf or steel thali on a dark wooden table, soft natural light",
  east_indian:   "brass or terracotta on a rustic wooden table, window light",
  west_indian:   "bright brass or ceramic on a light wooden table, crisp natural light",
  pan_indian:    "neutral brass or ceramic on a warm wooden table, natural light",
  continental:   "neutral ceramic on a light wooden or marble surface, soft daylight",
  other:         "neutral ceramic on a warm wooden table, soft natural light",
};

interface RecipeForImagePrompt {
  display_name: string;
  description?: string | null;
  cuisine?: string | null;
  region?: string | null;
  dish_type?: string | null;
  dish_role?: string | null;
  key_ingredients?: string[] | null;
}

export function buildImagePrompt(recipe: RecipeForImagePrompt): string {
  const vessel  = DISH_TYPE_VESSEL[recipe.dish_type ?? ""]  ?? "in a rustic bowl or plate appropriate for the dish";
  const styling = CUISINE_STYLING[recipe.cuisine ?? ""]     ?? CUISINE_STYLING.pan_indian;

  const keyIng = (recipe.key_ingredients ?? []).slice(0, 4).join(", ");
  const keyIngLine = keyIng
    ? `The dish prominently features: ${keyIng}. These should be visible / identifiable in the image.`
    : "";

  const descLine = recipe.description
    ? `Context: ${recipe.description}`
    : "";

  return `A high-quality, photorealistic food photograph of "${recipe.display_name}", a ${recipe.cuisine ?? "Indian"} dish.

${descLine}

${keyIngLine}

STYLING:
  • The dish is ${vessel}.
  • Setting: ${styling}.
  • Shot from a 45-degree overhead angle, close to the food.
  • Shallow depth of field — food in sharp focus, background soft.
  • Warm, inviting, restaurant-quality look.
  • Minimal props: maybe a small bowl of garnish (coriander, onion rings, lemon wedge) or a folded napkin nearby — nothing that competes with the dish.

STRICT RULES:
  • NO text, NO watermark, NO captions, NO logos anywhere in the image.
  • NO hands, NO faces, NO people.
  • NO cutlery mid-use. A fork or spoon may rest beside the dish.
  • Food must look freshly cooked and appetizing, not over-styled or plastic.
  • Colours natural — do NOT over-saturate reds or yellows.
  • Square aspect ratio (1:1), ~1024x1024.`;
}
