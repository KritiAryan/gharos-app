import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  Modal, ActivityIndicator, Linking,
} from "react-native";
import { Image } from "expo-image";
import { fetchRecipeForCard } from "../services/geminiService";
import { getActiveSiteUrls } from "../data/recipeSites";
import { C, F, R } from "../lib/theme";

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

export default function RecipePopup({
  meal, profile, onClose, onEnriched,
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

    if (meal.isAIEnriched && meal.ingredients && meal.ingredients.length > 0) {
      setEnrichedMeal(meal); setLoading(false); return;
    }

    if (meal.ingredients && meal.ingredients.length > 0) {
      setEnrichedMeal(meal);
    }

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
    <Modal visible={!!meal} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(44,26,14,0.55)" }}>
        <Pressable style={{ height: 80 }} onPress={onClose} />

        <View style={{ flex: 1, backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>

          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute", top: 12, right: 16, zIndex: 20,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: "rgba(44,26,14,0.5)", alignItems: "center", justifyContent: "center",
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: C.white, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>×</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Hero image */}
            <View style={{ height: 200, alignItems: "center", justifyContent: "center", backgroundColor: C.accentLight, overflow: "hidden" }}>
              {display.imageUrl ? (
                <Image source={{ uri: display.imageUrl }} style={{ width: "100%", height: 200 }} contentFit="cover" transition={300} />
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 72 }}>🍛</Text>
                  {loading && <Text style={{ fontFamily: F.body, fontSize: 11, color: C.inkFaint, marginTop: 8 }}>Loading image...</Text>}
                </View>
              )}
            </View>

            <View style={{ padding: 20 }}>
              {/* Title */}
              <Text style={{ fontFamily: F.headingBold, fontSize: 22, color: C.ink, marginBottom: 4 }}>{display.name}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 4 }}>
                {display.cuisine} · ⏱ {display.cookTime} min
              </Text>
              {display.sourceName && (
                <TouchableOpacity onPress={() => display.sourceUrl && Linking.openURL(display.sourceUrl)} disabled={!display.sourceUrl} style={{ marginBottom: 4 }}>
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.primary }}>
                    from {display.sourceName} {display.sourceUrl ? "↗" : ""}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Macros */}
              {display.macros && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 20 }}>
                  {[
                    { label: "Cal",     value: display.macros.cal,              color: "#B45309" },
                    { label: "Protein", value: `${display.macros.protein}g`,    color: C.primary },
                    { label: "Carbs",   value: `${display.macros.carbs}g`,      color: "#A0612D" },
                    { label: "Fat",     value: `${display.macros.fat}g`,        color: "#7A5C44" },
                  ].map((m) => (
                    <View key={m.label} style={{ flex: 1, backgroundColor: C.accentLight, borderRadius: R.card, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ fontFamily: F.bodyMedium, fontSize: 15, fontWeight: "700", color: m.color }}>{m.value}</Text>
                      <Text style={{ fontFamily: F.body, fontSize: 10, color: C.inkFaint, marginTop: 2 }}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Prep warning */}
              {display.prepAhead && display.prepNote && (
                <View style={{ backgroundColor: C.accentLight, borderWidth: 1, borderColor: C.accent, borderRadius: R.card, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                  <Text style={{ fontFamily: F.body, fontSize: 13, color: C.primary }}>
                    🕐 <Text style={{ fontFamily: F.bodyMedium }}>Prep needed:</Text> {display.prepNote}
                  </Text>
                </View>
              )}

              {/* Loading banner */}
              {loading && enrichedMeal && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.accentLight, borderRadius: R.button, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
                  <ActivityIndicator color={C.primary} size="small" />
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.primary }}>Fetching full recipe from trusted sites…</Text>
                </View>
              )}
              {loading && !enrichedMeal && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <ActivityIndicator color={C.primary} size="large" />
                  <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginTop: 12 }}>Fetching recipe...</Text>
                </View>
              )}

              {/* Error */}
              {error && !loading && (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>😕</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, textAlign: "center" }}>
                    Couldn't fetch the full recipe right now.{"\n"}Basic info is shown above.
                  </Text>
                </View>
              )}

              {/* Ingredients */}
              {display.ingredients && display.ingredients.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontFamily: F.heading, fontSize: 15, color: C.ink, marginBottom: 10 }}>Ingredients</Text>
                  {display.ingredients.map((ing, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
                      <Text style={{ fontFamily: F.body, fontSize: 14, flex: 1, color: ing.inPantry ? C.inkFaint : C.ink, textDecorationLine: ing.inPantry ? "line-through" : "none" }}>
                        {ing.inPantry ? "✓ " : "• "}{ing.name}
                      </Text>
                      <Text style={{ fontFamily: F.body, fontSize: 12, color: C.inkFaint, marginLeft: 8 }}>
                        {ing.quantity} {ing.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Steps */}
              {display.steps && display.steps.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontFamily: F.heading, fontSize: 15, color: C.ink, marginBottom: 10 }}>Method</Text>
                  {display.steps.map((step, i) => (
                    <View key={i} style={{ flexDirection: "row", marginBottom: 12 }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentLight, alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 1, flexShrink: 0, borderWidth: 1, borderColor: C.accent }}>
                        <Text style={{ fontFamily: F.bodyMedium, fontSize: 12, color: C.primary }}>{i + 1}</Text>
                      </View>
                      <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkMuted, flex: 1, lineHeight: 20 }}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!loading && !error && !enrichedMeal?.isAIEnriched && (
                <Text style={{ fontFamily: F.body, fontSize: 11, color: C.border, marginTop: 8 }}>
                  Full recipe details not yet available for this dish.
                </Text>
              )}

              {/* Close button */}
              <TouchableOpacity
                onPress={onClose}
                style={{ marginTop: 16, paddingVertical: 14, borderRadius: R.button, backgroundColor: C.accentLight, alignItems: "center", borderWidth: 1, borderColor: C.border }}
                activeOpacity={0.7}
              >
                <Text style={{ fontFamily: F.bodyMedium, fontSize: 14, color: C.inkMuted }}>← Back to meals</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
