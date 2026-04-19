import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import WelcomeCarousel from "../components/WelcomeCarousel";
import { C, F, R } from "../lib/theme";

const STEPS = ["Household", "Diet", "Cuisine", "Calories"];

const DIET_OPTIONS = [
  { value: "veg",        label: "🥦 Vegetarian" },
  { value: "eggetarian", label: "🥚 Eggetarian" },
  { value: "nonveg",     label: "🍗 Non-Vegetarian" },
  { value: "jain",       label: "🙏 Jain" },
  { value: "vegan",      label: "🌱 Vegan" },
];

const CUISINE_OPTIONS = [
  "North Indian", "South Indian", "Maharashtrian",
  "Gujarati", "Bengali", "Udupi", "Continental", "Pan-Indian",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [config, setConfig] = useState({ persons: 2, diet: "", cuisines: [] as string[], calorieTarget: "" });

  const update = (key: string, val: any) => setConfig((p) => ({ ...p, [key]: val }));
  const toggleCuisine = (c: string) => {
    const curr = config.cuisines;
    update("cuisines", curr.includes(c) ? curr.filter((x) => x !== c) : [...curr, c]);
  };
  const canContinue = () => {
    if (step === 1 && !config.diet) return false;
    if (step === 2 && config.cuisines.length === 0) return false;
    return true;
  };

  const finish = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }
    await supabase.from("profiles").upsert({
      id: session.user.id, email: session.user.email,
      full_name: session.user.user_metadata?.full_name || "",
      config: { ...config, guideSeen: { welcome: false } },
    });
    setSaving(false);
    setShowWelcome(true);
  };

  const finishWelcome = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from("profiles").select("config").eq("id", session.user.id).maybeSingle();
      const existing = data?.config || {};
      await supabase.from("profiles").update({ config: { ...existing, guideSeen: { ...(existing.guideSeen || {}), welcome: true } } }).eq("id", session.user.id);
    }
    router.replace("/(tabs)");
  };

  if (showWelcome) return <WelcomeCarousel onDone={finishWelcome} />;

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontFamily: F.headingBold, fontSize: 22, color: C.primary }}>🏠 GharOS</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 6 }}>
            <Text style={{ fontFamily: F.body, fontSize: 12, color: C.inkMuted }}>Step {step + 1} of {STEPS.length}</Text>
            <Text style={{ fontFamily: F.bodyMedium, fontSize: 12, color: C.primary }}>{STEPS[step]}</Text>
          </View>
          {/* Progress bar */}
          <View style={{ width: "100%", height: 6, backgroundColor: C.border, borderRadius: 3 }}>
            <View style={{ width: `${progress}%`, height: 6, backgroundColor: C.primary, borderRadius: 3 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            {STEPS.map((s, i) => (
              <Text key={s} style={{ fontFamily: i === step ? F.bodyMedium : F.body, fontSize: 11, color: i === step ? C.primary : C.border }}>
                {s}
              </Text>
            ))}
          </View>
        </View>

        {/* Card */}
        <View style={{ backgroundColor: C.card, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 24 }}>

          {/* Step 0 — Household */}
          {step === 0 && (
            <View>
              <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, marginBottom: 6 }}>
                How many people are you cooking for?
              </Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 28 }}>
                We'll use this to scale ingredient quantities.
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 }}>
                <TouchableOpacity onPress={() => update("persons", Math.max(1, config.persons - 1))}
                  style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.accentLight, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
                  activeOpacity={0.7}>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 22, color: C.primary }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: F.headingBold, fontSize: 52, color: C.primary }}>{config.persons}</Text>
                <TouchableOpacity onPress={() => update("persons", Math.min(10, config.persons + 1))}
                  style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.accentLight, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
                  activeOpacity={0.7}>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 22, color: C.primary }}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, textAlign: "center", marginTop: 14 }}>
                {config.persons === 1 ? "Cooking for yourself 🧑‍🍳" : `Cooking for ${config.persons} people 👨‍👩‍👧`}
              </Text>
            </View>
          )}

          {/* Step 1 — Diet */}
          {step === 1 && (
            <View>
              <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, marginBottom: 6 }}>
                What's your diet preference?
              </Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 20 }}>
                This shapes every meal we suggest.
              </Text>
              <View style={{ gap: 10 }}>
                {DIET_OPTIONS.map((d) => {
                  const active = config.diet === d.value;
                  return (
                    <TouchableOpacity key={d.value} onPress={() => update("diet", d.value)}
                      style={{ paddingHorizontal: 16, paddingVertical: 14, borderRadius: R.button, borderWidth: 1.5, borderColor: active ? C.primary : C.border, backgroundColor: active ? C.accentLight : C.cream }}
                      activeOpacity={0.7}>
                      <Text style={{ fontFamily: active ? F.bodyMedium : F.body, fontSize: 14, color: active ? C.primary : C.inkMuted }}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 2 — Cuisine */}
          {step === 2 && (
            <View>
              <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, marginBottom: 6 }}>
                Which cuisines do you enjoy?
              </Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 20 }}>
                Pick as many as you like.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CUISINE_OPTIONS.map((c) => {
                  const active = config.cuisines.includes(c);
                  return (
                    <TouchableOpacity key={c} onPress={() => toggleCuisine(c)}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1.5, borderColor: active ? C.primary : C.border, backgroundColor: active ? C.accentLight : C.card }}
                      activeOpacity={0.7}>
                      <Text style={{ fontFamily: active ? F.bodyMedium : F.body, fontSize: 13, color: active ? C.primary : C.inkMuted }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {config.cuisines.length > 0 && (
                <Text style={{ fontFamily: F.body, fontSize: 12, color: C.primary, marginTop: 10 }}>
                  {config.cuisines.length} selected ✓
                </Text>
              )}
            </View>
          )}

          {/* Step 3 — Calories */}
          {step === 3 && (
            <View>
              <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, marginBottom: 6 }}>
                Daily calorie target
              </Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 20 }}>
                Optional — we'll show a soft alert if a day goes over.
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="e.g. 2000"
                  value={config.calorieTarget}
                  onChangeText={(v) => update("calorieTarget", v)}
                  keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.input, paddingHorizontal: 16, paddingVertical: 14, fontFamily: F.body, fontSize: 16, color: C.ink, backgroundColor: C.cream }}
                  placeholderTextColor={C.inkFaint}
                />
                <Text style={{ position: "absolute", right: 16, top: 15, fontFamily: F.body, fontSize: 13, color: C.inkMuted }}>
                  kcal / day
                </Text>
              </View>
              <Text style={{ fontFamily: F.body, fontSize: 12, color: C.inkMuted, marginTop: 10 }}>
                💡 Average Indian adult needs 1800–2200 kcal/day
              </Text>
              <Text style={{ fontFamily: F.body, fontSize: 12, color: C.inkFaint, marginTop: 4 }}>
                Leave blank to skip.
              </Text>
            </View>
          )}

          {/* Navigation */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 28, gap: 10 }}>
            {step > 0 ? (
              <TouchableOpacity onPress={() => setStep((s) => s - 1)}
                style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: R.button, borderWidth: 1, borderColor: C.border }}
                activeOpacity={0.7}>
                <Text style={{ fontFamily: F.bodyMedium, fontSize: 13, color: C.inkMuted }}>← Back</Text>
              </TouchableOpacity>
            ) : <View />}

            {step < STEPS.length - 1 ? (
              <TouchableOpacity onPress={() => setStep((s) => s + 1)} disabled={!canContinue()}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: C.primary, borderRadius: R.button, alignItems: "center", opacity: canContinue() ? 1 : 0.4 }}
                activeOpacity={0.8}>
                <Text style={{ fontFamily: F.bodyMedium, fontSize: 14, color: C.white }}>Continue →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={finish} disabled={saving}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: C.primary, borderRadius: R.button, alignItems: "center", opacity: saving ? 0.6 : 1 }}
                activeOpacity={0.8}>
                {saving
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={{ fontFamily: F.bodyMedium, fontSize: 14, color: C.white }}>Let's go! 🚀</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
