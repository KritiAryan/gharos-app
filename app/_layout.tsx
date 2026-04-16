import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import { TimerProvider } from "../contexts/TimerContext";
import FloatingTimer from "../components/FloatingTimer";

export default function RootLayout() {
  const router = useRouter();

  // Listen for sign-in / sign-out events that happen while the app is open
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <TimerProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <FloatingTimer />
        <StatusBar style="dark" />
      </View>
    </TimerProvider>
  );
}
