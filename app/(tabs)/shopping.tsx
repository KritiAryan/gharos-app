import { useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { generateShoppingList } from "../../services/geminiService";
import ScreenGuide from "../../components/ScreenGuide";

// ─── Types ────────────────────────────────────────────────────────────────────
type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  estimatedPriceINR?: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  "Vegetables & Greens",
  "Dairy & Paneer",
  "Grains & Pulses",
  "Spices & Masalas",
  "Oil & Condiments",
  "Nuts & Dry Fruits",
  "Other",
];

const ALWAYS_AVAILABLE = ["water", "hot water", "boiling water", "ice", "tap water"];

// ─── Price Multipliers for different apps ────────────────────────────────────
// These are approximate multipliers vs kirana store prices
const APP_PRICES = [
  { name: "Kirana Store",  emoji: "🏪", multiplier: 1.0,  color: "#16a34a", bg: "#f0fdf4", border: "#dcfce7" },
  { name: "BigBasket",     emoji: "🟢", multiplier: 1.05, color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { name: "Blinkit",       emoji: "🟡", multiplier: 1.15, color: "#ca8a04", bg: "#fefce8", border: "#fef08a" },
  { name: "Zepto",         emoji: "🟣", multiplier: 1.18, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { name: "Swiggy Instamart", emoji: "🟠", multiplier: 1.12, color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deduplicateItems(items: ShoppingItem[]): ShoppingItem[] {
  const seen = new Map<string, ShoppingItem>();
  items.forEach((item) => {
    const key = item.name.toLowerCase().trim();
    if (ALWAYS_AVAILABLE.some((a) => key.includes(a))) return;
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (existing.unit === item.unit) {
        const combined = parseFloat(existing.quantity) + parseFloat(item.quantity);
        existing.quantity = isNaN(combined) ? existing.quantity : String(combined);
        const p1 = Number(existing.estimatedPriceINR);
        const p2 = Number(item.estimatedPriceINR);
        if (p1 && p2) existing.estimatedPriceINR = Math.round((p1 + p2) / 2);
      }
    } else {
      seen.set(key, { ...item, name: item.name.trim() });
    }
  });
  return Array.from(seen.values());
}

function groupByCategory(items: ShoppingItem[]) {
  const grouped: Record<string, ShoppingItem[]> = {};
  items.forEach((item) => {
    const cat = CATEGORY_ORDER.includes(item.category) ? item.category : "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  return CATEGORY_ORDER.filter((c) => grouped[c]).map((c) => ({ cat: c, items: grouped[c] }));
}

function formatForShare(groups: ReturnType<typeof groupByCategory>, checked: Record<string, boolean>, addedToPantry: Record<string, boolean>): string {
  const lines = ["🛒 *Shopping List — GharOS*\n"];
  groups.forEach(({ cat, items }) => {
    const unchecked = items.filter((i) => !checked[i.id] && !addedToPantry[i.id]);
    if (unchecked.length === 0) return;
    lines.push(`*${cat}*`);
    unchecked.forEach((i) => {
      const price = i.estimatedPriceINR ? ` (~₹${i.estimatedPriceINR})` : "";
      lines.push(`• ${i.name} — ${i.quantity} ${i.unit}${price}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

// ─── Price Comparison Component ─────────────────────────────────────────────
function PriceComparison({ kiranaTotal }: { kiranaTotal: number }) {
  const [expanded, setExpanded] = useState(false);

  if (kiranaTotal <= 0) return null;

  return (
    <View style={{
      backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#f3f4f6",
      marginBottom: 12, overflow: "hidden", elevation: 1,
    }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: "#eff6ff", borderBottomWidth: expanded ? 1 : 0, borderBottomColor: "#f3f4f6",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16 }}>📊</Text>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#1e40af" }}>Price Comparison</Text>
            <Text style={{ fontSize: 11, color: "#3b82f6" }}>Compare across grocery apps</Text>
          </View>
        </View>
        <Text style={{ fontSize: 14, color: "#9ca3af" }}>{expanded ? "⌃" : "⌄"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          {APP_PRICES.map((app, idx) => {
            const appTotal = Math.round(kiranaTotal * app.multiplier);
            const diff = appTotal - kiranaTotal;
            const isCheapest = app.multiplier === Math.min(...APP_PRICES.map((a) => a.multiplier));

            return (
              <View key={app.name} style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingVertical: 10, paddingHorizontal: 8,
                borderBottomWidth: idx < APP_PRICES.length - 1 ? 1 : 0,
                borderBottomColor: "#f9fafb",
                backgroundColor: isCheapest ? "#f0fdf4" : "transparent",
                borderRadius: isCheapest ? 10 : 0,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{app.emoji}</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>{app.name}</Text>
                    {isCheapest && (
                      <Text style={{ fontSize: 10, fontWeight: "600", color: "#16a34a" }}>Best Price</Text>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: app.color }}>₹{appTotal}</Text>
                  {diff > 0 && (
                    <Text style={{ fontSize: 10, color: "#ef4444" }}>+₹{diff} more</Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Disclaimer */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: "#fefce8", borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 6, marginTop: 8,
          }}>
            <Text style={{ fontSize: 11 }}>ℹ️</Text>
            <Text style={{ fontSize: 10, color: "#92400e", flex: 1 }}>
              Prices are estimated based on typical grocery app markups. Actual prices may vary by city and offers.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function ShoppingScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedMeals, setSelectedMeals] = useState<any[]>([]);
  const [groups, setGroups] = useState<ReturnType<typeof groupByCategory>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [addedToPantry, setAddedToPantry] = useState<Record<string, boolean>>({});
  const [savingPantry, setSavingPantry] = useState<Record<string, boolean>>({});
  const [showAlreadyHave, setShowAlreadyHave] = useState(false);
  const [noPlan, setNoPlan] = useState(false);
  const buildCalledRef = useRef(false);

  const loadAndBuild = async () => {
    buildCalledRef.current = false;
    setLoading(true);
    setError(false);
    setNoPlan(false);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setUser(session.user);

    const [{ data: prof }, { data: plans }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      supabase.from("meal_plans")
        .select("selected_meals, shopping_list")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setProfile(prof);

    const latestPlan = plans?.[0];
    const meals = latestPlan?.selected_meals || [];
    if (meals.length === 0) { setNoPlan(true); setLoading(false); return; }
    setSelectedMeals(meals);

    // If the plan already has a saved shopping list, use it instantly (no LLM call)
    const savedList = latestPlan?.shopping_list;
    if (Array.isArray(savedList) && savedList.length > 0) {
      const deduped = deduplicateItems(savedList);
      const withIds = deduped.map((item: ShoppingItem, i: number) => ({ ...item, id: `item_${i}` }));
      setGroups(groupByCategory(withIds));
      setChecked({});
      setAddedToPantry({});
      setLoading(false);
      buildCalledRef.current = true;
      return;
    }

    // No saved list — generate via LLM
    await buildList(meals, prof);
  };

  const buildList = async (meals: any[], prof: any) => {
    if (buildCalledRef.current) return;
    buildCalledRef.current = true;
    setLoading(true);
    setError(false);

    const pantry = prof?.pantry || [];
    const persons = prof?.config?.persons || 2;

    try {
      const items = await generateShoppingList({ meals, pantry, persons });
      if (items.length > 0) {
        const deduped = deduplicateItems(items);
        const withIds = deduped.map((item: ShoppingItem, i: number) => ({ ...item, id: `item_${i}` }));
        setGroups(groupByCategory(withIds));
        setChecked({});
        setAddedToPantry({});
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadAndBuild(); }, []));

  const toggleCheck = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }));

  const handleAddToPantry = async (item: ShoppingItem) => {
    if (!user || !profile) return;
    setSavingPantry((p) => ({ ...p, [item.id]: true }));
    const currentPantry = profile.pantry || [];
    const key = item.name.toLowerCase().trim();
    const already = currentPantry.some((p: any) =>
      (typeof p === "string" ? p : p?.name || "").toLowerCase() === key
    );
    if (!already) {
      const updated = [...currentPantry, key];
      await supabase.from("profiles").update({ pantry: updated }).eq("id", user.id);
      setProfile((p: any) => ({ ...p, pantry: updated }));
    }
    setAddedToPantry((p) => ({ ...p, [item.id]: true }));
    setSavingPantry((p) => ({ ...p, [item.id]: false }));
  };

  const allItems = groups.flatMap((g) => g.items);
  const toBuyItems = allItems.filter((i) => !addedToPantry[i.id]);
  const checkedCount = toBuyItems.filter((i) => checked[i.id]).length;
  const totalCount = toBuyItems.length;
  const hasAnyPrice = allItems.some((i) => i.estimatedPriceINR);
  const totalEstimate = toBuyItems
    .filter((i) => !checked[i.id] && i.estimatedPriceINR)
    .reduce((sum, i) => sum + Number(i.estimatedPriceINR), 0);

  const pantryItems = selectedMeals.flatMap((meal) =>
    (meal.ingredients || []).filter((ing: any) => ing.inPantry)
  );

  const shareText = formatForShare(groups, checked, addedToPantry);

  const handleWhatsApp = () => {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  };

  const handleShare = async () => {
    await Share.share({ message: shareText, title: "Shopping List — GharOS" });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenGuide
        screenKey="shopping"
        emoji="🛒"
        title="Shopping List"
        points={[
          "Auto-generated from your plan — we only list what's missing from your pantry.",
          "Tick items off as you shop; grouped by category for easy aisle-by-aisle shopping.",
          "Tap 'Compare Prices' to see estimates across Kirana, Blinkit, Zepto, BigBasket & Swiggy.",
          "Share the full list via WhatsApp or any messaging app with one tap.",
        ]}
      />
      {/* Header */}
      <View className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center justify-between">
        <View className="flex-1 items-center">
          <Text className="text-base font-bold text-gray-800">Shopping List</Text>
          {!loading && totalCount > 0 && (
            <Text className="text-xs text-gray-400">{checkedCount} / {totalCount} ticked off</Text>
          )}
        </View>
        {!loading && !noPlan && !error && (
          <TouchableOpacity
            onPress={() => { buildCalledRef.current = false; buildList(selectedMeals, profile); }}
            className="w-10 h-10 items-center justify-center rounded-full"
          >
            <Text className="text-gray-400 text-lg">↺</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* No plan state */}
        {noPlan && (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">📅</Text>
            <Text className="text-gray-700 font-semibold text-base">No meal plan yet</Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
              Create a weekly plan first — your shopping list will appear here automatically.
            </Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">🛒</Text>
            <Text className="text-base font-bold text-gray-800 mb-1">Building your shopping list...</Text>
            <Text className="text-gray-400 text-sm mb-5">Checking pantry · estimating prices</Text>
            <ActivityIndicator color="#16a34a" />
          </View>
        )}

        {/* Error */}
        {!loading && !noPlan && error && (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">⚠️</Text>
            <Text className="text-gray-600 font-semibold">Couldn't generate list</Text>
            <Text className="text-gray-400 text-sm mt-1 mb-4">Check your connection and try again.</Text>
            <TouchableOpacity
              onPress={() => { buildCalledRef.current = false; buildList(selectedMeals, profile); }}
              className="px-5 py-2.5 bg-green-500 rounded-xl"
            >
              <Text className="text-white font-semibold text-sm">Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !noPlan && !error && (
          <>
            {/* Progress bar */}
            {totalCount > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs text-gray-400 font-medium">
                    {checkedCount} of {totalCount} items ticked off
                  </Text>
                  <Text className="text-xs text-green-600 font-semibold">{totalCount - checkedCount} left</Text>
                </View>
                <View className="w-full bg-gray-100 rounded-full h-2">
                  <View className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }} />
                </View>
              </View>
            )}

            {/* Price estimate — kirana */}
            {hasAnyPrice && totalCount > 0 && (
              <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-sm font-semibold text-amber-800">Estimated total</Text>
                  <Text className="text-xs text-amber-600 mt-0.5">Approx. kirana prices</Text>
                </View>
                <View className="items-end">
                  <Text className="text-2xl font-bold text-amber-700">₹{totalEstimate}</Text>
                  <Text className="text-xs text-amber-500">for {toBuyItems.filter((i) => !checked[i.id]).length} items</Text>
                </View>
              </View>
            )}

            {/* Price comparison across apps */}
            {hasAnyPrice && totalEstimate > 0 && (
              <PriceComparison kiranaTotal={totalEstimate} />
            )}

            {/* Everything in pantry */}
            {totalCount === 0 && (
              <View className="items-center py-10">
                <Text className="text-4xl mb-3">🎉</Text>
                <Text className="text-gray-600 font-semibold">You have everything!</Text>
                <Text className="text-gray-400 text-sm mt-1">All ingredients are already in your pantry.</Text>
              </View>
            )}

            {/* Category groups */}
            {groups.map(({ cat, items }) => {
              const visible = items.filter((i) => !addedToPantry[i.id]);
              if (visible.length === 0) return null;
              return (
                <View key={cat} className="bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden"
                  style={{ elevation: 1 }}>
                  <View className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-600">{cat}</Text>
                    <Text className="text-xs text-gray-400">{visible.filter((i) => !checked[i.id]).length} left</Text>
                  </View>
                  {visible.map((item, idx) => (
                    <View key={item.id}
                      className={`flex-row items-center gap-3 px-4 py-3 ${idx < visible.length - 1 ? "border-b border-gray-50" : ""}`}>
                      {/* Checkbox */}
                      <TouchableOpacity
                        onPress={() => toggleCheck(item.id)}
                        className={`w-5 h-5 rounded-full border-2 items-center justify-center flex-shrink-0 ${
                          checked[item.id] ? "bg-green-500 border-green-500" : "border-gray-300"
                        }`}
                        activeOpacity={0.7}
                      >
                        {checked[item.id] && <Text className="text-white text-xs">✓</Text>}
                      </TouchableOpacity>

                      {/* Name + qty */}
                      <View className="flex-1 min-w-0">
                        <Text className={`text-sm font-medium ${checked[item.id] ? "line-through text-gray-300" : "text-gray-800"}`}
                          numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-xs text-gray-400">{item.quantity} {item.unit}</Text>
                      </View>

                      {/* Price */}
                      {item.estimatedPriceINR ? (
                        <Text className={`text-xs font-medium flex-shrink-0 ${checked[item.id] ? "text-gray-300" : "text-amber-600"}`}>
                          ₹{Number(item.estimatedPriceINR)}
                        </Text>
                      ) : null}

                      {/* Have it */}
                      <TouchableOpacity
                        onPress={() => handleAddToPantry(item)}
                        disabled={savingPantry[item.id]}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 flex-shrink-0"
                        style={{ opacity: savingPantry[item.id] ? 0.5 : 1 }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-xs text-gray-500">
                          {savingPantry[item.id] ? "Saving…" : "✓ Have it"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}

            {/* Added to pantry */}
            {allItems.some((i) => addedToPantry[i.id]) && (
              <View className="bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden" style={{ elevation: 1 }}>
                <View className="px-4 py-3 bg-green-50 flex-row items-center justify-between">
                  <Text className="text-green-700 text-sm font-semibold">✓ Added to pantry</Text>
                  <Text className="text-xs text-green-400">{allItems.filter((i) => addedToPantry[i.id]).length} items saved</Text>
                </View>
                {allItems.filter((i) => addedToPantry[i.id]).map((item) => (
                  <View key={item.id} className="flex-row items-center gap-3 px-4 py-3 opacity-60 border-t border-gray-50">
                    <View className="w-5 h-5 rounded-full bg-green-100 items-center justify-center">
                      <Text className="text-green-600 text-xs">✓</Text>
                    </View>
                    <Text className="text-sm text-gray-600 line-through flex-1">{item.name}</Text>
                    <Text className="text-xs text-green-500">Saved</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Already in pantry */}
            {pantryItems.length > 0 && (
              <View className="bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden" style={{ elevation: 1 }}>
                <TouchableOpacity
                  onPress={() => setShowAlreadyHave((p) => !p)}
                  className="flex-row items-center justify-between px-4 py-3 bg-gray-50"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-gray-600 text-sm font-semibold">Already in pantry</Text>
                    <Text className="text-xs text-gray-400">{pantryItems.length} items skipped</Text>
                  </View>
                  <Text className="text-gray-400 text-sm">{showAlreadyHave ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {showAlreadyHave && pantryItems.map((ing: any, i: number) => (
                  <View key={i} className="flex-row items-center gap-3 px-4 py-3 opacity-50 border-t border-gray-50">
                    <View className="w-5 h-5 rounded-full bg-gray-100 items-center justify-center">
                      <Text className="text-gray-500 text-xs">✓</Text>
                    </View>
                    <Text className="text-sm text-gray-600">{ing.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Share buttons */}
      {!loading && !noPlan && !error && totalCount > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex-row gap-2"
          style={{ elevation: 8 }}>
          <TouchableOpacity onPress={handleWhatsApp}
            className="flex-1 py-3 bg-green-500 rounded-xl items-center" activeOpacity={0.8}>
            <Text className="text-white font-semibold text-sm">📲 WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl items-center" activeOpacity={0.8}>
            <Text className="text-gray-600 font-semibold text-sm">📋 Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
