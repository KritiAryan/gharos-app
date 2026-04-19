import { useState } from "react";
import { useRouter } from "expo-router";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { C, F, R } from "../lib/theme";

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
    setError(""); setMessage(""); setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) setError(error.message);
      else setMessage("Check your email for a confirmation link!");
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); }
      else {
        const { data: profile } = await supabase.from("profiles").select("config").eq("id", data.user!.id).maybeSingle();
        if (!profile || !profile.config) router.replace("/onboarding");
        else router.replace("/(tabs)");
      }
    }
    setLoading(false);
  };

  const toggleMode = () => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); };
  const canSubmit = !loading && !!email && !!password && (mode === "login" || !!name);

  const inputStyle = {
    borderWidth: 1, borderColor: C.border, borderRadius: R.input,
    paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: F.body, fontSize: 14, color: C.ink,
    backgroundColor: C.cream,
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 48 }}>

          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Text style={{ fontFamily: F.headingBold, fontSize: 36, color: C.primary }}>🏠 GharOS</Text>
            <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkMuted, marginTop: 6 }}>
              Your family meal planner
            </Text>
          </View>

          {/* Card */}
          <View style={{ backgroundColor: C.card, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 28 }}>
            <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, marginBottom: 24 }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </Text>

            {mode === "signup" && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 6 }}>Your name</Text>
                <TextInput placeholder="e.g. Kriti" value={name} onChangeText={setName} autoCapitalize="words" style={inputStyle} placeholderTextColor={C.inkFaint} />
              </View>
            )}

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 6 }}>Email</Text>
              <TextInput placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={inputStyle} placeholderTextColor={C.inkFaint} />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted, marginBottom: 6 }}>Password</Text>
              <TextInput placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry style={inputStyle} placeholderTextColor={C.inkFaint} />
            </View>

            {!!error && (
              <View style={{ marginBottom: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: R.button }}>
                <Text style={{ fontFamily: F.body, fontSize: 13, color: "#DC2626" }}>{error}</Text>
              </View>
            )}

            {!!message && (
              <View style={{ marginBottom: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.accentLight, borderWidth: 1, borderColor: C.accent, borderRadius: R.button }}>
                <Text style={{ fontFamily: F.body, fontSize: 13, color: C.primary }}>{message}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={{ paddingVertical: 14, backgroundColor: C.primary, borderRadius: R.button, alignItems: "center", opacity: canSubmit ? 1 : 0.4 }}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={C.white} />
                : <Text style={{ fontFamily: F.bodyMedium, fontSize: 15, color: C.white }}>
                    {mode === "login" ? "Sign in →" : "Create account →"}
                  </Text>
              }
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.inkMuted }}>
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              </Text>
              <TouchableOpacity onPress={toggleMode}>
                <Text style={{ fontFamily: F.bodyMedium, fontSize: 13, color: C.primary }}>
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
