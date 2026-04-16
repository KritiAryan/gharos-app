import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import ScreenGuide from "../../components/ScreenGuide";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const MEAL_EMOJIS: Record<string, string> = {
  breakfast: "🌅", lunch: "☀️", snacks: "🍵", dinner: "🌙",
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", snacks: "Snacks", dinner: "Dinner",
};

// ─── Today's Meals Section ──────────────────────────────────────────────────
function TodaysMeals({
  todaySlots,
  selectedMeals,
}: {
  todaySlots: any[];
  selectedMeals: any[];
}) {
  const router = useRouter();

  if (!todaySlots || todaySlots.length === 0) return null;

  const getMeal = (mealId: string) =>
    selectedMeals.find((m: any) => m.id === mealId);

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16 }}>🍽️</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#1f2937" }}>Today's Meals</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/plan")} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "600" }}>View Plan →</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8 }}>
        {todaySlots.map((slot: any, idx: number) => {
          const meal = getMeal(slot.mealId);
          const cookTime = meal?.cookTime || 0;

          return (
            <TouchableOpacity
              key={`${slot.mealType}-${idx}`}
              onPress={() => router.push("/(tabs)/plan")}
              activeOpacity={0.7}
              style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: "#fff", borderRadius: 16,
                borderWidth: 1, borderColor: "#f3f4f6",
                paddingHorizontal: 14, paddingVertical: 12,
                elevation: 1,
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 20 }}>{MEAL_EMOJIS[slot.mealType] || "🍽️"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {MEAL_LABELS[slot.mealType] || slot.mealType}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1f2937", marginTop: 2 }} numberOfLines={1}>
                  {slot.mealName || "—"}
                </Text>
              </View>
              {cookTime > 0 && (
                <View style={{
                  backgroundColor: "#dcfce7", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#16a34a" }}>{cookTime} min</Text>
                </View>
              )}
              <Text style={{ color: "#d1d5db", fontSize: 16 }}>›</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Today's Prep Tasks Section ─────────────────────────────────────────────
function TodaysPreps({
  prepPlan,
  planCreatedAt,
  planDays,
}: {
  prepPlan: any;
  planCreatedAt: string;
  planDays: number;
}) {
  const router = useRouter();

  if (!prepPlan) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat

  // Determine what preps are relevant today
  let todayTasks: { category: string; label: string; tasks: any[] }[] = [];
  let sectionTitle = "";
  let sectionEmoji = "";

  if (dayOfWeek === 6) {
    // Saturday — show Saturday prep
    const satSession = prepPlan.weekendPrep?.find((s: any) => s.day === "saturday");
    if (satSession) {
      todayTasks = satSession.taskGroups || [];
      sectionTitle = "Saturday Prep";
      sectionEmoji = "🔪";
    }
  } else if (dayOfWeek === 0) {
    // Sunday — show Sunday prep
    const sunSession = prepPlan.weekendPrep?.find((s: any) => s.day === "sunday");
    if (sunSession) {
      todayTasks = sunSession.taskGroups || [];
      sectionTitle = "Sunday Prep";
      sectionEmoji = "🔪";
    }
  } else {
    // Weekday — show today's quick cook tasks from dailyCookCards
    const planStart = new Date(planCreatedAt);
    planStart.setHours(0, 0, 0, 0);
    const dayNumber = Math.floor((today.getTime() - planStart.getTime()) / 86400000) + 1;

    const todayCard = (prepPlan.dailyCookCards || []).find((c: any) => c.day === dayNumber);
    if (todayCard && todayCard.slots?.length > 0) {
      // Convert quick cook slots into a prep-like format for display
      todayTasks = todayCard.slots.map((slot: any) => ({
        category: slot.mealType,
        label: `${slot.mealName} (${slot.estimatedCookMinutes} min)`,
        tasks: (slot.quickSteps || []).map((step: string, i: number) => ({
          id: `qc_${todayCard.day}_${slot.mealId}_${i}`,
          description: step,
          estimatedMinutes: Math.round((slot.estimatedCookMinutes || 15) / (slot.quickSteps?.length || 1)),
          forMeals: [slot.mealName],
        })),
      }));
      sectionTitle = "Today's Quick Cook";
      sectionEmoji = "⚡";
    }
  }

  if (todayTasks.length === 0) return null;

  // Flatten for count
  const allTasks = todayTasks.flatMap((g) => g.tasks);
  const totalTime = allTasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16 }}>{sectionEmoji}</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#1f2937" }}>{sectionTitle}</Text>
          <View style={{
            backgroundColor: "#fef3c7", borderRadius: 8,
            paddingHorizontal: 6, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "600", color: "#92400e" }}>
              {allTasks.length} tasks · ~{totalTime} min
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push("/meal-prep")} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, color: "#f59e0b", fontWeight: "600" }}>Open Guide →</Text>
        </TouchableOpacity>
      </View>

      <View style={{
        backgroundColor: "#fff", borderRadius: 16,
        borderWidth: 1, borderColor: "#f3f4f6",
        overflow: "hidden", elevation: 1,
      }}>
        {todayTasks.slice(0, 3).map((group, gi) => (
          <View key={gi}>
            {/* Group header */}
            <View style={{
              paddingHorizontal: 14, paddingVertical: 8,
              backgroundColor: gi === 0 ? "#fffbeb" : "#fafafa",
              borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
            }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#92400e" }}>{group.label}</Text>
            </View>
            {/* Tasks preview (max 2 per group) */}
            {group.tasks.slice(0, 2).map((task: any, ti: number) => (
              <View key={task.id} style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                paddingHorizontal: 14, paddingVertical: 10,
                borderBottomWidth: ti < Math.min(group.tasks.length, 2) - 1 ? 1 : 0,
                borderBottomColor: "#f9fafb",
              }}>
                <View style={{
                  width: 18, height: 18, borderRadius: 9,
                  borderWidth: 2, borderColor: "#d1d5db",
                }} />
                <Text style={{ fontSize: 12, color: "#4b5563", flex: 1, lineHeight: 16 }} numberOfLines={2}>
                  {task.description}
                </Text>
                {task.estimatedMinutes > 0 && (
                  <Text style={{ fontSize: 10, color: "#9ca3af" }}>~{task.estimatedMinutes}m</Text>
                )}
              </View>
            ))}
            {group.tasks.length > 2 && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#fafafa" }}>
                <Text style={{ fontSize: 10, color: "#9ca3af" }}>+{group.tasks.length - 2} more...</Text>
              </View>
            )}
          </View>
        ))}

        {todayTasks.length > 3 && (
          <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fffbeb" }}>
            <Text style={{ fontSize: 11, color: "#b45309", fontWeight: "500" }}>
              +{todayTasks.length - 3} more groups — open guide to see all
            </Text>
          </View>
        )}

        {/* Open full guide CTA */}
        <TouchableOpacity
          onPress={() => router.push("/meal-prep")}
          style={{
            paddingVertical: 12, alignItems: "center",
            borderTopWidth: 1, borderTopColor: "#f3f4f6",
            backgroundColor: "#fffbeb",
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#d97706" }}>
            Open Full Prep Guide →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [latestPlan, setLatestPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [{ data: prof }, { data: plans }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      supabase.from("meal_plans")
        .select("id, setup, selected_meals, weekly_plan, prep_plan, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setProfile(prof);
    setLatestPlan(plans?.[0] || null);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, []));

  const firstName = profile?.full_name
    ? profile.full_name.split(" ")[0]
    : profile?.email?.split("@")[0] || "there";

  const pantryCount    = Array.isArray(profile?.pantry) ? profile.pantry.length : 0;
  const cuisineCount   = profile?.config?.cuisines?.length || 0;
  const favouriteCount = profile?.favourites?.length || 0;
  const persons        = profile?.config?.persons || 2;

  // Check if plan is still active (within days)
  const planActive = (() => {
    if (!latestPlan) return false;
    const savedAt = new Date(latestPlan.created_at);
    const days = latestPlan.setup?.days || 0;
    const end = new Date(savedAt);
    end.setDate(end.getDate() + days);
    return new Date() < end;
  })();

  const daysLeft = (() => {
    if (!latestPlan) return null;
    const savedAt = new Date(latestPlan.created_at);
    const days = latestPlan.setup?.days || 0;
    const end = new Date(savedAt);
    end.setDate(end.getDate() + days);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  })();

  // ── Find today's meals from the active plan ──
  const todaySlots = (() => {
    if (!planActive || !latestPlan?.weekly_plan) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planStart = new Date(latestPlan.created_at);
    planStart.setHours(0, 0, 0, 0);
    const dayNumber = Math.floor((today.getTime() - planStart.getTime()) / 86400000) + 1;
    const dayPlan = latestPlan.weekly_plan.find((d: any) => d.day === dayNumber);
    return dayPlan?.slots || [];
  })();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenGuide
        screenKey="home"
        emoji="🏠"
        title="Welcome to GharOS!"
        points={[
          "This is your meal-planning hub. Everything starts here.",
          "See today's meals and prep tasks at a glance.",
          "Use quick actions to jump to shopping, prep, favourites & past plans.",
          "Head to the Plan tab to create your first weekly meal plan.",
        ]}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View className="bg-white px-4 py-3.5 border-b border-gray-100 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">🏠</Text>
            <Text className="text-base font-bold text-green-600">GharOS</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/settings")}
            className="w-10 h-10 items-center justify-center rounded-full"
            activeOpacity={0.7}
          >
            <Text className="text-lg">⚙️</Text>
          </TouchableOpacity>
        </View>

        <View className="px-4 pt-5">
          {/* Greeting */}
          <View className="mb-5">
            <Text className="text-2xl font-bold text-gray-800">
              {getGreeting()}, {firstName}! 👋
            </Text>
            <Text className="text-gray-400 text-sm mt-0.5">What would you like to do today?</Text>
          </View>

          {/* Stat strip */}
          <View className="bg-white rounded-2xl border border-gray-100 mb-5 flex-row overflow-hidden"
            style={{ elevation: 1 }}>
            {[
              { value: persons,              label: "People",     onPress: () => router.push("/(tabs)/settings") },
              { value: cuisineCount || "—",  label: "Cuisines",   onPress: () => router.push("/(tabs)/settings") },
              { value: pantryCount || "—",   label: "Pantry",     onPress: () => {} },
              { value: favouriteCount || "0",label: "Favourites", onPress: () => router.push("/(tabs)/settings") },
            ].map(({ value, label, onPress }, idx, arr) => (
              <TouchableOpacity
                key={label}
                onPress={onPress}
                activeOpacity={0.7}
                className={`flex-1 py-3 px-2 items-center ${idx < arr.length - 1 ? "border-r border-gray-100" : ""}`}
              >
                <Text className="text-xl font-bold text-green-600">{value}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Plan ending reminder */}
          {latestPlan && daysLeft !== null && daysLeft <= 2 && (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex-row items-center gap-3">
              <Text className="text-2xl">⏰</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-amber-800">
                  {daysLeft === 0 ? "Your meal plan has ended!" :
                   daysLeft === 1 ? "Your plan ends tomorrow" :
                   "Your plan ends in 2 days"}
                </Text>
                <Text className="text-xs text-amber-600 mt-0.5">Time to plan next week's meals</Text>
              </View>
            </View>
          )}

          {/* Primary CTA */}
          {planActive && latestPlan ? (
            <View className="mb-5 gap-2">
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/plan")}
                className="bg-green-500 rounded-2xl p-4 flex-row items-center justify-between"
                style={{ elevation: 2 }}
                activeOpacity={0.8}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-3xl">📅</Text>
                  <View>
                    <Text className="font-bold text-base text-white">This week's plan is active</Text>
                    <Text className="text-green-100 text-xs mt-0.5">
                      {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
                    </Text>
                  </View>
                </View>
                <Text className="text-2xl text-green-200">›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/plan")}
                className="border-2 border-amber-300 rounded-2xl p-3 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-amber-700 text-sm font-semibold">🗓️ Plan a new week</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/plan")}
              className="bg-green-500 rounded-2xl p-4 flex-row items-center justify-between mb-5"
              style={{ elevation: 2 }}
              activeOpacity={0.8}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-3xl">🍽️</Text>
                <View>
                  <Text className="font-bold text-base text-white">Plan this week's meals</Text>
                  <Text className="text-green-100 text-xs mt-0.5">AI suggestions → weekly calendar</Text>
                </View>
              </View>
              <Text className="text-2xl text-green-200">›</Text>
            </TouchableOpacity>
          )}

          {/* ── Today's Meals ── */}
          {planActive && (
            <TodaysMeals
              todaySlots={todaySlots}
              selectedMeals={latestPlan?.selected_meals || []}
            />
          )}

          {/* ── Today's Preps ── */}
          {planActive && latestPlan?.prep_plan && (
            <TodaysPreps
              prepPlan={latestPlan.prep_plan}
              planCreatedAt={latestPlan.created_at}
              planDays={latestPlan.setup?.days || 5}
            />
          )}

          {/* Quick Actions */}
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/shopping")}
              style={{
                flex: 1, backgroundColor: "#f0fdf4", borderWidth: 2, borderColor: "#dcfce7",
                borderRadius: 16, padding: 14,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>🛒</Text>
              <Text style={{ fontWeight: "600", fontSize: 13, color: "#15803d" }}>Shopping List</Text>
              <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Auto-generated from plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/meal-prep")}
              style={{
                flex: 1, backgroundColor: "#fffbeb", borderWidth: 2, borderColor: "#fef3c7",
                borderRadius: 16, padding: 14,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>🔪</Text>
              <Text style={{ fontWeight: "600", fontSize: 13, color: "#92400e" }}>Meal Prep Guide</Text>
              <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Weekend prep + quick cook</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/settings")}
              style={{
                flex: 1, backgroundColor: "#fdf2f8", borderWidth: 2, borderColor: "#fce7f3",
                borderRadius: 16, padding: 14,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>❤️</Text>
              <Text style={{ fontWeight: "600", fontSize: 13, color: "#9d174d" }}>Favourites</Text>
              <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Your saved meals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/past-plans")}
              style={{
                flex: 1, backgroundColor: "#eff6ff", borderWidth: 2, borderColor: "#dbeafe",
                borderRadius: 16, padding: 14,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>📋</Text>
              <Text style={{ fontWeight: "600", fontSize: 13, color: "#1e40af" }}>Past Plans</Text>
              <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>View plan history</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
