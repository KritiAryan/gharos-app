// This file is intentionally minimal — the real Home tab is at app/(tabs)/index.tsx
// Kept here to avoid breaking any stale navigation references.
import { Redirect } from "expo-router";
export default function OldHome() {
  return <Redirect href="/(tabs)" />;
}
