import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { getSeedCards } from "../data/topDishes";
import { generateSuggestions } from "../services/geminiService";
import { batchCheckRecipeDB } from "../services/recipeDBService";
import { getActiveSiteUrls } from "../data/recipeSites";
import RecipePopup from "../components/RecipePopup";
import type { Meal } from "../components/RecipePopup";
import ScreenGuide from "../components/ScreenGuide";

// ─── Constants ────────────────────────────────────────────────────────────────
const BUFFER_SIZE      = 10;   // target unseen cards to keep ready per slot
const LOW_WATER_MARK   = 4;    // trigger silent background refill below this

const CUISINE_EMOJIS: Record<string, string> = {
  "North Indian": "🫕", "South Indian": "🥘", "Maharashtrian": "🍱",
  "Gujarati": "🥙", "Bengali": "🐟", "Udupi": "🌿",
  "Continental": "🍝", "Pan-Indian": "🍛",
};
const CUISINE_BG: Record<string, string[]> = {
  "North Indian":    ["#fff7ed", "#fef3c7"],
  "South Indian":    ["#f0fdf4", "#d1fae5"],
  "Maharashtrian":   ["#fffbeb", "#fef3c7"],
  "Gujarati":        ["#fefce8", "#fef9c3"],
  "Bengali":         ["#eff6ff", "#e0e7ff"],
  "Udupi":           ["#f0fdfa", "#d1fae5"],
  "Continental":     ["#f8fafc", "#dbeafe"],
  "Pan-Indian":      ["#fff1f2", "#ffe4e6"],
};
const MEAL_META: Record<string, { label: string; emoji: string }> = {
  breakfast: { label: "Breakfast", emoji: "🌅" },
  lunch:     { label: "Lunch",     emoji: "☀️"  },
  snacks:    { label: "Snacks",    emoji: "🍵" },
  dinner:    { label: "Dinner",    emoji: "🌙" },
};

type Card = {
  id: string; name: string; cuisine: string; cookTime: number;
  macros: { cal: number; protein: number; carbs: number; fat: number };
  mealType: string[]; prepAhead: boolean; prepNote: string | null;
  extraIngredients?: number; whyRecommended?: string | null;
  isAIEnriched?: boolean;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  ingredients?: any[];
  steps?: string[];
};

function buildSlotCards(cards: Card[], slots: string[]) {
  const result: Record<string, Card[]> = {};
  slots.forEach((s) => { result[s] = cards.filter((c) => c.mealType?.includes(s)); });
  return result;
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
      <Text className="text-5xl mb-4">🍳</Text>
      <ActivityIndicator color="#16a34a" />
      <Text className="text-gray-400 text-sm mt-3">Getting your meal cards…</Text>
    </SafeAreaView>
  );
}

// ─── Slot Done Screen ─────────────────────────────────────────────────────────
function SlotDoneScreen({ currentSlot, nextSlot, count, onNext }: {
  currentSlot: string; nextSlot: string | null; count: number; onNext: () => void;
}) {
  const cur = MEAL_META[currentSlot] || { label: currentSlot, emoji: "🍽️" };
  const nxt = nextSlot ? MEAL_META[nextSlot] : null;
  return (
    <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
      <Text className="text-7xl mb-4">{nextSlot ? cur.emoji : "🎉"}</Text>
      <Text className="text-2xl font-bold text-gray-800 mb-2">
        {nextSlot ? `${cur.label} done!` : "All meals picked!"}
      </Text>
      <Text className="text-gray-400 text-sm mb-8 text-center">
        {nextSlot
          ? `You picked ${count} ${cur.label.toLowerCase()} options.`
          : `${cur.label} done — ${count} options chosen. Let's review before building your plan.`}
      </Text>
      <TouchableOpacity onPress={onNext} className="w-full py-4 bg-green-500 rounded-2xl items-center" activeOpacity={0.8}>
        <Text className="text-white font-semibold text-base">
          {nextSlot ? `Pick ${nxt?.label} ${nxt?.emoji} →` : "Review my picks →"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Summary Screen ───────────────────────────────────────────────────────────
function SummaryScreen({ slotSelected, slots, onConfirm }: {
  slotSelected: Record<string, Card[]>; slots: string[];
  onConfirm: () => void;
}) {
  const allSelected = slots.flatMap((s) => slotSelected[s] || []);
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-4 border-b border-gray-100 flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-800">Your selected meals</Text>
          <Text className="text-xs text-green-600 font-medium">{allSelected.length} meals picked</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text className="text-xs text-gray-400 text-center mb-4">
          Review your picks before we build the weekly plan
        </Text>
        {slots.map((slot) => {
          const meals = slotSelected[slot] || [];
          if (!meals.length) return null;
          const meta = MEAL_META[slot] || { label: slot, emoji: "🍽️" };
          return (
            <View key={slot} className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden" style={{ elevation: 1 }}>
              <View className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex-row items-center gap-2">
                <Text>{meta.emoji}</Text>
                <Text className="text-sm font-semibold text-gray-600">{meta.label}</Text>
                <Text className="text-xs text-gray-400 ml-auto">{meals.length} meal{meals.length > 1 ? "s" : ""}</Text>
              </View>
              {meals.map((meal, i) => (
                <View key={meal.id} className={`flex-row items-center gap-3 px-4 py-3 ${i < meals.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <Text style={{ fontSize: 20 }}>{CUISINE_EMOJIS[meal.cuisine] || "🍛"}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{meal.name}</Text>
                    <Text className="text-xs text-gray-400">{meal.cuisine} · ⏱ {meal.cookTime} min · {meal.macros?.cal} kcal</Text>
                  </View>
                  <View className="w-5 h-5 rounded-full bg-green-100 items-center justify-center">
                    <Text className="text-green-600 text-xs">✓</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4" style={{ elevation: 8 }}>
        <TouchableOpacity onPress={onConfirm} className="py-4 bg-green-500 rounded-2xl items-center" activeOpacity={0.8}>
          <Text className="text-white font-semibold text-base">Build Weekly Plan →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MealCardsScreen() {
  const router = useRouter();
  const { days, meals, totalMeals } = useLocalSearchParams<{ days: string; meals: string; totalMeals: string }>();

  const slots = (meals || "breakfast,lunch,dinner").split(",");
  const daysNum = parseInt(days || "5");
  const mealsPerSlot = daysNum;

  const [profile, setProfile] = useState<any>(null);
  const [slotCards, setSlotCards] = useState<Record<string, Card[]>>({});
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [slotSelected, setSlotSelected] = useState<Record<string, Card[]>>({});
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSlotDone, setShowSlotDone] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [popupMeal, setPopupMeal] = useState<Meal | null>(null);
  const enrichedCacheRef = useRef<Record<string, Card>>({}); // cache enriched recipes

  // Buffer refill guards — stored in refs so they don't trigger re-renders
  const isRefillingRef = useRef(false);
  const profileRef = useRef<any>(null);
  const slotCardsRef = useRef<Record<string, Card[]>>({});
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Keep refs in sync with state
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { slotCardsRef.current = slotCards; }, [slotCards]);
  useEffect(() => { seenIdsRef.current = seenIds; }, [seenIds]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    initCards();
  }, []);

  const initCards = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: prof } = session
      ? await supabase.from("profiles").select("config, pantry").eq("id", session.user.id).maybeSingle()
      : { data: null };
    setProfile(prof);
    profileRef.current = prof;

    const cuisines = prof?.config?.cuisines || ["Pan-Indian"];
    const diet = prof?.config?.diet || "veg";
    const total = parseInt(totalMeals || "15");

    // Seed cards immediately — enough for initial buffer
    const seed = getSeedCards(cuisines, diet, Math.max(total, BUFFER_SIZE * slots.length));
    const seedBySlot = buildSlotCards(seed, slots);
    setSlotCards(seedBySlot);
    slotCardsRef.current = seedBySlot;
    setIsLoading(false);

    // Pre-fetch cached recipe images (fire-and-forget, no blocking)
    try {
      const siteUrls = getActiveSiteUrls(prof);
      const siteNames = siteUrls.map((u: string) =>
        u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")
      );
      const cached = await batchCheckRecipeDB(seed, siteNames);
      if (cached && Object.keys(cached).length > 0) {
        // Store enriched versions in cache ref for image display + instant popup
        Object.entries(cached).forEach(([key, recipe]: [string, any]) => {
          const card = seed.find((c: Card) => c.name.toLowerCase() === key);
          if (card && recipe) {
            enrichedCacheRef.current[card.id] = {
              ...card,
              imageUrl: recipe.image_url || null,
              sourceUrl: recipe.source_url || null,
              sourceName: recipe.source_name || null,
              ingredients: recipe.ingredients || [],
              steps: recipe.steps || [],
              macros: recipe.macros || card.macros,
              cookTime: recipe.cook_time || card.cookTime,
              isAIEnriched: true,
            };
          }
        });
      }
    } catch { /* non-critical — cards still work without images */ }

    // AI suggestions in background — prepend personalised cards without disruption
    try {
      const aiCards = await generateSuggestions({
        cuisines, diet,
        pantry: prof?.pantry || [],
        persons: prof?.config?.persons || 2,
        days: daysNum,
        mealsPerDay: slots,
        calorieTarget: prof?.config?.calorieTarget || null,
        alreadySeen: seed.map((c: Card) => c.name),
      });
      if (aiCards.length > 0) {
        const aiBySlot = buildSlotCards(aiCards, slots);
        setSlotCards((prev) => {
          const updated: Record<string, Card[]> = {};
          slots.forEach((s) => {
            const existingNames = new Set((prev[s] || []).map((c) => c.name.toLowerCase()));
            const fresh = (aiBySlot[s] || []).filter((c: Card) => !existingNames.has(c.name.toLowerCase()));
            updated[s] = [...fresh, ...(prev[s] || [])];
          });
          return updated;
        });
        setAiToast("✨ AI added personalised suggestions");
        setTimeout(() => setAiToast(null), 4000);
      }
    } catch { /* seed cards are the fallback */ }
  };

  // ── Silent background buffer refill ────────────────────────────────────────
  const refillBuffer = async (slot: string) => {
    if (isRefillingRef.current) return;
    isRefillingRef.current = true;

    const prof = profileRef.current;
    const cuisines = prof?.config?.cuisines || ["Pan-Indian"];
    const diet = prof?.config?.diet || "veg";

    // Collect every name we've already loaded for this slot (seen + unseen) to avoid dupes
    const existing = slotCardsRef.current[slot] || [];
    const alreadySeen = existing.map((c) => c.name);

    let more: Card[] = [];
    try {
      more = await generateSuggestions({
        cuisines, diet,
        pantry: prof?.pantry || [],
        persons: prof?.config?.persons || 2,
        days: daysNum,
        mealsPerDay: [slot],
        calorieTarget: prof?.config?.calorieTarget || null,
        alreadySeen,
      });
    } catch { /* ignore — try seed fallback */ }

    // Seed fallback if AI returns nothing
    if (!more.length) {
      more = getSeedCards(cuisines, diet, BUFFER_SIZE + 5, alreadySeen)
        .filter((c: Card) => c.mealType?.includes(slot));
    }

    if (more.length > 0) {
      setSlotCards((prev) => {
        const prevSlot = prev[slot] || [];
        const existingNames = new Set(prevSlot.map((c) => c.name.toLowerCase()));
        const fresh = more.filter((c: Card) => !existingNames.has(c.name.toLowerCase()));
        return { ...prev, [slot]: [...prevSlot, ...fresh] };
      });
    }

    isRefillingRef.current = false;
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentSlot = slots[currentSlotIdx];
  const currentSlotCards = slotCards[currentSlot] || [];
  const availableCards = currentSlotCards.filter((c) => !seenIds.has(c.id));
  const currentCard = availableCards[0] || null;
  const currentSlotSelected = slotSelected[currentSlot] || [];
  const allSelected = slots.flatMap((s) => slotSelected[s] || []);
  const progress = Math.min((currentSlotSelected.length / mealsPerSlot) * 100, 100);

  const animateCardOut = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleSwipe = (direction: "left" | "right") => {
    if (!currentCard) return;
    const card = currentCard;

    animateCardOut(() => {
      // Mark seen
      const newSeenIds = new Set([...seenIdsRef.current, card.id]);
      setSeenIds(newSeenIds);
      seenIdsRef.current = newSeenIds;

      if (direction === "right") {
        const newSelected = [...currentSlotSelected, card];
        setSlotSelected((prev) => ({ ...prev, [currentSlot]: newSelected }));
        if (newSelected.length >= mealsPerSlot) {
          setShowSlotDone(true);
          return;
        }
      }

      // ── Buffer check: silently refill if running low ──────────────────────
      const remaining = (slotCardsRef.current[currentSlot] || [])
        .filter((c) => !newSeenIds.has(c.id)).length;
      if (remaining <= LOW_WATER_MARK) {
        // fire-and-forget — no UI change, no spinner
        refillBuffer(currentSlot);
      }
    });
  };

  const advanceToNextSlot = () => {
    fadeAnim.setValue(1); // ensure first card of next slot isn't stuck at 0 opacity
    if (currentSlotIdx + 1 >= slots.length) {
      setShowSlotDone(false);
      setShowSummary(true);
    } else {
      setCurrentSlotIdx((p) => p + 1);
      setShowSlotDone(false);
    }
  };

  const handleCardTap = () => {
    if (!currentCard) return;
    // If we have a cached enriched version, use that
    const cached = enrichedCacheRef.current[currentCard.id];
    setPopupMeal((cached || currentCard) as Meal);
  };

  const handleRecipeEnriched = (enriched: Meal) => {
    // Cache the enriched card so re-tapping is instant
    enrichedCacheRef.current[enriched.id] = enriched as Card;
  };

  const handleConfirm = () => {
    router.push({ pathname: "/weekly-plan", params: { days, meals, picks: JSON.stringify(allSelected) } });
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (isLoading) return <LoadingScreen />;

  if (showSlotDone) return (
    <SlotDoneScreen
      currentSlot={currentSlot}
      nextSlot={currentSlotIdx + 1 < slots.length ? slots[currentSlotIdx + 1] : null}
      count={currentSlotSelected.length}
      onNext={advanceToNextSlot}
    />
  );

  if (showSummary) return (
    <SummaryScreen slotSelected={slotSelected} slots={slots} onConfirm={handleConfirm} />
  );

  // ── Main card UI ──────────────────────────────────────────────────────────
  const meta = MEAL_META[currentSlot] || { label: currentSlot, emoji: "🍽️" };
  const cardEmoji = currentCard ? (CUISINE_EMOJIS[currentCard.cuisine] || "🍛") : "";
  const [bg1] = currentCard ? (CUISINE_BG[currentCard.cuisine] || ["#f0fdf4", "#d1fae5"]) : ["#f9fafb", "#f3f4f6"];
  const cachedCard = currentCard ? enrichedCacheRef.current[currentCard.id] : null;
  const cardImageUrl = cachedCard?.imageUrl || null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenGuide
        screenKey="mealCards"
        emoji="🍽️"
        title="Choose Your Meals"
        points={[
          "Swipe through AI-suggested meals tailored to your diet & cuisines.",
          "Tap ✓ to pick a meal or ✗ to skip — pick one for each slot.",
          "Tap the card for full recipe, ingredients & nutrition info.",
          "Tap ★ to favourite a meal so it shows up more often.",
        ]}
      />
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-3 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <Text className="text-gray-600">←</Text>
          </TouchableOpacity>
          <Text className="text-sm font-semibold text-gray-600">
            {currentSlotSelected.length} / {mealsPerSlot} {meta.label.toLowerCase()} picked
          </Text>
          <View className="w-9" />
        </View>

        {/* Slot tabs */}
        <View className="flex-row justify-center gap-2 mb-3">
          {slots.map((slot, i) => {
            const m = MEAL_META[slot] || { label: slot, emoji: "🍽️" };
            const done = i < currentSlotIdx;
            const active = i === currentSlotIdx;
            return (
              <View key={slot} className={`flex-row items-center gap-1 px-3 py-1 rounded-full ${
                done ? "bg-green-100" : active ? "bg-green-500" : "bg-gray-100"}`}>
                <Text style={{ fontSize: 12 }}>{done ? "✓" : m.emoji}</Text>
                <Text className={`text-xs font-medium ${done ? "text-green-600" : active ? "text-white" : "text-gray-400"}`}>
                  {m.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Progress bar */}
        <View className="w-full bg-gray-100 rounded-full h-1.5">
          <View className="bg-green-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
        </View>
      </View>

      {/* AI toast */}
      {aiToast && (
        <View className="bg-green-50 border-b border-green-200 py-2 px-4 items-center">
          <Text className="text-green-700 text-xs font-medium">{aiToast}</Text>
        </View>
      )}

      {/* Card area */}
      <View className="flex-1 items-center justify-center px-5">
        {currentCard ? (
          <>
            {/* Stack effect — ghost cards behind the main one */}
            {availableCards[2] && (
              <View className="absolute bg-white rounded-3xl border border-gray-100 left-5 right-5"
                style={{ top: 40, bottom: 130, transform: [{ scale: 0.9 }], elevation: 1 }} />
            )}
            {availableCards[1] && (
              <View className="absolute bg-white rounded-3xl border border-gray-100 left-5 right-5"
                style={{ top: 30, bottom: 120, transform: [{ scale: 0.95 }], elevation: 2 }} />
            )}

            {/* Main card — tap body for recipe, buttons for skip/add */}
            <Animated.View className="w-full bg-white rounded-3xl border border-gray-100 overflow-hidden"
              style={{ opacity: fadeAnim, elevation: 4 }}>
              <TouchableOpacity onPress={handleCardTap} activeOpacity={0.9}>
                {/* Cuisine header — food photo if cached, emoji fallback */}
                <View className="h-44 items-center justify-center" style={{ backgroundColor: bg1, overflow: "hidden" }}>
                  {cardImageUrl ? (
                    <Image
                      source={{ uri: cardImageUrl }}
                      style={{ width: "100%", height: 176 }}
                      contentFit="cover"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Text style={{ fontSize: 64 }}>{cardEmoji}</Text>
                  )}
                </View>

                {/* Card body */}
                <View className="p-5">
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="text-xl font-bold text-gray-800 flex-1 mr-2" numberOfLines={2}>
                      {currentCard.name}
                    </Text>
                    {currentCard.prepAhead && <Text className="text-amber-500 text-lg">🕐</Text>}
                  </View>

                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="bg-green-50 rounded-full px-2 py-0.5">
                      <Text className="text-xs text-green-700">{currentCard.cuisine}</Text>
                    </View>
                    <Text className="text-xs text-gray-400">⏱ {currentCard.cookTime} min</Text>
                  </View>

                  {/* Macros */}
                  <View className="flex-row gap-2 mb-3">
                    {[
                      { label: "Cal",  value: currentCard.macros?.cal },
                      { label: "Pro",  value: `${currentCard.macros?.protein}g` },
                      { label: "Carb", value: `${currentCard.macros?.carbs}g` },
                      { label: "Fat",  value: `${currentCard.macros?.fat}g` },
                    ].map((m) => (
                      <View key={m.label} className="flex-1 bg-gray-50 rounded-xl p-2 items-center">
                        <Text className="text-sm font-bold text-gray-700">{m.value}</Text>
                        <Text className="text-xs text-gray-400">{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  {currentCard.whyRecommended ? (
                    <Text className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full self-start">
                      ✦ {currentCard.whyRecommended}
                    </Text>
                  ) : currentCard.extraIngredients ? (
                    <Text className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full self-start">
                      🛒 +{currentCard.extraIngredients} extra ingredients
                    </Text>
                  ) : null}

                  {/* Tap hint */}
                  <Text style={{ fontSize: 11, color: "#d1d5db", textAlign: "center", marginTop: 10 }}>
                    Tap card to view full recipe
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Skip / Add buttons */}
            <View className="flex-row gap-3 mt-5 w-full">
              <TouchableOpacity onPress={() => handleSwipe("left")}
                className="flex-1 py-4 bg-white border-2 border-red-200 rounded-2xl items-center" activeOpacity={0.8}>
                <Text className="text-red-400 font-semibold">✕  Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSwipe("right")}
                className="flex-1 py-4 bg-green-500 rounded-2xl items-center" activeOpacity={0.8}
                style={{ elevation: 2 }}>
                <Text className="text-white font-semibold">✓  Add to plan</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // Shouldn't normally show — buffer refill should keep cards ready
          <View className="items-center">
            <ActivityIndicator color="#16a34a" />
            <Text className="text-gray-400 text-sm mt-3">Finding more options…</Text>
          </View>
        )}
      </View>

      {/* Recipe popup — fetches full recipe on demand */}
      <RecipePopup
        meal={popupMeal}
        profile={profile}
        onClose={() => setPopupMeal(null)}
        onEnriched={handleRecipeEnriched}
      />
    </SafeAreaView>
  );
}
