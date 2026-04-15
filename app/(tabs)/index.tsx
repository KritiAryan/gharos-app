import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

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
        .select("id, setup, selected_meals, weekly_plan, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setProfile(prof);
    setLatestPlan(plans?.[0] || null);
    setLoading(false);
  };

  // Reload whenever screen comes into focus (after saving a plan)
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
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
            <View className="mb-6 gap-2">
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/shopping")}
                className="bg-green-500 rounded-2xl p-4 flex-row items-center justify-between"
                style={{ elevation: 2 }}
                activeOpacity={0.8}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-3xl">📅</Text>
                  <View>
                    <Text className="font-bold text-base text-white">This week's plan is active</Text>
                    <Text className="text-green-100 text-xs mt-0.5">
                      {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining · tap for shopping list
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
              className="bg-green-500 rounded-2xl p-4 flex-row items-center justify-between mb-6"
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

          {/* More section */}
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">More</Text>
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/shopping")}
              className="flex-1 bg-green-50 border-2 border-green-100 rounded-2xl p-4"
              activeOpacity={0.8}
            >
              <Text className="text-2xl mb-2">🛒</Text>
              <Text className="font-semibold text-sm text-green-700">Shopping List</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Auto-generated from plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/settings")}
              className="flex-1 bg-green-50 border-2 border-green-100 rounded-2xl p-4"
              activeOpacity={0.8}
            >
              <Text className="text-2xl mb-2">❤️</Text>
              <Text className="font-semibold text-sm text-green-700">Favourites</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Your saved meals</Text>
            </TouchableOpacity>
          </View>

          {/* Coming Soon */}
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Coming Soon</Text>
          <View className="flex-row gap-3 mb-4">
            {[
              { emoji: "🥘", title: "Meal Prep Guide", desc: "Weekend batch cooking", phase: "Phase 2" },
              { emoji: "🛍️", title: "Smart Grocery",   desc: "Compare prices & order", phase: "Phase 3" },
            ].map((f) => (
              <View key={f.title}
                className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 opacity-50">
                <Text className="text-2xl mb-2">{f.emoji}</Text>
                <Text className="font-semibold text-sm text-gray-500">{f.title}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{f.desc}</Text>
                <View className="bg-gray-200 rounded-full px-2 py-0.5 self-start mt-2">
                  <Text className="text-xs text-gray-500">{f.phase}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
