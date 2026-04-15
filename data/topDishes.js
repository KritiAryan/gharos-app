// Pre-fetched top dishes per cuisine
// These load instantly before AI kicks in
// Macros and cook times are estimates — AI will enrich these later

export const TOP_DISHES = {
  "North Indian": [
    { name: "Dal Makhani", cookTime: 45, prepAhead: true, prepNote: "Soak rajma overnight", macros: { cal: 320, protein: 14, carbs: 42, fat: 10 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Paneer Butter Masala", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 380, protein: 18, carbs: 22, fat: 24 }, extraIngredients: 4, mealType: ["lunch", "dinner"] },
    { name: "Chole Bhature", cookTime: 40, prepAhead: true, prepNote: "Soak chana overnight", macros: { cal: 520, protein: 16, carbs: 68, fat: 20 }, extraIngredients: 5, mealType: ["breakfast", "lunch"] },
    { name: "Aloo Paratha", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 7, carbs: 44, fat: 9 }, extraIngredients: 2, mealType: ["breakfast"] },
    { name: "Rajma Chawal", cookTime: 50, prepAhead: true, prepNote: "Soak rajma overnight", macros: { cal: 420, protein: 18, carbs: 62, fat: 8 }, extraIngredients: 3, mealType: ["lunch"] },
    { name: "Palak Paneer", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 290, protein: 16, carbs: 14, fat: 20 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Kadhi Pakora", cookTime: 35, prepAhead: false, prepNote: null, macros: { cal: 260, protein: 9, carbs: 32, fat: 11 }, extraIngredients: 4, mealType: ["lunch"] },
    { name: "Jeera Rice", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 4, carbs: 44, fat: 4 }, extraIngredients: 1, mealType: ["lunch", "dinner"] },
    { name: "Matar Paneer", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 310, protein: 14, carbs: 20, fat: 18 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Poori Sabzi", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 380, protein: 8, carbs: 52, fat: 16 }, extraIngredients: 3, mealType: ["breakfast"] },
  ],
  "South Indian": [
    { name: "Masala Dosa", cookTime: 30, prepAhead: true, prepNote: "Ferment batter overnight", macros: { cal: 340, protein: 8, carbs: 58, fat: 9 }, extraIngredients: 4, mealType: ["breakfast"] },
    { name: "Idli Sambar", cookTime: 20, prepAhead: true, prepNote: "Ferment batter overnight", macros: { cal: 220, protein: 7, carbs: 42, fat: 3 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Rasam Rice", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 240, protein: 5, carbs: 48, fat: 4 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Sambar Rice", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 320, protein: 10, carbs: 56, fat: 6 }, extraIngredients: 4, mealType: ["lunch"] },
    { name: "Curd Rice", cookTime: 10, prepAhead: false, prepNote: null, macros: { cal: 260, protein: 8, carbs: 44, fat: 6 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Uttapam", cookTime: 20, prepAhead: true, prepNote: "Ferment batter overnight", macros: { cal: 280, protein: 7, carbs: 48, fat: 7 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Pongal", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 300, protein: 9, carbs: 50, fat: 8 }, extraIngredients: 2, mealType: ["breakfast"] },
    { name: "Avial", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 4, carbs: 22, fat: 9 }, extraIngredients: 5, mealType: ["lunch"] },
    { name: "Medu Vada", cookTime: 25, prepAhead: true, prepNote: "Soak urad dal 4 hrs", macros: { cal: 220, protein: 8, carbs: 28, fat: 9 }, extraIngredients: 3, mealType: ["breakfast", "snacks"] },
    { name: "Bisibelebath", cookTime: 45, prepAhead: false, prepNote: null, macros: { cal: 360, protein: 11, carbs: 58, fat: 10 }, extraIngredients: 6, mealType: ["lunch"] },
  ],
  "Maharashtrian": [
    { name: "Misal Pav", cookTime: 35, prepAhead: true, prepNote: "Sprout moth beans 2 days prior", macros: { cal: 380, protein: 14, carbs: 58, fat: 10 }, extraIngredients: 5, mealType: ["breakfast", "lunch"] },
    { name: "Varan Bhaat", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 320, protein: 12, carbs: 56, fat: 6 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Puran Poli", cookTime: 45, prepAhead: false, prepNote: null, macros: { cal: 340, protein: 9, carbs: 62, fat: 8 }, extraIngredients: 3, mealType: ["breakfast", "lunch"] },
    { name: "Kande Pohe", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 5, carbs: 38, fat: 6 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Sabudana Khichdi", cookTime: 20, prepAhead: true, prepNote: "Soak sabudana overnight", macros: { cal: 300, protein: 5, carbs: 52, fat: 9 }, extraIngredients: 3, mealType: ["breakfast", "snacks"] },
    { name: "Bharli Vangi", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 5, carbs: 22, fat: 9 }, extraIngredients: 6, mealType: ["lunch", "dinner"] },
    { name: "Pav Bhaji", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 420, protein: 10, carbs: 62, fat: 14 }, extraIngredients: 4, mealType: ["lunch", "snacks"] },
    { name: "Solkadhi", cookTime: 10, prepAhead: false, prepNote: null, macros: { cal: 80, protein: 2, carbs: 8, fat: 4 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Thalipeeth", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 260, protein: 8, carbs: 42, fat: 7 }, extraIngredients: 4, mealType: ["breakfast"] },
    { name: "Ukdiche Modak", cookTime: 40, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 3, carbs: 34, fat: 4 }, extraIngredients: 4, mealType: ["snacks"] },
  ],
  "Gujarati": [
    { name: "Dhokla", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 8, carbs: 28, fat: 4 }, extraIngredients: 3, mealType: ["breakfast", "snacks"] },
    { name: "Thepla", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 6, carbs: 36, fat: 7 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Undhiyu", cookTime: 50, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 8, carbs: 38, fat: 11 }, extraIngredients: 8, mealType: ["lunch"] },
    { name: "Dal Dhokli", cookTime: 35, prepAhead: false, prepNote: null, macros: { cal: 340, protein: 12, carbs: 54, fat: 8 }, extraIngredients: 4, mealType: ["lunch"] },
    { name: "Handvo", cookTime: 40, prepAhead: true, prepNote: "Ferment batter 6 hrs", macros: { cal: 260, protein: 9, carbs: 38, fat: 8 }, extraIngredients: 5, mealType: ["breakfast", "snacks"] },
    { name: "Khandvi", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 160, protein: 7, carbs: 18, fat: 6 }, extraIngredients: 3, mealType: ["snacks"] },
    { name: "Sev Tameta", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 4, carbs: 24, fat: 8 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Gujarati Kadhi", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 140, protein: 5, carbs: 16, fat: 6 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Methi Muthia", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 7, carbs: 28, fat: 7 }, extraIngredients: 4, mealType: ["snacks"] },
    { name: "Batata Vada", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 240, protein: 5, carbs: 34, fat: 10 }, extraIngredients: 3, mealType: ["snacks"] },
  ],
  "Bengali": [
    { name: "Macher Jhol", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 24, carbs: 12, fat: 14 }, extraIngredients: 4, mealType: ["lunch"] },
    { name: "Aloo Posto", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 5, carbs: 28, fat: 11 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Shorshe Ilish", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 320, protein: 26, carbs: 8, fat: 18 }, extraIngredients: 3, mealType: ["lunch"] },
    { name: "Cholar Dal", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 14, carbs: 38, fat: 8 }, extraIngredients: 4, mealType: ["lunch", "dinner"] },
    { name: "Luchi Alur Dom", cookTime: 35, prepAhead: false, prepNote: null, macros: { cal: 420, protein: 8, carbs: 58, fat: 18 }, extraIngredients: 4, mealType: ["breakfast"] },
    { name: "Begun Bhaja", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 160, protein: 3, carbs: 14, fat: 10 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Mishti Doi", cookTime: 10, prepAhead: true, prepNote: "Set overnight", macros: { cal: 140, protein: 5, carbs: 22, fat: 4 }, extraIngredients: 2, mealType: ["snacks"] },
    { name: "Khichuri", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 340, protein: 12, carbs: 56, fat: 8 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Sandesh", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 6, carbs: 26, fat: 6 }, extraIngredients: 2, mealType: ["snacks"] },
    { name: "Doi Maach", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 260, protein: 22, carbs: 10, fat: 14 }, extraIngredients: 4, mealType: ["lunch"] },
  ],
  "Udupi": [
    { name: "Neer Dosa", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 180, protein: 4, carbs: 36, fat: 3 }, extraIngredients: 1, mealType: ["breakfast"] },
    { name: "Bisi Bele Bath", cookTime: 45, prepAhead: false, prepNote: null, macros: { cal: 360, protein: 11, carbs: 58, fat: 10 }, extraIngredients: 6, mealType: ["lunch"] },
    { name: "Mangalore Buns", cookTime: 25, prepAhead: true, prepNote: "Ferment batter 4 hrs", macros: { cal: 240, protein: 5, carbs: 42, fat: 7 }, extraIngredients: 2, mealType: ["breakfast"] },
    { name: "Udupi Sambar", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 140, protein: 6, carbs: 20, fat: 4 }, extraIngredients: 5, mealType: ["lunch", "dinner"] },
    { name: "Konkani Fish Curry", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 22, carbs: 12, fat: 16 }, extraIngredients: 5, mealType: ["lunch"] },
    { name: "Pathrode", cookTime: 40, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 5, carbs: 30, fat: 7 }, extraIngredients: 4, mealType: ["snacks"] },
    { name: "Kadala Curry", cookTime: 35, prepAhead: true, prepNote: "Soak chana overnight", macros: { cal: 260, protein: 12, carbs: 36, fat: 8 }, extraIngredients: 4, mealType: ["breakfast", "lunch"] },
    { name: "Akki Roti", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 4, carbs: 40, fat: 5 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Kootu Curry", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 7, carbs: 26, fat: 9 }, extraIngredients: 5, mealType: ["lunch"] },
    { name: "Papadam Curry", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 160, protein: 4, carbs: 18, fat: 8 }, extraIngredients: 3, mealType: ["dinner"] },
  ],
  "Continental": [
    { name: "Veggie Pasta", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 380, protein: 12, carbs: 62, fat: 10 }, extraIngredients: 4, mealType: ["lunch", "dinner"] },
    { name: "Mushroom Soup", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 160, protein: 6, carbs: 14, fat: 9 }, extraIngredients: 3, mealType: ["dinner"] },
    { name: "Veg Sandwich", cookTime: 10, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 9, carbs: 42, fat: 8 }, extraIngredients: 4, mealType: ["breakfast", "snacks"] },
    { name: "Oats Porridge", cookTime: 10, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 7, carbs: 34, fat: 5 }, extraIngredients: 2, mealType: ["breakfast"] },
    { name: "Veg Fried Rice", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 340, protein: 8, carbs: 58, fat: 9 }, extraIngredients: 4, mealType: ["lunch"] },
    { name: "Tomato Soup", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 120, protein: 3, carbs: 18, fat: 5 }, extraIngredients: 2, mealType: ["dinner"] },
    { name: "Veg Burger", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 420, protein: 12, carbs: 58, fat: 14 }, extraIngredients: 5, mealType: ["lunch", "snacks"] },
    { name: "French Toast", cookTime: 10, prepAhead: false, prepNote: null, macros: { cal: 260, protein: 9, carbs: 34, fat: 10 }, extraIngredients: 2, mealType: ["breakfast"] },
    { name: "Stuffed Capsicum", cookTime: 30, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 8, carbs: 28, fat: 9 }, extraIngredients: 4, mealType: ["dinner"] },
    { name: "Veg Noodles", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 320, protein: 8, carbs: 54, fat: 8 }, extraIngredients: 4, mealType: ["lunch"] },
  ],
  "Pan-Indian": [
    { name: "Khichdi", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 300, protein: 10, carbs: 52, fat: 6 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Upma", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 220, protein: 5, carbs: 36, fat: 7 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Poha", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 4, carbs: 36, fat: 5 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Dal Tadka", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 260, protein: 13, carbs: 36, fat: 7 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Aloo Sabzi", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 4, carbs: 34, fat: 6 }, extraIngredients: 3, mealType: ["lunch", "dinner"] },
    { name: "Roti Sabzi", cookTime: 20, prepAhead: false, prepNote: null, macros: { cal: 280, protein: 8, carbs: 46, fat: 7 }, extraIngredients: 2, mealType: ["lunch", "dinner"] },
    { name: "Sprouts Salad", cookTime: 10, prepAhead: true, prepNote: "Sprout moong 2 days prior", macros: { cal: 140, protein: 8, carbs: 20, fat: 3 }, extraIngredients: 3, mealType: ["breakfast", "snacks"] },
    { name: "Besan Chilla", cookTime: 15, prepAhead: false, prepNote: null, macros: { cal: 200, protein: 9, carbs: 26, fat: 6 }, extraIngredients: 3, mealType: ["breakfast"] },
    { name: "Vegetable Pulao", cookTime: 25, prepAhead: false, prepNote: null, macros: { cal: 300, protein: 7, carbs: 52, fat: 7 }, extraIngredients: 4, mealType: ["lunch"] },
    { name: "Masala Chai", cookTime: 10, prepAhead: false, prepNote: null, macros: { cal: 80, protein: 2, carbs: 12, fat: 3 }, extraIngredients: 2, mealType: ["snacks"] },
  ],
};

// Fisher-Yates shuffle — different order every call
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const NON_VEG_DISHES = new Set([
  "Macher Jhol", "Shorshe Ilish", "Doi Maach", "Konkani Fish Curry",
]);

// Get seed cards for a user based on their cuisine preferences.
// alreadySeen: string[] of dish names already shown — these are excluded.
// Returns up to totalNeeded * 1.5 cards, shuffled for variety.
export const getSeedCards = (cuisines = [], dietPreference = "veg", totalNeeded = 20, alreadySeen = []) => {
  const seenSet = new Set(alreadySeen.map((n) => n.toLowerCase()));
  // Guarantee at least 2 per cuisine so tiny plans still get variety
  const perCuisine = Math.max(2, Math.ceil((totalNeeded * 1.5) / (cuisines.length || 1)));

  const cards = [];

  cuisines.forEach((cuisine) => {
    const dishes = TOP_DISHES[cuisine] || TOP_DISHES["Pan-Indian"];

    const filtered = (dietPreference === "veg" || dietPreference === "jain")
      ? dishes.filter((d) => !NON_VEG_DISHES.has(d.name))
      : dishes;

    // Shuffle so repeated calls give different order
    const available = shuffle(filtered).filter(
      (d) => !seenSet.has(d.name.toLowerCase())
    );

    available.slice(0, perCuisine).forEach((dish) => {
      cards.push({
        id: `seed_${dish.name.replace(/\s+/g, "_").toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`,
        name: dish.name,
        cuisine,
        cookTime: dish.cookTime,
        prepAhead: dish.prepAhead,
        prepNote: dish.prepNote,
        macros: dish.macros,
        extraIngredients: dish.extraIngredients,
        mealType: dish.mealType,
        imageUrl: null,
        sourceUrl: null,
        sourceName: null,
        isAIEnriched: false,
        isFavourite: false,
      });
    });
  });

  // Shuffle the combined result across cuisines too
  return shuffle(cards).slice(0, Math.ceil(totalNeeded * 1.5));
};
