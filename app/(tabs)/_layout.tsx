import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F } from "../lib/theme";

type TabIconProps = { focused: boolean; emoji: string; label: string };

function TabIcon({ focused, emoji, label }: TabIconProps) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
      <Text style={{ fontSize: 19 }}>{emoji}</Text>
      <Text style={{
        fontSize: 10, marginTop: 2,
        fontFamily: focused ? F.bodyMedium : F.body,
        color: focused ? C.primary : C.inkFaint,
      }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 64 + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: C.border,
          backgroundColor: C.card,
          paddingBottom: 8 + insets.bottom,
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🏠" label="Home" /> }} />
      <Tabs.Screen name="plan"     options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="📅" label="Plan" /> }} />
      <Tabs.Screen name="pantry"   options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🧺" label="Pantry" /> }} />
      <Tabs.Screen name="shopping" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🛒" label="Shopping" /> }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="⚙️" label="Settings" /> }} />
    </Tabs>
  );
}
