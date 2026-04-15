import { Tabs } from "expo-router";
import { View, Text } from "react-native";

type TabIconProps = { focused: boolean; emoji: string; label: string };

function TabIcon({ focused, emoji, label }: TabIconProps) {
  return (
    <View className="items-center justify-center pt-1">
      <Text style={{ fontSize: 19 }}>{emoji}</Text>
      <Text className={`text-xs mt-0.5 ${focused ? "text-green-600 font-semibold" : "text-gray-400"}`}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 64,
          borderTopWidth: 1,
          borderTopColor: "#f0f0f0",
          backgroundColor: "#ffffff",
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🏠" label="Home" /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="📅" label="Plan" /> }}
      />
      <Tabs.Screen
        name="pantry"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🧺" label="Pantry" /> }}
      />
      <Tabs.Screen
        name="shopping"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🛒" label="Shopping" /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="⚙️" label="Settings" /> }}
      />
    </Tabs>
  );
}
