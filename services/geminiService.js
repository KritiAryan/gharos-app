// LLM Service — All agents use llama-4-scout (30K TPM free tier)
// ─────────────────────────────────────────────────────────────────────────────
// Agent A  (suggestions)  → Groq llama-4-scout  (30K TPM, 1K RPD free)
// Agent B  (recipe fetch)  → Jina Reader + Groq llama-4-scout
// Agent C  (weekly plan)   → Groq llama-4-scout
// Agent D  (shopping list) → Groq llama-4-scout
// Fallback (Groq down)     → Gemini 2.0 Flash Lite (last resort only)
// ─────────────────────────────────────────────────────────────────────────────

import { checkRecipeDB, storeInRecipeDB } from "./recipeDBService";

// ─── Config ─────────────────────────────────────────────────────────────────

const GROQ_API_KEY   = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Model routing — all agents use llama-4-scout (best free tier: 30K TPM, 500K TPD)
//
// | Model                              | RPM | RPD   | TPM   | TPD   |
// |------------------------------------|-----|-------|-------|-------|
// | llama-4-scout-17b-16e-instruct     |  30 | 1 000 | 30000 | 500K  |  ← All agents

const GROQ_MODEL_A  = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_MODEL_B  = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_MODEL_CD = "meta-llama/llama-4-scout-17b-16e-instruct";

// Gemini only used as fallback if Groq is completely down
const GEMINI_FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

// ─── Utilities ───────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const parseJSON = (text) => {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    // Try direct parse first
    try { return JSON.parse(cleaned); } catch {}
    // Extract first JSON array [...] or object {...} from anywhere in the text
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    return null;
  } catch {
    return null;
  }
};

// ─── Groq caller (primary for A / C / D) ────────────────────────────────────

const callGroq = async (prompt, model = GROQ_MODEL_CD) => {
  if (!GROQ_API_KEY || GROQ_API_KEY === "your_groq_key_here") {
    throw new Error("Groq API key not configured");
  }
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
};

// ─── Gemini caller (fallback) ────────────────────────────────────────────────

const _fetchGemini = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const callGeminiFallback = (prompt) =>
  _fetchGemini(GEMINI_FALLBACK_URL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  });

// ─── Smart LLM router (Groq → Gemini fallback) ───────────────────────────────

const callLLM = async (prompt, model = GROQ_MODEL_CD) => {
  try {
    return await callGroq(prompt, model);
  } catch (groqErr) {
    // On TPM limit, skip the 30s wait and fall through to Gemini immediately
    console.warn(`Groq unavailable (${groqErr.message}), falling back to Gemini…`);
    try {
      return await callGeminiFallback(prompt);
    } catch (geminiErr) {
      console.warn(`Gemini also failed (${geminiErr.message})`);
      throw groqErr;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT A — Meal Suggestor
// ─────────────────────────────────────────────────────────────────────────────
export const generateSuggestions = async ({
  cuisines,
  diet,
  pantry,
  persons,
  days,
  mealsPerDay,
  calorieTarget,
  favourites = [],
  alreadySeen = [],
}) => {
  const totalNeeded = days * mealsPerDay.length;
  const generateCount = Math.ceil(totalNeeded * 1.5);

  const pantryNames = (Array.isArray(pantry) ? pantry : [])
    .map((p) => (typeof p === "string" ? p : p?.name || ""))
    .filter(Boolean)
    .join(", ");

  const prompt = `Generate ${generateCount} Indian meal suggestions as JSON array.
Diet:${diet} | Cuisines:${cuisines.join(",")} | Slots:${mealsPerDay.join(",")} | People:${persons}
${pantryNames ? `Pantry:${pantryNames}` : ""}${calorieTarget ? ` | CalTarget:${calorieTarget}kcal` : ""}
${alreadySeen.length > 0 ? `DO NOT repeat:${alreadySeen.join(",")}` : ""}
Rules: only complete meals (no sides/desserts/drinks). Spread across cuisines.
STRICT mealType rules — these are ONLY for breakfast/snacks, NEVER lunch/dinner: Poha, Upma, Idli, Dosa, Uttapam, Medu Vada, Sabudana Khichdi, Poori Bhaji, Puri Bhaji, Aloo Puri, Puran Poli, Rava Dosa, Pesarattu, Appam, Puttu, Thepla, Dhokla, Khandvi, Fafda, Jalebi, Chivda, Murukku, Chakli.
Parathas (plain/stuffed) are breakfast. Khichdi is dinner/lunch. Dal Rice, Rajma Rice, Chole Bhature (chole is lunch, bhature is breakfast-adjacent), Biryani, Pulao are lunch/dinner.
JSON array format: [{"name":"X","cuisine":"X","mealType":["lunch"],"cookTime":30,"prepAhead":false,"prepNote":null,"macros":{"cal":300,"protein":10,"carbs":40,"fat":8},"whyRecommended":"short reason"}]
Return ONLY valid JSON array.`;

  try {
    const text = await callLLM(prompt, GROQ_MODEL_A);
    const suggestions = parseJSON(text);
    if (!Array.isArray(suggestions)) return [];

    return suggestions.map((s, i) => ({
      id: `ai_${Date.now()}_${i}`,
      name: s.name,
      cuisine: s.cuisine || cuisines[0] || "Pan-Indian",
      mealType: s.mealType || ["lunch"],
      cookTime: s.cookTime || 30,
      prepAhead: s.prepAhead || false,
      prepNote: s.prepNote || null,
      macros: s.macros || { cal: 300, protein: 10, carbs: 40, fat: 8 },
      extraIngredients: Math.max(0, (s.estimatedIngredients || 8) - (s.pantryMatchCount || 0)),
      whyRecommended: s.whyRecommended || null,
      imageUrl: null,
      sourceUrl: null,
      sourceName: null,
      ingredients: [],
      steps: [],
      isAIEnriched: false,
      isFavourite: false,
    }));
  } catch (err) {
    console.error("Agent A failed:", err);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT B — Recipe Fetcher (Jina Reader + Groq)
// ─────────────────────────────────────────────────────────────────────────────

const fetchViaJina = async (url) => {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/markdown" },
  });
  if (!res.ok) throw new Error(`Jina ${res.status} for ${url}`);
  const text = await res.text();
  if (!text || text.length < 200) throw new Error("Jina returned too little content");
  return text;
};

const buildCandidateUrls = (dishName, siteUrls) => {
  const slug = dishName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");

  const candidates = [];

  for (const site of siteUrls) {
    const domain = site.replace(/^https?:\/\//, "").replace(/\/$/, "");

    if (domain.includes("hebbarskitchen")) {
      candidates.push(`https://hebbarskitchen.com/${slug}-recipe/`);
      candidates.push(`https://hebbarskitchen.com/${slug}/`);
    } else if (domain.includes("vegrecipesofindia")) {
      candidates.push(`https://www.vegrecipesofindia.com/${slug}/`);
      candidates.push(`https://www.vegrecipesofindia.com/${slug}-recipe/`);
    } else if (domain.includes("indianhealthyrecipes")) {
      candidates.push(`https://www.indianhealthyrecipes.com/${slug}-recipe/`);
      candidates.push(`https://www.indianhealthyrecipes.com/${slug}/`);
    } else if (domain.includes("madhurasrecipe")) {
      candidates.push(`https://www.madhurasrecipe.com/regional-recipes/${slug}`);
      candidates.push(`https://www.madhurasrecipe.com/${slug}`);
    } else {
      candidates.push(`https://${domain}/${slug}/`);
      candidates.push(`https://${domain}/${slug}-recipe/`);
    }
  }

  return candidates;
};

export const fetchRecipeForCard = async (card, siteUrls = [], activeSiteNames = []) => {
  // ── 1. Check shared recipe DB first ──────────────────────────────────────
  try {
    const cached = await checkRecipeDB(card.name, card.cuisine, activeSiteNames);
    if (cached) {
      return {
        ...card,
        imageUrl: cached.image_url || null,
        sourceUrl: cached.source_url || null,
        sourceName: cached.source_name || null,
        ingredients: cached.ingredients || [],
        steps: cached.steps || [],
        macros: cached.macros || card.macros,
        cookTime: cached.cook_time || card.cookTime,
        prepAhead: cached.prep_ahead ?? card.prepAhead,
        prepNote: cached.prep_note || card.prepNote,
        isAIEnriched: true,
        fromCache: true,
      };
    }
  } catch (dbErr) {
    console.warn("recipe_db lookup failed, falling back to fetch:", dbErr.message);
  }

  // ── 2. Try Jina Reader on candidate URLs ─────────────────────────────────
  const candidates = buildCandidateUrls(card.name, siteUrls);
  let pageMarkdown = null;
  let sourceUrl = null;

  for (const url of candidates) {
    try {
      pageMarkdown = await fetchViaJina(url);
      sourceUrl = url;
      break;
    } catch {
      continue;
    }
  }

  if (!pageMarkdown) {
    try {
      const searchUrl = `https://s.jina.ai/${encodeURIComponent(card.name + " recipe " + card.cuisine + " Indian")}`;
      const searchRes = await fetch(searchUrl, { headers: { Accept: "text/markdown" } });
      if (searchRes.ok) {
        const searchText = await searchRes.text();
        const urlMatch = searchText.match(/https?:\/\/[^\s)]+/);
        if (urlMatch) {
          try {
            pageMarkdown = await fetchViaJina(urlMatch[0]);
            sourceUrl = urlMatch[0];
          } catch { /* fall through */ }
        }
      }
    } catch { /* fall through */ }
  }

  if (!pageMarkdown) {
    console.warn(`Agent B: no page found for "${card.name}"`);
    return { ...card, isAIEnriched: false };
  }

  // ── 3. Feed page markdown to LLM for structured extraction ───────────────
  const truncated = pageMarkdown.slice(0, 6000);

  const prompt = `Extract recipe "${card.name}" from this page content. Return JSON:
{"sourceName":"site name","imageUrl":"url or null","ingredients":[{"name":"x","quantity":"1","unit":"cups"}],"steps":["step1","step2"],"macros":{"cal":0,"protein":0,"carbs":0,"fat":0},"cookTime":30,"prepAhead":false,"prepNote":null,"servingSize":2,"dietTags":["veg"],"mealType":["lunch"]}
Use defaults from your knowledge if page data is missing. ONLY valid JSON.
---
${truncated}`;

  try {
    const text = await callGroq(prompt, GROQ_MODEL_B);
    const recipe = parseJSON(text);
    if (!recipe) return { ...card, isAIEnriched: false };

    storeInRecipeDB({
      name: card.name,
      cuisine: card.cuisine,
      sourceUrl,
      sourceName: recipe.sourceName,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      macros: recipe.macros,
      cookTime: recipe.cookTime,
      prepTime: recipe.prepTime,
      prepAhead: recipe.prepAhead,
      prepNote: recipe.prepNote,
      servingSize: recipe.servingSize,
      dietTags: recipe.dietTags || [],
      mealType: recipe.mealType || card.mealType,
    }).catch((e) => console.warn("recipe_db store failed silently:", e.message));

    return {
      ...card,
      imageUrl: recipe.imageUrl || null,
      sourceUrl: sourceUrl || null,
      sourceName: recipe.sourceName || null,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      macros: recipe.macros || card.macros,
      cookTime: recipe.cookTime || card.cookTime,
      prepAhead: recipe.prepAhead ?? card.prepAhead,
      prepNote: recipe.prepNote || card.prepNote,
      isAIEnriched: true,
      fromCache: false,
    };
  } catch (err) {
    console.error(`Agent B LLM extraction failed for ${card.name}:`, err);
    return { ...card, isAIEnriched: false };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT C — Weekly Planner
// ─────────────────────────────────────────────────────────────────────────────
export const generateWeeklyPlan = async ({
  selectedMeals,
  days,
  mealsPerDay,
  calorieTarget,
}) => {
  const mealList = selectedMeals.map((m) =>
    `${m.id}|${m.name}|${(m.mealType||["lunch"]).join("/")}|${m.macros?.cal||300}`
  ).join("\n");

  const prompt = `Arrange meals into ${days} days. Slots per day:${mealsPerDay.join(",")}.
Meals (id|name|validSlots|cal):
${mealList}
Rules: match meal to valid slot only. No repeats same day. Vary across days.${calorieTarget ? ` CalTarget:${calorieTarget}kcal.` : ""}
JSON array:[{"day":1,"slots":[{"mealType":"breakfast","mealId":"id","mealName":"name","leftoverNote":null}],"totalCalories":0,"calorieWarning":false}]
Return ONLY valid JSON array.`;

  try {
    const text = await callLLM(prompt);
    const plan = parseJSON(text);
    return Array.isArray(plan) ? plan : [];
  } catch (err) {
    console.error("Agent C failed:", err);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT D — Shopping List Generator
// ─────────────────────────────────────────────────────────────────────────────
const normaliseIngredient = (name) =>
  (name || "")
    .toLowerCase()
    .trim()
    // Pantry IDs come in as "toor_dal", "red_chilli" — treat underscores as spaces
    .replace(/_/g, " ")
    // Strip parens and their contents e.g. "hing (asafoetida)" → "hing"
    .replace(/\([^)]*\)/g, " ")
    // Common modifiers / prep words that shouldn't affect identity
    .replace(/\b(powder|pwd|masala|seeds?|leaves?|leaf|oil|paste|fresh|dried|ground|whole|raw|roasted|chopped|sliced|grated|minced|crushed|finely|coarsely|cooking|edible|organic|ripe|unripe|small|medium|large|big)\b/g, " ")
    // Colour adjectives (so "red chilli powder" → "chilli")
    .replace(/\b(red|green|yellow|white|black|brown)\b/g, " ")
    // Basic plural normalisation
    .replace(/ies\b/g, "y")        // curries → curry
    .replace(/oes\b/g, "o")        // tomatoes → tomato
    .replace(/s\b/g, "")           // onions → onion
    .replace(/\s+/g, " ")
    .trim();

// Shared synonyms — pantry word on left, LLM may call it anything on right
const PANTRY_SYNONYMS = {
  "rajma":        ["kidney bean", "red kidney bean"],
  "chana":        ["chickpea", "garbanzo", "kabuli chana"],
  "chana dal":    ["split chickpea", "bengal gram"],
  "toor dal":     ["arhar dal", "pigeon pea", "split pigeon pea"],
  "moong dal":    ["mung bean", "split mung", "green gram"],
  "masoor dal":   ["lentil", "split lentil"],
  "urad dal":     ["gram", "split gram"],
  "atta":         ["wheat flour", "whole wheat flour"],
  "besan":        ["gram flour", "chickpea flour"],
  "sooji":        ["semolina", "rava", "suji"],
  "poha":         ["flattened rice", "beaten rice"],
  "curd":         ["yogurt", "yoghurt", "dahi"],
  "paneer":       ["cottage cheese", "indian cheese"],
  "ghee":         ["clarified butter"],
  "hing":         ["asafoetida", "asafetida"],
  "jaggery":      ["gur"],
  "coriander":    ["cilantro", "dhania"],
  "chilli":       ["chili", "chile"],
  "cumin":        ["jeera"],
  "turmeric":     ["haldi"],
  "mustard":      ["rai", "sarson"],
  "curry leave":  ["kadi patta"],
  "lemon":        ["lime", "nimbu"],
};

// Is this item effectively the same as something in the pantry?
const isInPantry = (itemName, pantryNormalised) => {
  const n = normaliseIngredient(itemName);
  if (!n) return false;
  const nWords = new Set(n.split(" ").filter(Boolean));

  for (const p of pantryNormalised) {
    if (!p) continue;
    if (p === n) return true;

    // Word-level containment: every word of pantry term appears in item name.
    // Handles "tomato" vs "ripe tomato", "toor dal" vs "toor dal split" etc.
    const pWords = p.split(" ").filter(Boolean);
    if (pWords.length > 0 && pWords.every((w) => nWords.has(w))) return true;

    // Synonym check
    const syns = PANTRY_SYNONYMS[p];
    if (syns) {
      for (const s of syns) {
        const sNorm = normaliseIngredient(s);
        if (!sNorm) continue;
        if (sNorm === n) return true;
        const sWords = sNorm.split(" ").filter(Boolean);
        if (sWords.length > 0 && sWords.every((w) => nWords.has(w))) return true;
      }
    }
  }
  return false;
};

export const generateShoppingList = async ({ meals, pantry, persons = 2 }) => {
  const pantryArr = (Array.isArray(pantry) ? pantry : [])
    .map((p) => (typeof p === "string" ? p : p?.name || ""))
    .filter(Boolean);

  // Give the LLM human-readable pantry names (not "toor_dal")
  const pantryDisplay = pantryArr.map((p) => p.replace(/_/g, " ")).join(", ");
  const pantryNormalised = pantryArr.map(normaliseIngredient);

  const mealNames = meals.map((m) => m.name).join(", ");

  const prompt = `Shopping list for ${persons} people. Meals:${mealNames}
${pantryDisplay ? `PANTRY — ABSOLUTELY DO NOT include these OR any variant/synonym/plural/prep-form of them (e.g. if pantry has "tomato" skip "ripe tomato"/"tomatoes"; if pantry has "rajma" skip "kidney beans"; if pantry has "jeera" skip "cumin"): ${pantryDisplay}` : ""}
Combine duplicates. Exclude water/ice. Lowercase names. Add estimatedPriceINR = typical Indian kirana/grocery store price for that quantity (e.g. 1kg onion=40, 200g paneer=60, 1L oil=140).
JSON:[{"name":"x","quantity":"1","unit":"kg","category":"Vegetables & Greens|Dairy & Paneer|Grains & Pulses|Spices & Masalas|Oil & Condiments|Nuts & Dry Fruits|Other","estimatedPriceINR":40}]
Return ONLY valid JSON array.`;

  try {
    const text = await callLLM(prompt);
    const items = parseJSON(text);
    if (!Array.isArray(items)) return [];

    const filtered = pantryNormalised.length
      ? items.filter((item) => !isInPantry(item.name, pantryNormalised))
      : items;

    return filtered;
  } catch (err) {
    console.error("Agent D failed:", err);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT E — Meal Prep Plan Generator
// ─────────────────────────────────────────────────────────────────────────────
export const generatePrepPlan = async ({ selectedMeals, weeklyPlan }) => {
  // Build a compact meal summary — include ingredients + key steps
  const mealSummaries = (weeklyPlan || []).flatMap((day) =>
    (day.slots || []).map((slot) => {
      const meal = (selectedMeals || []).find((m) => m.id === slot.mealId);
      if (!meal) return null;
      const ingNames = (meal.ingredients || []).map((i) => i.name).join(", ");
      const stepsShort = (meal.steps || [])
        .map((s, i) => `${i + 1}. ${s}`)
        .join(" | ")
        .slice(0, 300);
      return `Day ${day.day} ${slot.mealType}: ${meal.name} (${meal.cuisine}, ${meal.cookTime}min)${
        meal.prepAhead ? ` [PREP AHEAD: ${meal.prepNote || "yes"}]` : ""
      }${ingNames ? `\n  Ingredients: ${ingNames}` : ""}${stepsShort ? `\n  Steps: ${stepsShort}` : ""}`;
    })
  ).filter(Boolean);

  const prompt = `You are a meal prep assistant for Indian home cooking. Target user: working professional who preps on weekends so weekday cooking is 15-20 min max.

MEALS THIS WEEK (Day 1 = Monday, Day 7 = Sunday):
${mealSummaries.join("\n\n")}

STRICT RULES — only include prep tasks that genuinely save weekday time:

✅ INCLUDE these types of prep:
1. CHOPPING — onions, tomatoes, ginger, garlic, vegetables. Only prep what stays fresh 3-5 days in fridge. Consolidate across meals ("Chop 6 onions total for Mon/Wed/Fri meals").
2. COOKING BASES — onion-tomato masala, gravy bases, ginger-garlic paste. MUST include actual cooking instructions (e.g. "Heat 3 tbsp oil, sauté 4 chopped onions until golden (8 min), add 3 tomatoes, cook till oil separates (5 min), blend smooth").
3. GRAVIES/CURRIES that keep 3-5 days refrigerated — only if the dish benefits from it.
4. DOUGH — roti/paratha dough lasts 2 days in fridge.
5. DRY SPICE BLENDS — only if it's a unique custom blend used in multiple dishes (not standard turmeric/salt).

❌ DO NOT INCLUDE:
- Boiling water (do it real-time)
- Soaking lentils/beans on weekend (soak overnight before the day they're used, NOT 3-4 days ahead — freshness matters)
- Marinating more than 24 hours ahead (meat/paneer deteriorates)
- Portioning salt/turmeric/basic spices (no time saved)
- Final plating portioning
- Pre-cooking rice (reheated rice is worse; cook fresh daily)
- Anything that takes under 2 min real-time

SOAKING SPECIFIC RULE:
- Rajma/chickpeas/kidney beans need 8-10 hr soak. Put soaking tasks on the EVENING BEFORE the meal day, NOT on Saturday/Sunday blanket.
- Example: Rajma used on Thursday → soak task goes in "Wednesday Evening Prep", not weekend prep.

MARINATION RULE:
- If no dish requires marination, DO NOT include a marination section at all. Skip it entirely.
- If marination is needed, put it 4-12 hours before the meal day, not on the weekend.

CONSOLIDATION RULE:
- Never suggest portioning or splitting tasks that take under 5 minutes total
- Group tasks across multiple meals: "Make 3 cups onion-tomato base (for Mon Dal, Wed Paneer, Fri Chole)"

STRUCTURE:
- Saturday = heavier cooking (bases, gravies that keep)
- Sunday = lighter (chopping, dough, preparing spice blends)
- weekdayEveningPrep = day-before soaking/marinating with specific day
- Saturday total time 45-75 min, Sunday 20-40 min
- Only include a day if it has meaningful tasks

JSON format:
{
  "weekendPrep": [
    {"day":"saturday","estimatedTime":60,"taskGroups":[
      {"category":"cook_base|chop|dough|grind|other","label":"Clear label","tasks":[
        {"id":"s1","description":"Specific task with HOW-TO instructions and quantities","estimatedMinutes":15,"forMeals":["Meal1","Meal2"],"storageNote":"Specific storage e.g. 'Fridge in airtight container, 4 days'"}
      ]}
    ]}
  ],
  "weekdayEveningPrep": [
    {"day":"wednesday","description":"Soak 1 cup rajma in 3 cups water for Thursday's Rajma Masala","estimatedMinutes":2}
  ],
  "dailyCookCards": [
    {"day":1,"dayLabel":"Monday","slots":[
      {"mealType":"lunch","mealName":"Dal Makhani","mealId":"id","estimatedCookMinutes":18,"quickSteps":["Heat prepped onion-tomato base","Add soaked dal, pressure cook 3 whistles","Temper with ghee"],"preppedItems":["Dal soaked overnight Sun","Onion-tomato base (from Sat)"]}
    ]}
  ]
}

Omit empty arrays. If no weekdayEveningPrep needed, omit the field. If Sunday has no tasks, only include Saturday in weekendPrep.
Return ONLY valid JSON. No markdown.`;

  try {
    const text = await callLLM(prompt);
    const plan = parseJSON(text);
    if (!plan || !plan.weekendPrep) return null;
    return plan;
  } catch (err) {
    console.error("Agent E (Prep Plan) failed:", err);
    return null;
  }
};
