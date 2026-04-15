import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { generateWeeklyPlan } from "../services/geminiService";

// ─── Types ────────────────────────────────────────────────────────────────────
type Meal = {
  id: string; name: string; cuisine: string; cookTime: number;
  macros?: { cal: number; protein: number; carbs: number; fat: number };
  prepAhead?: boolean; prepNote?: string | null;
  ingredients?: { name: string; quantity: string; unit: string; inPantry?: boolean }[];
  steps?: string[];
  isAIEnriched?: boolean;
};

type DayPlan = {
  day: number;
  slots: { mealType: string; mealId: string; mealName: string; leftoverNote?: string | null }[];
  totalCalories: number;
  calorieWarning: boolean;
};

const MEAL_EMOJIS: Record<string, string> = {
  breakfast: "🌅", lunch: "☀️", snacks: "🍵", dinner: "🌙",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildFallbackPlan(selectedMeals: Meal[], days: number, mealSlots: string[]): DayPlan[] {
  let mealIndex = 0;
  const meals = [...selectedMeals];
  return Array.from({ length: days }, (_, dayIdx) => {
    const slots = mealSlots.map((slotType) => {
      const meal = meals[mealIndex % meals.length];
      mealIndex++;
      return { mealType: slotType, mealId: meal?.id || "", mealName: meal?.name || "—", leftoverNote: null };
    });
    const totalCalories = slots.reduce((sum, slot) => {
      const meal = meals.find((m) => m.id === slot.mealId);
      return sum + (meal?.macros?.cal || 0);
    }, 0);
    return { day: dayIdx + 1, slots, totalCalories, calorieWarning: false };
  });
}

function getNutritionTip(totals: { cal: number; protein: number; carbs: number; fat: number }) {
  if (!totals.cal) return null;
  if (totals.protein < 25) return { icon: "💪", text: "Low on protein — consider adding dal, paneer, or curd" };
  if (totals.cal < 500) return { icon: "🍎", text: "Very light day — add a fruit or snack to meet energy needs" };
  if (totals.protein > 0 && totals.carbs / totals.protein > 6) return { icon: "🥗", text: "Carb-heavy — pair with a vegetable salad for fibre balance" };
  if (totals.fat < 8) return { icon: "🫙", text: "Low fat — a little ghee or nuts helps absorb fat-soluble vitamins" };
  return null;
}

// ─── Recipe Popup ─────────────────────────────────────────────────────────────
function RecipePopup({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  if (!meal) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        activeOpacity={1} onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: "85%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View className="h-32 bg-green-50 items-center justify-center rounded-t-3xl">
                <Text style={{ fontSize: 56 }}>🍛</Text>
              </View>
              <View className="p-6">
                <View className="flex-row items-start justify-between mb-4">
                  <View className="flex-1 mr-3">
                    <Text className="text-xl font-bold text-gray-800">{meal.name}</Text>
                    <Text className="text-sm text-gray-400 mt-0.5">
                      {meal.cuisine} · ⏱ {meal.cookTime} min
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                    <Text className="text-gray-400 text-3xl leading-none">×</Text>
                  </TouchableOpacity>
                </View>

                {/* Macros */}
                {meal.macros && (
                  <View className="flex-row gap-2 mb-5">
                    {[
                      { label: "Cal", value: meal.macros.cal },
                      { label: "Protein", value: `${meal.macros.protein}g` },
                      { label: "Carbs", value: `${meal.macros.carbs}g` },
                      { label: "Fat", value: `${meal.macros.fat}g` },
                    ].map((m) => (
                      <View key={m.label} className="flex-1 bg-gray-50 rounded-xl p-2 items-center">
                        <Text className="text-sm font-bold text-gray-700">{m.value}</Text>
                        <Text className="text-xs text-gray-400">{m.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Prep note */}
                {meal.prepAhead && meal.prepNote && (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                    <Text className="text-sm text-amber-700">🕐 <Text className="font-bold">Prep needed:</Text> {meal.prepNote}</Text>
                  </View>
                )}

                {/* Ingredients */}
                {meal.ingredients && meal.ingredients.length > 0 && (
                  <View className="mb-4">
                    <Text className="font-semibold text-gray-700 mb-2">Ingredients</Text>
                    {meal.ingredients.map((ing, i) => (
                      <View key={i} className="flex-row items-center justify-between py-1 border-b border-gray-50">
                        <Text className={`text-sm ${ing.inPantry ? "text-gray-400" : "text-gray-800"}`}>
                          {ing.inPantry ? "✓ " : "• "}{ing.name}
                        </Text>
                        <Text className="text-xs text-gray-400">{ing.quantity} {ing.unit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Steps */}
                {meal.steps && meal.steps.length > 0 && (
                  <View className="mb-4">
                    <Text className="font-semibold text-gray-700 mb-2">Method</Text>
                    {meal.steps.map((step, i) => (
                      <View key={i} className="flex-row gap-3 mb-2">
                        <View className="w-5 h-5 rounded-full bg-green-100 items-center justify-center flex-shrink-0 mt-0.5">
                          <Text className="text-xs font-bold text-green-700">{i + 1}</Text>
                        </View>
                        <Text className="text-sm text-gray-600 flex-1">{step}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!meal.isAIEnriched && (
                  <Text className="text-xs text-gray-300 mt-2">
                    Full recipe details not yet loaded for this card.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({ dayPlan, getMeal, favourites, onToggleFav, onTapMeal, calorieTarget }: {
  dayPlan: DayPlan; getMeal: (id: string) => Meal | undefined;
  favourites: Record<string, boolean>; onToggleFav: (id: string) => void;
  onTapMeal: (meal: Meal) => void; calorieTarget?: number | null;
}) {
  const dayTotals = dayPlan.slots.reduce(
    (acc, slot) => {
      const meal = getMeal(slot.mealId);
      if (!meal?.macros) return acc;
      return {
        cal: acc.cal + (Number(meal.macros.cal) || 0),
        protein: acc.protein + (Number(meal.macros.protein) || 0),
        carbs: acc.carbs + (Number(meal.macros.carbs) || 0),
        fat: acc.fat + (Number(meal.macros.fat) || 0),
      };
    },
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const tip = getNutritionTip(dayTotals);
  const hasMacros = dayTotals.protein > 0 || dayTotals.carbs > 0 || dayTotals.fat > 0;

  return (
    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4" style={{ elevation: 1 }}>
      {/* Day header */}
      <View className={`px-4 py-3 flex-row items-center justify-between ${dayPlan.calorieWarning ? "bg-red-50" : "bg-gray-50"}`}>
        <Text className="font-bold text-gray-800">Day {dayPlan.day}</Text>
        <View className="flex-row items-center gap-2">
          {dayPlan.calorieWarning && calorieTarget && (
            <View className="bg-red-100 rounded-full px-2 py-0.5">
              <Text className="text-xs text-red-500">⚠️ Over {calorieTarget} kcal</Text>
            </View>
          )}
          <Text className="text-xs font-semibold text-gray-600">{dayPlan.totalCalories} kcal</Text>
        </View>
      </View>

      {/* Meal slots */}
      {dayPlan.slots.map((slot, i) => {
        const meal = getMeal(slot.mealId);
        const isFav = !!favourites[slot.mealId];
        return (
          <TouchableOpacity
            key={i}
            onPress={() => meal && onTapMeal(meal)}
            className={`flex-row items-center gap-3 px-4 py-3 ${i < dayPlan.slots.length - 1 ? "border-b border-gray-50" : ""}`}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20 }}>{MEAL_EMOJIS[slot.mealType] || "🍽️"}</Text>
            <View className="flex-1 min-w-0">
              <Text className="text-xs text-gray-400 capitalize mb-0.5">{slot.mealType}</Text>
              <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{slot.mealName}</Text>
              {meal && (
                <Text className="text-xs text-gray-400">{meal.cuisine} · ⏱ {meal.cookTime} min</Text>
              )}
              {slot.leftoverNote && (
                <Text className="text-xs text-amber-600 mt-0.5">♻️ {slot.leftoverNote}</Text>
              )}
            </View>
            {meal?.macros?.cal ? (
              <View className="bg-orange-50 rounded-lg px-2 py-1 flex-shrink-0">
                <Text className="text-xs font-semibold text-orange-500">{meal.macros.cal} cal</Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => onToggleFav(slot.mealId)}
              className="flex-shrink-0 w-8 h-8 items-center justify-center"
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ opacity: isFav ? 1 : 0.25, fontSize: 18 }}>❤️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}

      {/* Daily macros + tip */}
      {hasMacros && (
        <View className="px-4 py-3 bg-gray-50 border-t border-gray-100 gap-2">
          <View className="flex-row gap-2">
            {[
              { label: "Protein", value: `${Math.round(dayTotals.protein)}g`, textColor: "text-blue-600",  bg: "bg-blue-50"  },
              { label: "Carbs",   value: `${Math.round(dayTotals.carbs)}g`,   textColor: "text-amber-600", bg: "bg-amber-50" },
              { label: "Fat",     value: `${Math.round(dayTotals.fat)}g`,     textColor: "text-rose-500",  bg: "bg-rose-50"  },
            ].map((m) => (
              <View key={m.label} className={`flex-1 ${m.bg} rounded-xl py-2 items-center`}>
                <Text className={`text-sm font-bold ${m.textColor}`}>{m.value}</Text>
                <Text className="text-xs text-gray-400">{m.label}</Text>
              </View>
            ))}
          </View>
          {tip && (
            <View className="flex-row items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <Text className="text-base">{tip.icon}</Text>
              <Text className="text-xs text-amber-700 flex-1">{tip.text}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({ plan, weeklySetup, onGoHome, onViewShopping }: {
  plan: DayPlan[]; weeklySetup: { days: number; meals: string[] };
  onGoHome: () => void; onViewShopping: () => void;
}) {
  const totalMeals = plan.reduce((sum, d) => sum + d.slots.length, 0);
  const avgCal = plan.length
    ? Math.round(plan.reduce((sum, d) => sum + d.totalCalories, 0) / plan.length)
    : 0;
  return (
    <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
      <Text className="text-7xl mb-5">🎉</Text>
      <Text className="text-2xl font-bold text-gray-800 mb-2">Your week is planned!</Text>
      <Text className="text-gray-400 text-sm mb-8 text-center">
        {weeklySetup.days} days · {totalMeals} meals{avgCal > 0 ? ` · ~${avgCal} kcal/day avg` : ""}
      </Text>
      <View className="w-full gap-3">
        <TouchableOpacity onPress={onGoHome}
          className="py-4 bg-green-500 rounded-2xl items-center" activeOpacity={0.8}>
          <Text className="text-white font-semibold text-base">📅 View My Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewShopping}
          className="py-3.5 border-2 border-gray-200 rounded-2xl items-center" activeOpacity={0.8}>
          <Text className="text-gray-600 font-semibold text-sm">🛒 Get Shopping List</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WeeklyPlanScreen() {
  const router = useRouter();
  const { days, meals, picks: picksJson } = useLocalSearchParams<{
    days: string; meals: string; picks: string;
  }>();

  const picksRaw: Meal[] = picksJson ? JSON.parse(picksJson) : [];
  const mealSlots = (meals || "breakfast,lunch,dinner").split(",");
  const daysNum = parseInt(days || "5");

  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState<DayPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favourites, setFavourites] = useState<Record<string, boolean>>({});
  const [popupMeal, setPopupMeal] = useState<Meal | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(prof);
    }
    await buildPlan(session);
  };

  const buildPlan = async (session: any) => {
    setLoading(true);
    try {
      const calorieTarget = session
        ? (await supabase.from("profiles").select("config").eq("id", session.user.id).maybeSingle())
            .data?.config?.calorieTarget
        : null;
      const result = await generateWeeklyPlan({
        selectedMeals: picksRaw,
        days: daysNum,
        mealsPerDay: mealSlots,
        calorieTarget: calorieTarget ? parseInt(calorieTarget) : null,
      });
      setPlan(result.length > 0 ? result : buildFallbackPlan(picksRaw, daysNum, mealSlots));
    } catch {
      setPlan(buildFallbackPlan(picksRaw, daysNum, mealSlots));
    }
    setLoading(false);
  };

  const getMeal = (mealId: string) => picksRaw.find((m) => m.id === mealId);

  const toggleFav = (mealId: string) =>
    setFavourites((p) => ({ ...p, [mealId]: !p[mealId] }));

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);

    // Save favourites to profile
    if (user) {
      const favMeals = picksRaw.filter((m) => favourites[m.id]);
      if (favMeals.length > 0) {
        const { data: prof } = await supabase.from("profiles").select("favourites").eq("id", user.id).maybeSingle();
        const existing = prof?.favourites || [];
        const merged = [...existing];
        favMeals.forEach((meal) => {
          if (!merged.some((f: any) => f.id === meal.id)) {
            merged.push({ id: meal.id, name: meal.name, cuisine: meal.cuisine });
          }
        });
        await supabase.from("profiles").update({ favourites: merged }).eq("id", user.id);
      }

      // Save plan to meal_plans
      await supabase.from("meal_plans").insert({
        user_id: user.id,
        setup: { days: daysNum, meals: mealSlots },
        selected_meals: picksRaw,
        weekly_plan: plan,
        shopping_list: null,
      });
    }

    setSaving(false);
    setSaved(true);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-4">
        <Text className="text-5xl mb-4">📅</Text>
        <Text className="text-xl font-bold text-gray-800 mb-2">Arranging your meals...</Text>
        <Text className="text-gray-400 text-sm mb-6">AI is building your optimal weekly plan</Text>
        <ActivityIndicator color="#16a34a" size="large" />
      </SafeAreaView>
    );
  }

  if (saved && plan) {
    return (
      <SuccessScreen
        plan={plan}
        weeklySetup={{ days: daysNum, meals: mealSlots }}
        onGoHome={() => router.replace("/(tabs)/plan")}
        onViewShopping={() => router.replace("/(tabs)/shopping")}
      />
    );
  }

  if (!plan) return null;

  const calorieTarget = profile?.config?.calorieTarget;
  const favCount = Object.values(favourites).filter(Boolean).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
          <Text className="text-gray-600">←</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-base font-bold text-gray-800">Your Week's Plan</Text>
          <Text className="text-xs text-gray-400">{daysNum} days · {mealSlots.length} meals/day</Text>
        </View>
        {favCount > 0 && <Text className="text-xs text-red-400">❤️ {favCount}</Text>}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}>
        <Text className="text-xs text-gray-400 text-center mb-4">Tap a meal for recipe · ❤️ to favourite</Text>
        {plan.map((dayPlan) => (
          <DayCard
            key={dayPlan.day}
            dayPlan={dayPlan}
            getMeal={getMeal as any}
            favourites={favourites}
            onToggleFav={toggleFav}
            onTapMeal={setPopupMeal}
            calorieTarget={calorieTarget}
          />
        ))}
      </ScrollView>

      {/* Recipe popup */}
      <RecipePopup meal={popupMeal} onClose={() => setPopupMeal(null)} />

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 gap-2"
        style={{ elevation: 8 }}>
        <TouchableOpacity onPress={handleSave} disabled={saving}
          className="py-4 bg-green-500 rounded-2xl items-center"
          style={{ opacity: saving ? 0.6 : 1 }} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-semibold text-base">✅ Save Plan</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/shopping")}
          className="py-3 border-2 border-gray-200 rounded-2xl items-center" activeOpacity={0.8}>
          <Text className="text-gray-600 font-semibold text-sm">🛒 View Shopping List</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
