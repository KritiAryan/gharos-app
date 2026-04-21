import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import RecipePopup from "../components/RecipePopup";
import type { Meal } from "../components/RecipePopup";

// ─── Types ────────────────────────────────────────────────────────────────────
type Slot = { mealType: string; mealId: string; mealName: string; leftoverNote?: string | null };
type DayPlan = { day: number; slots: Slot[]; totalCalories: number; calorieWarning: boolean };
type Plan = {
  id: string; created_at: string;
  setup: { days: number; meals: string[] };
  selected_meals: any[]; weekly_plan: DayPlan[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const MEAL_EMOJIS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", snacks: "🍵", dinner: "🌙" };
const CUISINE_EMOJIS: Record<string, string> = {
  "North Indian":"🫕","South Indian":"🥘","Maharashtrian":"🍱",
  "Gujarati":"🥙","Bengali":"🐟","Udupi":"🌿","Continental":"🍝","Pan-Indian":"🍛",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getPlanDayDate(createdAt: string, day: number) {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + day - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function getTodayLabel(date: Date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(date); d.setHours(0,0,0,0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return null;
}
function formatDayDate(date: Date) {
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}
function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function formatRelative(iso: string) {
  const d = new Date(iso); const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function getDateRange(plan: Plan) {
  const end = new Date(plan.created_at);
  end.setDate(end.getDate() + (plan.setup?.days || 1) - 1);
  return `${formatShortDate(plan.created_at)} – ${formatShortDate(end.toISOString())}`;
}

// ─── Meal Picker ──────────────────────────────────────────────────────────────
function MealPicker({ mealType, allMeals, currentId, onPick, onClose }: {
  mealType: string; allMeals: any[]; currentId: string;
  onPick: (meal: any) => void; onClose: () => void;
}) {
  const filtered = allMeals.filter((m) => m.mealType?.includes(mealType));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" }}
        activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl" style={{ maxHeight:"70%" }}>
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
              <View>
                <Text className="font-bold text-gray-800">Change meal</Text>
                <Text className="text-xs text-gray-400 mt-0.5 capitalize">
                  {MEAL_EMOJIS[mealType] || "🍽️"} {mealType} options
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}><Text className="text-gray-400 text-3xl">×</Text></TouchableOpacity>
            </View>
            <ScrollView>
              {filtered.length === 0
                ? <Text className="text-center py-8 text-gray-400 text-sm">No other {mealType} options in this plan.</Text>
                : filtered.map((meal) => (
                  <TouchableOpacity key={meal.id} onPress={() => { onPick(meal); onClose(); }}
                    className={`flex-row items-center gap-3 px-4 py-3 border-b border-gray-50 ${meal.id===currentId?"bg-green-50":""}`}
                    activeOpacity={0.7}>
                    <Text style={{ fontSize:20 }}>{CUISINE_EMOJIS[meal.cuisine]||"🍛"}</Text>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{meal.name}</Text>
                      <Text className="text-xs text-gray-400">{meal.cuisine} · ⏱ {meal.cookTime} min · {meal.macros?.cal} kcal</Text>
                    </View>
                    {meal.id===currentId && <Text className="text-green-500 text-sm">✓</Text>}
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Plan Detail ──────────────────────────────────────────────────────────────
function PlanDetail({ plan: initialPlan, onBack }: { plan: Plan; onBack: () => void }) {
  const [plan, setPlan] = useState(initialPlan);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editSlots, setEditSlots] = useState<Slot[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<{ slotIdx: number; mealType: string; currentId: string } | null>(null);
  const [popupMeal, setPopupMeal] = useState<Meal | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const weeklyPlan = plan.weekly_plan || [];
  const allMeals   = plan.selected_meals || [];

  useEffect(() => {
    // Grab profile once so RecipePopup has recipe-site preferences.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data) setProfile(data);
    });
  }, []);

  const startEdit = (dayPlan: DayPlan) => {
    setEditingDay(dayPlan.day);
    setEditSlots(dayPlan.slots.map((s) => ({ ...s })));
    setExpandedDay(dayPlan.day);
  };
  const cancelEdit = () => { setEditingDay(null); setEditSlots(null); };

  const changeMeal = (slotIdx: number, meal: any) => {
    setEditSlots((prev) => prev!.map((s, i) => i===slotIdx ? {...s, mealId:meal.id, mealName:meal.name} : s));
  };
  const removeSlot = (slotIdx: number) => {
    setEditSlots((prev) => prev!.filter((_, i) => i!==slotIdx));
  };
  const saveEdit = async () => {
    if (!editSlots) return;
    setSaving(true);
    const updated = weeklyPlan.map((d) => d.day===editingDay ? {...d, slots:editSlots} : d);
    await supabase.from("meal_plans").update({ weekly_plan: updated }).eq("id", plan.id);
    setPlan({ ...plan, weekly_plan: updated });
    setEditingDay(null); setEditSlots(null);
    setSaving(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center">
        <TouchableOpacity onPress={onBack} className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
          <Text className="text-gray-600">←</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-base font-bold text-gray-800">{getDateRange(plan)}</Text>
          <Text className="text-xs text-gray-400">{formatRelative(plan.created_at)} · {plan.setup?.days} days</Text>
        </View>
        <View className="w-9" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>

        {weeklyPlan.length === 0 && allMeals.length > 0 && (
          <View className="bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden" style={{ elevation:1 }}>
            <View className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <Text className="text-sm font-semibold text-gray-600">Selected Meals</Text>
            </View>
            {allMeals.map((meal: any, i: number) => (
              <View key={i} className="flex-row items-center gap-3 px-4 py-3 border-t border-gray-50">
                <Text style={{ fontSize:18 }}>{CUISINE_EMOJIS[meal.cuisine]||"🍛"}</Text>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{meal.name}</Text>
                  <Text className="text-xs text-gray-400">{meal.cuisine}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {weeklyPlan.map((dayPlan) => {
          const dayDate    = getPlanDayDate(plan.created_at, dayPlan.day);
          const todayLabel = getTodayLabel(dayDate);
          const dateLabel  = formatDayDate(dayDate);
          const isEditing  = editingDay === dayPlan.day;
          const isExpanded = expandedDay === dayPlan.day;
          const slots      = isEditing ? editSlots! : dayPlan.slots;
          const isToday    = todayLabel === "Today";

          return (
            <View key={dayPlan.day}
              className={`bg-white rounded-2xl border mb-3 overflow-hidden ${isToday?"border-green-200":"border-gray-100"}`}
              style={{ elevation:1 }}>
              {/* Day header */}
              <View className={`px-4 py-3 flex-row items-center justify-between ${isToday?"bg-green-50":"bg-gray-50"}`}>
                <TouchableOpacity
                  onPress={() => !isEditing && setExpandedDay(isExpanded ? null : dayPlan.day)}
                  className="flex-1"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold text-gray-800 text-sm">{dateLabel}</Text>
                    {todayLabel && (
                      <View className={`px-2 py-0.5 rounded-full ${
                        isToday ? "bg-green-500" : "bg-blue-100"
                      }`}>
                        <Text className={`text-xs font-medium ${isToday?"text-white":"text-blue-600"}`}>{todayLabel}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400 mt-0.5">{dayPlan.totalCalories} kcal</Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-2 ml-2">
                  {!isEditing && (
                    <TouchableOpacity onPress={() => startEdit(dayPlan)}
                      className="border border-green-200 rounded-lg px-2.5 py-1" activeOpacity={0.7}>
                      <Text className="text-xs text-green-600 font-medium">Edit</Text>
                    </TouchableOpacity>
                  )}
                  {!isEditing && (
                    <Text className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</Text>
                  )}
                </View>
              </View>

              {/* Collapsed preview */}
              {!isExpanded && !isEditing && (
                <TouchableOpacity onPress={() => setExpandedDay(dayPlan.day)}
                  className="px-4 py-2.5 flex-row flex-wrap gap-x-3 gap-y-1" activeOpacity={0.7}>
                  {(dayPlan.slots || []).map((slot, i) => (
                    <Text key={i} className="text-xs text-gray-500">
                      {MEAL_EMOJIS[slot.mealType] || "🍽️"} {slot.mealName}
                    </Text>
                  ))}
                </TouchableOpacity>
              )}

              {/* Expanded / edit */}
              {(isExpanded || isEditing) && (
                <View>
                  {(slots || []).map((slot, i) => {
                    const meal = allMeals.find((m: any) => m.id === slot.mealId);
                    const rowContent = (
                      <>
                        <Text style={{ fontSize:20 }}>{MEAL_EMOJIS[slot.mealType]||"🍽️"}</Text>
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs text-gray-400 capitalize">{slot.mealType}</Text>
                          <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{slot.mealName}</Text>
                          {meal && (
                            <Text className="text-xs text-gray-400">
                              {meal.cuisine}{meal.cookTime?` · ⏱ ${meal.cookTime} min`:""}
                              {meal.macros?.cal?` · ${meal.macros.cal} kcal`:""}
                            </Text>
                          )}
                        </View>
                        {isEditing ? (
                          <View className="flex-row gap-1.5 flex-shrink-0">
                            <TouchableOpacity
                              onPress={() => setPicker({ slotIdx:i, mealType:slot.mealType, currentId:slot.mealId })}
                              className="border border-blue-200 rounded-lg px-2 py-1" activeOpacity={0.7}>
                              <Text className="text-xs text-blue-600">Change</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeSlot(i)}
                              className="border border-red-200 rounded-lg px-2 py-1" activeOpacity={0.7}>
                              <Text className="text-xs text-red-400">✕</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={{ fontSize:18 }}>{CUISINE_EMOJIS[meal?.cuisine]||""}</Text>
                        )}
                      </>
                    );

                    // Non-edit mode → row opens recipe popup. Edit mode → rows are plain.
                    if (isEditing || !meal) {
                      return (
                        <View key={i} className="flex-row items-center gap-3 px-4 py-3 border-t border-gray-50">
                          {rowContent}
                        </View>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setPopupMeal(meal as Meal)}
                        activeOpacity={0.7}
                        className="flex-row items-center gap-3 px-4 py-3 border-t border-gray-50"
                      >
                        {rowContent}
                      </TouchableOpacity>
                    );
                  })}

                  {isEditing && (
                    <View className="flex-row gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
                      <TouchableOpacity onPress={saveEdit} disabled={saving}
                        className="flex-1 py-2.5 bg-green-500 rounded-xl items-center"
                        style={{ opacity: saving ? 0.6 : 1 }} activeOpacity={0.8}>
                        {saving ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white text-sm font-semibold">✓ Save changes</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={cancelEdit}
                        className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl items-center" activeOpacity={0.8}>
                        <Text className="text-gray-500 text-sm font-semibold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {picker && (
        <MealPicker
          mealType={picker.mealType}
          allMeals={allMeals}
          currentId={picker.currentId}
          onPick={(meal) => changeMeal(picker.slotIdx, meal)}
          onClose={() => setPicker(null)}
        />
      )}

      <RecipePopup
        meal={popupMeal}
        profile={profile}
        onClose={() => setPopupMeal(null)}
      />
    </SafeAreaView>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, onView }: { plan: Plan; onView: (p: Plan) => void }) {
  const allMeals = plan.selected_meals || [];
  const preview  = allMeals.slice(0, 4).map((m: any) => m.name);
  const extra    = allMeals.length - preview.length;
  return (
    <View className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden" style={{ elevation:1 }}>
      <View className="px-4 pt-4 pb-3 border-b border-gray-50">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-sm font-bold text-gray-700">{getDateRange(plan)}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">{formatRelative(plan.created_at)}</Text>
          </View>
          <View className="bg-green-50 rounded-full px-2.5 py-1">
            <Text className="text-xs text-green-600 font-medium">{plan.setup?.days||"?"} days</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2 mt-2">
          {(plan.setup?.meals || []).map((slot: string) => (
            <View key={slot} className="bg-gray-100 rounded-full px-2 py-0.5">
              <Text className="text-xs text-gray-500">{MEAL_EMOJIS[slot]||"🍽️"} {slot.charAt(0).toUpperCase()+slot.slice(1)}</Text>
            </View>
          ))}
          <Text className="text-xs text-gray-400 self-center">{allMeals.length} meals</Text>
        </View>
      </View>
      {preview.length > 0 && (
        <View className="px-4 py-3 flex-row flex-wrap gap-1.5">
          {preview.map((name: string, i: number) => (
            <View key={i} className="bg-green-50 rounded-full px-2.5 py-1">
              <Text className="text-xs text-green-700">{name}</Text>
            </View>
          ))}
          {extra > 0 && (
            <View className="bg-gray-50 rounded-full px-2.5 py-1">
              <Text className="text-xs text-gray-400">+{extra} more</Text>
            </View>
          )}
        </View>
      )}
      <View className="px-4 pb-4">
        <TouchableOpacity onPress={() => onView(plan)}
          className="py-2.5 border-2 border-green-200 rounded-xl items-center" activeOpacity={0.8}>
          <Text className="text-sm font-semibold text-green-600">View & Edit Plan →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PastPlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    setLoading(true); setError(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    try {
      const { data, error: err } = await supabase
        .from("meal_plans")
        .select("id, created_at, setup, selected_meals, weekly_plan")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setPlans(data || []);
    } catch { setError(true); }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  if (selectedPlan) {
    return <PlanDetail plan={selectedPlan} onBack={() => setSelectedPlan(null)} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
          <Text className="text-gray-600">←</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-base font-bold text-gray-800">Past Plans</Text>
          {!loading && plans.length > 0 && (
            <Text className="text-xs text-gray-400">{plans.length} plan{plans.length!==1?"s":""} saved</Text>
          )}
        </View>
        <View className="w-9" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding:16, paddingBottom:40 }}
        showsVerticalScrollIndicator={false}>
        {loading && (
          <View className="items-center py-20">
            <Text className="text-4xl mb-3">📋</Text>
            <ActivityIndicator color="#16a34a" />
            <Text className="text-gray-400 text-sm mt-3">Loading your plans…</Text>
          </View>
        )}
        {!loading && error && (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">⚠️</Text>
            <Text className="text-gray-600 font-semibold">Couldn't load plans</Text>
            <TouchableOpacity onPress={fetchPlans} className="mt-4 px-5 py-2.5 bg-green-500 rounded-xl">
              <Text className="text-white font-semibold text-sm">Try again</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !error && plans.length === 0 && (
          <View className="items-center py-20">
            <Text className="text-5xl mb-4">📅</Text>
            <Text className="text-lg font-bold text-gray-700 mb-2">No plans yet</Text>
            <Text className="text-gray-400 text-sm">Plans you save will appear here.</Text>
          </View>
        )}
        {!loading && !error && plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onView={setSelectedPlan} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
