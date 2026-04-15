import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Storage adapter — lazy checks so Metro's Node.js bundler doesn't crash
// on web: uses localStorage (checked at call-time, not import-time)
// on Android/iOS: uses AsyncStorage
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key) =>
          Promise.resolve(
            typeof localStorage !== "undefined"
              ? localStorage.getItem(key)
              : null
          ),
        setItem: (key, value) => {
          if (typeof localStorage !== "undefined")
            localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key) => {
          if (typeof localStorage !== "undefined")
            localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : require("@react-native-async-storage/async-storage").default;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
