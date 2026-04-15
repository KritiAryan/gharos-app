import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

// Entry point — checks session, then onboarding status
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("config")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!profile || !profile.config) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    });
  }, []);

  return (
    <View className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  );
}
