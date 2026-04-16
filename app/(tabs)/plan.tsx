import { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import RecipePopup from "../../components/RecipePopup";
import ScreenGuide from "../../components/ScreenGuide";

// ─── Types ────────────────────────────────────────────────────────────────────
type Slot = { mealType: string; mealId: string; mealName: string; leftoverNote?: string | null };
type DayPlan = { day: number; slots: Slot[]; totalCalories: number; calorieWarning: boolean };
type Plan = {
  id: string; created_at: string;
  setup: { days: number; meals: string[] };
  selected_meals: any[]; weekly_plan: DayPlan[];
  prep_plan?: any;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const MEAL_EMOJIS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", snacks: "🍵", dinner: "🌙" };
const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", snacks: "Snacks", dinner: "Dinner" };

const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", emoji: "🌅", time: "8:00 AM" },
  { id: "lunch",     label: "Lunch",     emoji: "☀️",  time: "1:00 PM" },
  { id: "snacks",    label: "Snacks",    emoji: "🍵",  time: "4:00 PM" },
  { id: "dinner",    label: "Dinner",    emoji: "🌙",  time: "8:00 PM" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPlanDayDate(createdAt: string, day: number) {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + day - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayLabel(date: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return null;
}

function formatDayDate(date: Date) {
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

function isPlanActive(plan: Plan) {
  const endDate = new Date(plan.created_at);
  endDate.setDate(endDate.getDate() + (plan.setup?.days || 1));
  endDate.setHours(23, 59, 59, 999);
  return new Date() <= endDate;
}

// ─── Setup Wizard (no active plan) ───────────────────────────────────────────
const DAY_RANGE_LABEL = (days: number) => {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return days === 1 ? `Today · ${fmt(start)}` : `${fmt(start)} – ${fmt(end)}`;
};

function SetupWizard() {
  const router = useRouter();
  const [days, setDays] = useState(5);
  const [meals, setMeals] = useState(["breakfast", "lunch", "dinner"]);

  const toggleMeal = (id: string) =>
    setMeals((prev) =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter((x) => x !== id) : prev
        : [...prev, id]
    );

  const totalMeals = days * meals.length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenGuide
        screenKey="plan"
        emoji="🗓️"
        title="Plan Your Week"
        points={[
          "Pick how many days & which meals you want planned (breakfast, lunch, snacks, dinner).",
          "We'll suggest meals based on your diet, cuisines & what's in your pantry.",
          "On the next screen, swipe through suggestions and favourite the ones you like.",
          "Saving your plan auto-generates a shopping list + weekend prep guide.",
        ]}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 mt-2">
          <Text className="text-2xl font-bold text-gray-800">🗓️ Plan Your Week</Text>
          <Text className="text-sm text-gray-400 mt-1">
            Choose how many days and which meals to plan
          </Text>
        </View>

        {/* Days selector */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4" style={{ elevation: 1 }}>
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            How many days?
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d)}
                className={`w-12 h-12 rounded-xl border-2 items-center justify-center ${
                  days === d ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"
                }`}
                activeOpacity={0.7}
              >
                <Text className={`font-semibold text-sm ${days === d ? "text-green-700" : "text-gray-500"}`}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text className="text-sm font-medium text-green-700 mt-3">
            {DAY_RANGE_LABEL(days)}
          </Text>
        </View>

        {/* Meal slots */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4" style={{ elevation: 1 }}>
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Which meals?
          </Text>
          <View className="gap-3">
            {MEAL_SLOTS.map((m) => {
              const active = meals.includes(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => toggleMeal(m.id)}
                  className={`flex-row items-center px-4 py-3 rounded-xl border-2 ${
                    active ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}
                  style={{ opacity: active ? 1 : 0.5 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{m.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`text-sm font-semibold ${active ? "text-green-700" : "text-gray-500"}`}>
                      {m.label}
                    </Text>
                    <Text className="text-xs text-gray-400">{m.time}</Text>
                  </View>
                  {active && <Text className="text-green-500 font-bold">✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className="text-xs text-gray-400 mt-3">At least 1 meal required</Text>
        </View>

        {/* Summary */}
        <View className="bg-green-50 border-2 border-green-200 rounded-2xl p-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-green-700 font-medium">Your plan</Text>
              <Text className="text-green-600 text-sm mt-1">
                {days} days × {meals.length} meals/day
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-4xl font-bold text-green-600">{totalMeals}</Text>
              <Text className="text-xs text-green-500">meals to plan</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4"
        style={{ elevation: 8 }}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/meal-cards",
              params: { days: String(days), meals: meals.join(","), totalMeals: String(days * meals.length) },
            })
          }
          className="py-4 bg-green-500 rounded-2xl items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">Show me meal cards 🍽️</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Active Plan Viewer with swap ─────────────────────────────────────────────
function ActivePlanView({ plan, onNewPlan }: { plan: Plan; onNewPlan: () => void }) {
  const router = useRouter();
  // weeklyPlan is mutable — we deep-clone it so edits don't mutate prop
  const [weeklyPlan, setWeeklyPlan] = useState<DayPlan[]>(() =>
    JSON.parse(JSON.stringify(plan.weekly_plan || []))
  );
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => {
    // Auto-expand today and tomorrow
    const today = new Date(); today.setHours(0,0,0,0);
    const defaultExpanded = new Set<number>();
    (plan.weekly_plan || []).forEach((d) => {
      const date = getPlanDayDate(plan.created_at, d.day);
      const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= 1) defaultExpanded.add(d.day);
    });
    if (defaultExpanded.size === 0) defaultExpanded.add(1);
    return defaultExpanded;
  });

  // Swap state: {day, slotIndex} of first selected slot
  const [swapMode, setSwapMode] = useState(false);
  const [swapFrom, setSwapFrom] = useState<{ day: number; slotIndex: number } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [popupMeal, setPopupMeal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Load profile for recipe fetching
  useState(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("config, pantry").eq("id", user.id).maybeSingle();
        setProfile(data);
      }
    })();
  });

  // Flash animation for swapped slots
  const flashAnim = useRef(new Animated.Value(1)).current;

  const flashHighlight = () => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const getMealById = (mealId: string) =>
    (plan.selected_meals || []).find((m: any) => m.id === mealId);

  const handleSlotTap = (day: number, slotIndex: number) => {
    // If NOT in swap mode, show recipe popup
    if (!swapMode) {
      const slot = weeklyPlan.find((d) => d.day === day)?.slots[slotIndex];
      if (slot?.mealId) {
        const meal = getMealById(slot.mealId);
        if (meal) setPopupMeal(meal);
      }
      return;
    }

    if (!swapFrom) {
      // First tap — select this slot
      setSwapFrom({ day, slotIndex });
    } else if (swapFrom.day === day && swapFrom.slotIndex === slotIndex) {
      // Tapped same slot again — deselect
      setSwapFrom(null);
    } else {
      // Second tap — perform the swap
      setWeeklyPlan((prev) => {
        const next = prev.map((d) => ({ ...d, slots: [...d.slots] }));
        const dayA = next.find((d) => d.day === swapFrom.day)!;
        const dayB = next.find((d) => d.day === day)!;
        const slotA = { ...dayA.slots[swapFrom.slotIndex] };
        const slotB = { ...dayB.slots[slotIndex] };
        // Swap mealId and mealName but keep mealType in place
        dayA.slots[swapFrom.slotIndex] = { ...slotA, mealId: slotB.mealId, mealName: slotB.mealName, leftoverNote: slotB.leftoverNote };
        dayB.slots[slotIndex] = { ...slotB, mealId: slotA.mealId, mealName: slotA.mealName, leftoverNote: slotA.leftoverNote };
        return next;
      });
      setSwapFrom(null);
      setHasChanges(true);
      flashHighlight();
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("meal_plans")
        .update({ weekly_plan: weeklyPlan })
        .eq("id", plan.id);
      if (error) throw error;
      setHasChanges(false);
      Alert.alert("Saved", "Your plan has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const endDate = new Date(plan.created_at);
  endDate.setDate(endDate.getDate() + (plan.setup?.days || 1) - 1);
  const dateRange = `${new Date(plan.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenGuide
        screenKey="activePlan"
        emoji="📅"
        title="Your Active Plan"
        points={[
          "Tap any meal to view the full recipe, ingredients & steps.",
          "Use the swap button to rearrange meals across days.",
          "Shortcut chips at the top take you to shopping list & prep guide.",
          "Start a new plan anytime — your old plans are saved under Past Plans.",
        ]}
      />
      {/* Swap hint banner */}
      {swapMode && (
        <View className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex-row items-center gap-3">
          <Text style={{ fontSize: 18 }}>🔄</Text>
          <View className="flex-1">
            <Text className="text-amber-800 text-sm font-semibold">
              {swapFrom ? "Now tap another meal to swap" : "Tap a meal to select it"}
            </Text>
            <Text className="text-amber-600 text-xs mt-0.5">
              {swapFrom ? "Tap same slot to cancel selection" : "Then tap another to swap positions"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setSwapMode(false); setSwapFrom(null); }}
            className="bg-amber-100 px-3 py-1.5 rounded-lg">
            <Text className="text-amber-700 text-xs font-medium">Done</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: hasChanges ? 120 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-5 mt-2">
          <View>
            <Text className="text-2xl font-bold text-gray-800">📅 This Week</Text>
            <Text className="text-sm text-gray-400 mt-0.5">{dateRange}</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert(
              "Start New Plan?",
              "This will let you pick meals for a new plan. Your current plan history is saved.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes, start fresh", onPress: onNewPlan },
              ]
            )}
            className="bg-gray-100 px-3 py-2 rounded-xl"
          >
            <Text className="text-xs text-gray-500 font-medium">+ New Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Instruction chip + swap mode toggle */}
        {!swapMode && (
          <View className="flex-row items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
            <Text style={{ fontSize: 16 }}>💡</Text>
            <Text className="text-blue-700 text-xs flex-1">
              Tap any meal to see the full recipe
            </Text>
            <TouchableOpacity
              onPress={() => setSwapMode(true)}
              className="bg-blue-100 px-3 py-1.5 rounded-lg"
              activeOpacity={0.7}
            >
              <Text className="text-blue-700 text-xs font-medium">🔄 Swap</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Days */}
        {weeklyPlan.map((dayPlan) => {
          const date = getPlanDayDate(plan.created_at, dayPlan.day);
          const specialLabel = getDayLabel(date);
          const isExpanded = expandedDays.has(dayPlan.day);
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <View key={dayPlan.day} className="mb-3">
              {/* Day header */}
              <TouchableOpacity
                onPress={() => toggleDay(dayPlan.day)}
                className={`flex-row items-center justify-between px-4 py-3 rounded-2xl ${
                  isPast ? "bg-gray-100" : specialLabel ? "bg-green-50 border border-green-200" : "bg-white border border-gray-100"
                }`}
                style={{ elevation: isPast ? 0 : 1 }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-3">
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${
                    isPast ? "bg-gray-200" : specialLabel ? "bg-green-500" : "bg-gray-100"
                  }`}>
                    <Text className={`text-xs font-bold ${isPast ? "text-gray-400" : specialLabel ? "text-white" : "text-gray-600"}`}>
                      {dayPlan.day}
                    </Text>
                  </View>
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className={`text-sm font-semibold ${isPast ? "text-gray-400" : "text-gray-800"}`}>
                        {formatDayDate(date)}
                      </Text>
                      {specialLabel && (
                        <View className="bg-green-500 px-2 py-0.5 rounded-full">
                          <Text className="text-white text-xs font-bold">{specialLabel}</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {dayPlan.slots.length} meal{dayPlan.slots.length > 1 ? "s" : ""}
                      {dayPlan.totalCalories ? ` · ~${dayPlan.totalCalories} kcal` : ""}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-400 text-lg">{isExpanded ? "⌃" : "⌄"}</Text>
              </TouchableOpacity>

              {/* Meal slots (expanded) */}
              {isExpanded && (
                <View className="mt-1 gap-2 pl-1">
                  {dayPlan.slots.map((slot, idx) => {
                    const isFromSlot = swapFrom?.day === dayPlan.day && swapFrom?.slotIndex === idx;
                    return (
                      <TouchableOpacity
                        key={`${slot.mealType}-${idx}`}
                        onPress={() => handleSlotTap(dayPlan.day, idx)}
                        activeOpacity={0.75}
                      >
                        <Animated.View
                          style={[
                            { opacity: isFromSlot ? flashAnim : 1, elevation: isFromSlot ? 3 : 1 },
                          ]}
                          className={`flex-row items-center gap-3 px-4 py-3 rounded-xl border-2 ${
                            swapMode && isFromSlot
                              ? "border-amber-400 bg-amber-50"
                              : swapMode && swapFrom
                              ? "border-blue-300 bg-blue-50"
                              : isPast
                              ? "border-gray-100 bg-gray-50"
                              : "border-gray-100 bg-white"
                          }`}
                        >
                          {/* Meal type icon */}
                          <View className={`w-9 h-9 rounded-xl items-center justify-center ${
                            isPast ? "bg-gray-100" : "bg-green-50"
                          }`}>
                            <Text style={{ fontSize: 18 }}>{MEAL_EMOJIS[slot.mealType]}</Text>
                          </View>

                          {/* Meal info */}
                          <View className="flex-1">
                            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                              {MEAL_LABELS[slot.mealType] || slot.mealType}
                            </Text>
                            <Text className={`text-sm font-semibold mt-0.5 ${isPast ? "text-gray-400" : "text-gray-800"}`}
                              numberOfLines={1}>
                              {slot.mealName || "—"}
                            </Text>
                            {slot.leftoverNote && (
                              <Text className="text-xs text-amber-600 mt-0.5">{slot.leftoverNote}</Text>
                            )}
                          </View>

                          {/* State indicator */}
                          {swapMode ? (
                            isFromSlot ? (
                              <View className="bg-amber-400 rounded-full px-2 py-1">
                                <Text className="text-white text-xs font-bold">Selected</Text>
                              </View>
                            ) : swapFrom ? (
                              <View className="bg-blue-400 rounded-full px-2 py-1">
                                <Text className="text-white text-xs font-bold">Swap here</Text>
                              </View>
                            ) : (
                              <Text className="text-gray-300 text-base">⇄</Text>
                            )
                          ) : (
                            <Text className="text-gray-300 text-base">›</Text>
                          )}
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Shortcut cards */}
        <View className="mt-3 gap-3">
          {/* Prep plan shortcut */}
          {plan.prep_plan && (
            <TouchableOpacity
              onPress={() => router.push("/meal-prep")}
              className="flex-row items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4"
              style={{ elevation: 1 }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center gap-3">
                <Text style={{ fontSize: 22 }}>🔪</Text>
                <View>
                  <Text className="text-sm font-semibold text-amber-800">Weekend Prep Plan</Text>
                  <Text className="text-xs text-amber-600 mt-0.5">Prep ahead, cook in 15 min</Text>
                </View>
              </View>
              <Text className="text-amber-400 text-lg">›</Text>
            </TouchableOpacity>
          )}

          {/* Shopping list shortcut */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/shopping")}
            className="flex-row items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4"
            style={{ elevation: 1 }}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3">
              <Text style={{ fontSize: 22 }}>🛒</Text>
              <View>
                <Text className="text-sm font-semibold text-gray-800">Shopping List</Text>
                <Text className="text-xs text-gray-400 mt-0.5">Based on this week's plan</Text>
              </View>
            </View>
            <Text className="text-gray-400 text-lg">›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Save changes bar */}
      {hasChanges && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4"
          style={{ elevation: 8 }}>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setWeeklyPlan(JSON.parse(JSON.stringify(plan.weekly_plan || [])));
                setHasChanges(false);
                setSwapFrom(null);
                setSwapMode(false);
              }}
              className="flex-1 py-3 bg-gray-100 rounded-2xl items-center"
              activeOpacity={0.7}
            >
              <Text className="text-gray-600 font-medium">Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveChanges}
              disabled={saving}
              className="flex-2 flex-1 py-3 bg-green-500 rounded-2xl items-center"
              style={{ opacity: saving ? 0.7 : 1 }}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-semibold">Save Changes ✓</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recipe popup — auto-fetches full recipe via Agent B */}
      <RecipePopup
        meal={popupMeal}
        profile={profile}
        onClose={() => setPopupMeal(null)}
        onEnriched={(enriched) => {
          // Update the meal in selected_meals so next tap is instant
          const idx = (plan.selected_meals || []).findIndex((m: any) => m.id === enriched.id);
          if (idx >= 0) plan.selected_meals[idx] = enriched;
        }}
      />
    </SafeAreaView>
  );
}

// ─── Main (smart) ─────────────────────────────────────────────────────────────
export default function PlanScreen() {
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [forceSetup, setForceSetup] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setForceSetup(false);

      async function loadPlan() {
        setLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || cancelled) return;

          const { data } = await supabase
            .from("meal_plans")
            .select("id, created_at, setup, selected_meals, weekly_plan, prep_plan")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!cancelled) {
            if (data && data.weekly_plan?.length > 0 && isPlanActive(data as Plan)) {
              setActivePlan(data as Plan);
            } else {
              setActivePlan(null);
            }
          }
        } catch {
          if (!cancelled) setActivePlan(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadPlan();
      return () => { cancelled = true; };
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#16a34a" size="large" />
        <Text className="text-gray-400 text-sm mt-3">Loading your plan…</Text>
      </SafeAreaView>
    );
  }

  if (activePlan && !forceSetup) {
    return <ActivePlanView plan={activePlan} onNewPlan={() => setForceSetup(true)} />;
  }

  return <SetupWizard />;
}
