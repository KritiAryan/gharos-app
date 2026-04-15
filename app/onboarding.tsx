import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

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
  "Gujarati", "Bengali", "Udupi",
  "Continental", "Pan-Indian",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    persons: 2,
    diet: "",
    cuisines: [] as string[],
    calorieTarget: "",
  });

  const update = (key: string, val: any) =>
    setConfig((p) => ({ ...p, [key]: val }));

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
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || "",
      config,
    });
    setSaving(false);
    router.replace("/(tabs)");
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-green-700">🏠 GharOS</Text>
          <View className="flex-row items-center justify-between mt-2 mb-1">
            <Text className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</Text>
            <Text className="text-xs text-green-600 font-medium">{STEPS[step]}</Text>
          </View>
          {/* Progress bar */}
          <View className="w-full bg-gray-200 rounded-full h-2">
            <View className="bg-green-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
          </View>
          {/* Step dots */}
          <View className="flex-row justify-between mt-2">
            {STEPS.map((s, i) => (
              <Text key={s} className={`text-xs ${i === step ? "text-green-600 font-semibold" : "text-gray-300"}`}>
                {s}
              </Text>
            ))}
          </View>
        </View>

        {/* Card */}
        <View className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ elevation: 2 }}>

          {/* Step 0 — Household */}
          {step === 0 && (
            <View>
              <Text className="text-xl font-bold text-gray-800 mb-1">
                How many people are you cooking for?
              </Text>
              <Text className="text-gray-400 text-sm mb-6">
                We'll use this to scale ingredient quantities.
              </Text>
              <View className="flex-row items-center gap-8 justify-center mt-2">
                <TouchableOpacity
                  onPress={() => update("persons", Math.max(1, config.persons - 1))}
                  className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-2xl font-bold text-gray-600">−</Text>
                </TouchableOpacity>
                <Text className="text-5xl font-bold text-green-600">{config.persons}</Text>
                <TouchableOpacity
                  onPress={() => update("persons", Math.min(10, config.persons + 1))}
                  className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-2xl font-bold text-gray-600">+</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-center text-gray-400 text-sm mt-4">
                {config.persons === 1 ? "Cooking for yourself 🧑‍🍳" : `Cooking for ${config.persons} people 👨‍👩‍👧`}
              </Text>
            </View>
          )}

          {/* Step 1 — Diet */}
          {step === 1 && (
            <View>
              <Text className="text-xl font-bold text-gray-800 mb-1">
                What's your diet preference?
              </Text>
              <Text className="text-gray-400 text-sm mb-5">
                This shapes every meal we suggest.
              </Text>
              <View className="gap-3">
                {DIET_OPTIONS.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => update("diet", d.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 ${
                      config.diet === d.value
                        ? "border-green-500 bg-green-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm ${
                      config.diet === d.value
                        ? "text-green-700 font-semibold"
                        : "text-gray-600"
                    }`}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2 — Cuisine */}
          {step === 2 && (
            <View>
              <Text className="text-xl font-bold text-gray-800 mb-1">
                Which cuisines do you enjoy?
              </Text>
              <Text className="text-gray-400 text-sm mb-5">
                Pick as many as you like.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CUISINE_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => toggleCuisine(c)}
                    className={`px-4 py-2 rounded-full border-2 ${
                      config.cuisines.includes(c)
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm ${
                      config.cuisines.includes(c)
                        ? "text-green-700 font-semibold"
                        : "text-gray-500"
                    }`}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {config.cuisines.length > 0 && (
                <Text className="text-xs text-green-600 mt-3">
                  {config.cuisines.length} selected ✓
                </Text>
              )}
            </View>
          )}

          {/* Step 3 — Calories */}
          {step === 3 && (
            <View>
              <Text className="text-xl font-bold text-gray-800 mb-1">
                Daily calorie target
              </Text>
              <Text className="text-gray-400 text-sm mb-5">
                Optional — we'll show a soft alert if a day goes over.
              </Text>
              <View className="relative">
                <TextInput
                  placeholder="e.g. 2000"
                  value={config.calorieTarget}
                  onChangeText={(v) => update("calorieTarget", v)}
                  keyboardType="number-pad"
                  className="border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-700 text-lg"
                />
                <Text className="absolute right-4 top-3.5 text-gray-400 text-sm">
                  kcal / day
                </Text>
              </View>
              <Text className="text-xs text-gray-400 mt-3">
                💡 Average Indian adult needs 1800–2200 kcal/day
              </Text>
              <Text className="text-xs text-gray-400 mt-1">
                Leave blank to skip.
              </Text>
            </View>
          )}

          {/* Navigation */}
          <View className="flex-row justify-between mt-8 gap-3">
            {step > 0 ? (
              <TouchableOpacity
                onPress={() => setStep((s) => s - 1)}
                className="px-5 py-3 rounded-xl border-2 border-gray-200"
                activeOpacity={0.7}
              >
                <Text className="text-gray-500 text-sm font-medium">← Back</Text>
              </TouchableOpacity>
            ) : <View />}

            {step < STEPS.length - 1 ? (
              <TouchableOpacity
                onPress={() => setStep((s) => s + 1)}
                disabled={!canContinue()}
                className="flex-1 py-3 bg-green-500 rounded-xl items-center"
                style={{ opacity: canContinue() ? 1 : 0.4 }}
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-sm">Continue →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={finish}
                disabled={saving}
                className="flex-1 py-3 bg-green-500 rounded-xl items-center"
                style={{ opacity: saving ? 0.6 : 1 }}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-white font-semibold text-sm">Let's go! 🚀</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
