import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const router = useRouter();

  // Listen for sign-in / sign-out events that happen while the app is open
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only handle sign-out here — sign-in redirect is handled by login.tsx and index.tsx
      // to avoid false triggers from session recovery firing SIGNED_IN repeatedly
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </>
  );
}
