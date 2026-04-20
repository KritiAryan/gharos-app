import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import { TimerProvider } from "../contexts/TimerContext";
import FloatingTimer from "../components/FloatingTimer";
import {
  useFonts,
  Lora_600SemiBold,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    Lora_600SemiBold,
    Lora_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    // Hide splash whether fonts loaded OR failed — never hang on splash screen
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // App opens even if fonts fail — system fonts used as fallback
  if (!fontsLoaded && !fontError) return null;

  return (
    <TimerProvider>
      <View style={{ flex: 1, backgroundColor: "#FBF6EF" }}>
        <Stack screenOptions={{ headerShown: false }} />
        <FloatingTimer />
        <StatusBar style="dark" />
      </View>
    </TimerProvider>
  );
}
