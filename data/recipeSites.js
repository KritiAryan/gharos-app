// Hardcoded trusted recipe sources — shown to all users
// Users can toggle individual sites off; they cannot delete them
// Custom URLs added by the user are stored separately in profile.config.recipeSites

export const DEFAULT_RECIPE_SITES = [
  { name: "Hebbars Kitchen",        url: "hebbarskitchen.com",       description: "Popular vegetarian recipes with step-by-step photos",  emoji: "🍳" },
  { name: "Veg Recipes of India",   url: "vegrecipesofindia.com",    description: "Pure vegetarian Indian recipes",                        emoji: "🥗" },
  { name: "Ranveer Brar",           url: "ranveerbrar.com",          description: "Chef-quality recipes with technique tips",              emoji: "👨‍🍳" },
  { name: "Udupi Recipes",          url: "udupi-recipes.com",        description: "Authentic Udupi and South Indian cuisine",              emoji: "🌿" },
  { name: "Madhura's Recipe",       url: "madhurasrecipe.com",       description: "Maharashtrian and Indian home cooking",                 emoji: "🏠" },
  { name: "Indian Healthy Recipes", url: "indianhealthyrecipes.com", description: "Healthy Indian recipes by Swasthi",                    emoji: "💚" },
];

export const getActiveSiteUrls = (profile) => {
  const disabled = profile?.config?.disabledDefaultSites || [];
  const defaultUrls = DEFAULT_RECIPE_SITES.filter((s) => !disabled.includes(s.url)).map((s) => s.url);
  const customUrls = (profile?.config?.recipeSites || []).map((s) => (typeof s === "string" ? s : s?.url)).filter(Boolean);
  return [...defaultUrls, ...customUrls];
};
