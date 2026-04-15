import { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) setError(error.message);
      else setMessage("Check your email for a confirmation link!");
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); }
      else {
        // Check onboarding status
        const { data: profile } = await supabase
          .from("profiles").select("config").eq("id", data.user!.id).maybeSingle();
        if (!profile || !profile.config) router.replace("/onboarding");
        else router.replace("/(tabs)");
      }
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setMessage("");
  };

  const canSubmit = !loading && !!email && !!password && (mode === "login" || !!name);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">

          {/* Logo */}
          <View className="items-center mb-10">
            <Text className="text-4xl font-bold text-green-600">🏠 GharOS</Text>
            <Text className="text-gray-400 text-sm mt-2">Your family meal planner</Text>
          </View>

          {/* Card */}
          <View className="bg-white rounded-2xl border border-gray-100 p-8"
            style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
          >
            <Text className="text-xl font-bold text-gray-800 mb-6">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </Text>

            {/* Name — signup only */}
            {mode === "signup" && (
              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-1">Your name</Text>
                <TextInput
                  placeholder="e.g. Kriti"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
                />
              </View>
            )}

            {/* Email */}
            <View className="mb-4">
              <Text className="text-sm text-gray-500 mb-1">Email</Text>
              <TextInput
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
              />
            </View>

            {/* Password */}
            <View className="mb-6">
              <Text className="text-sm text-gray-500 mb-1">Password</Text>
              <TextInput
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
              />
            </View>

            {/* Error message */}
            {!!error && (
              <View className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                <Text className="text-red-500 text-sm">{error}</Text>
              </View>
            )}

            {/* Success message */}
            {!!message && (
              <View className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                <Text className="text-green-600 text-sm">{message}</Text>
              </View>
            )}

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className="py-3 bg-green-500 rounded-xl items-center"
              style={{ opacity: canSubmit ? 1 : 0.4 }}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  {mode === "login" ? "Sign in →" : "Create account →"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle login/signup */}
            <View className="flex-row justify-center mt-5">
              <Text className="text-gray-400 text-sm">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              </Text>
              <TouchableOpacity onPress={toggleMode}>
                <Text className="text-green-500 font-semibold text-sm">
                  {mode === "login" ? "Sign up" : "Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
