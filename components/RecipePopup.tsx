import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  Modal, ActivityIndicator, Linking, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { fetchRecipeForCard } from "../services/geminiService";
import { getActiveSiteUrls } from "../data/recipeSites";

const SCREEN_H = Dimensions.get("window").height;

// ─── Types ───────────────────────────────────────────────────────────────────
type Ingredient = { name: string; quantity: string; unit: string; inPantry?: boolean };

export type Meal = {
  id: string; name: string; cuisine: string; cookTime: number;
  macros?: { cal: number; protein: number; carbs: number; fat: number };
  prepAhead?: boolean; prepNote?: string | null;
  ingredients?: Ingredient[];
  steps?: string[];
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  isAIEnriched?: boolean;
};

// ─── RecipePopup ─────────────────────────────────────────────────────────────
export default function RecipePopup({
  meal,
  profile,
  onClose,
  onEnriched,
}: {
  meal: Meal | null;
  profile?: any;
  onClose: () => void;
  onEnriched?: (enriched: Meal) => void;
}) {
  const [enrichedMeal, setEnrichedMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!meal) { setEnrichedMeal(null); setError(false); setLoading(false); return; }

    // Already fully enriched — show immediately, no fetch needed
    if (meal.isAIEnriched && meal.ingredients && meal.ingredients.length > 0) {
      setEnrichedMeal(meal);
      setLoading(false);
      return;
    }

    // Has basic ingredients/steps from Agent A — show immediately, silently upgrade
    if (meal.ingredients && meal.ingredients.length > 0) {
      setEnrichedMeal(meal);
    }

    // Fetch full recipe via Agent B (in background if basic data already shown)
    let cancelled = false;
    setLoading(true);
    setError(false);

    const siteUrls = getActiveSiteUrls(profile);
    const siteNames = siteUrls.map((u: string) =>
      u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")
    );

    fetchRecipeForCard(meal, siteUrls, siteNames)
      .then((result: Meal) => {
        if (cancelled) return;
        setEnrichedMeal(result);
        if (result.isAIEnriched && onEnriched) onEnriched(result);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [meal?.id]);

  if (!meal) return null;
  const display = enrichedMeal || meal;

  return (
    <Modal
      visible={!!meal}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
        {/* Tap backdrop to close */}
        <Pressable style={{ height: 80 }} onPress={onClose} />

        {/* Bottom sheet */}
        <View style={{
          flex: 1,
          backgroundColor: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: "hidden",
        }}>
          {/* ── Drag handle + close bar ── */}
          <View style={{
            alignItems: "center", paddingTop: 10, paddingBottom: 6,
            backgroundColor: "#fff",
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
          }}>
            {/* Pill handle */}
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: "#d1d5db",
            }} />
          </View>

          {/* Close button — always visible, top-right */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute", top: 12, right: 16, zIndex: 20,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center", justifyContent: "center",
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 20 }}>×</Text>
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Hero — food image or gradient fallback */}
            <View style={{
              height: 200, alignItems: "center", justifyContent: "center",
              backgroundColor: "#f0fdf4", overflow: "hidden",
            }}>
              {display.imageUrl ? (
                <Image
                  source={{ uri: display.imageUrl }}
                  style={{ width: "100%", height: 200 }}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 72 }}>🍛</Text>
                  {loading && (
                    <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                      Loading recipe image...
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View style={{ padding: 20 }}>

              {/* Title + meta */}
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#1f2937", marginBottom: 4 }}>
                {display.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: "#9ca3af" }}>
                  {display.cuisine} · ⏱ {display.cookTime} min
                </Text>
              </View>
              {display.sourceName && (
                <TouchableOpacity
                  onPress={() => display.sourceUrl && Linking.openURL(display.sourceUrl)}
                  disabled={!display.sourceUrl}
                  style={{ marginBottom: 4 }}
                >
                  <Text style={{ fontSize: 12, color: "#16a34a" }}>
                    from {display.sourceName} {display.sourceUrl ? "↗" : ""}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Macros bar */}
              {display.macros && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 20 }}>
                  {[
                    { label: "Cal", value: display.macros.cal, color: "#ea580c" },
                    { label: "Protein", value: `${display.macros.protein}g`, color: "#2563eb" },
                    { label: "Carbs", value: `${display.macros.carbs}g`, color: "#d97706" },
                    { label: "Fat", value: `${display.macros.fat}g`, color: "#e11d48" },
                  ].map((m) => (
                    <View key={m.label} style={{
                      flex: 1, backgroundColor: "#f9fafb", borderRadius: 12,
                      paddingVertical: 10, alignItems: "center",
                    }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: m.color }}>{m.value}</Text>
                      <Text style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Prep warning */}
              {display.prepAhead && display.prepNote && (
                <View style={{
                  backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 13, color: "#b45309" }}>
                    🕐 <Text style={{ fontWeight: "700" }}>Prep needed:</Text> {display.prepNote}
                  </Text>
                </View>
              )}

              {/* Loading state — small banner if we already have basic data, full spinner otherwise */}
              {loading && enrichedMeal && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 8,
                  backgroundColor: "#f0fdf4", borderRadius: 10, paddingHorizontal: 12,
                  paddingVertical: 8, marginBottom: 16,
                }}>
                  <ActivityIndicator color="#16a34a" size="small" />
                  <Text style={{ fontSize: 12, color: "#15803d" }}>Fetching full recipe from trusted sites…</Text>
                </View>
              )}
              {loading && !enrichedMeal && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <ActivityIndicator color="#16a34a" size="large" />
                  <Text style={{ fontSize: 13, color: "#9ca3af", marginTop: 12 }}>
                    Fetching recipe...
                  </Text>
                </View>
              )}

              {/* Error state */}
              {error && !loading && (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>😕</Text>
                  <Text style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                    Couldn't fetch the full recipe right now.{"\n"}
                    Basic info is shown above.
                  </Text>
                </View>
              )}

              {/* Ingredients */}
              {display.ingredients && display.ingredients.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 10 }}>
                    Ingredients
                  </Text>
                  {display.ingredients.map((ing, i) => (
                    <View key={i} style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
                    }}>
                      <Text style={{
                        fontSize: 14, flex: 1,
                        color: ing.inPantry ? "#9ca3af" : "#1f2937",
                        textDecorationLine: ing.inPantry ? "line-through" : "none",
                      }}>
                        {ing.inPantry ? "✓ " : "• "}{ing.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                        {ing.quantity} {ing.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Steps */}
              {display.steps && display.steps.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 10 }}>
                    Method
                  </Text>
                  {display.steps.map((step, i) => (
                    <View key={i} style={{ flexDirection: "row", marginBottom: 12 }}>
                      <View style={{
                        width: 24, height: 24, borderRadius: 12,
                        backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center",
                        marginRight: 12, marginTop: 1, flexShrink: 0,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#15803d" }}>{i + 1}</Text>
                      </View>
                      <Text style={{ fontSize: 14, color: "#4b5563", flex: 1, lineHeight: 20 }}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Not enriched notice */}
              {!loading && !error && !enrichedMeal?.isAIEnriched && (
                <Text style={{ fontSize: 11, color: "#d1d5db", marginTop: 8 }}>
                  Full recipe details not yet available for this dish.
                </Text>
              )}

              {/* Close button at bottom for easy reach */}
              <TouchableOpacity
                onPress={onClose}
                style={{
                  marginTop: 16, paddingVertical: 14, borderRadius: 16,
                  backgroundColor: "#f3f4f6", alignItems: "center",
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280" }}>← Back to meals</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
