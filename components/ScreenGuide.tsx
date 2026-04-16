import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useGuideSeen, GuideKey } from "../hooks/useGuideSeen";

type Props = {
  screenKey: GuideKey;
  emoji?: string;
  title: string;
  points: string[];
};

/**
 * One-time contextual guide overlay for a screen.
 * Automatically no-ops once the user has seen it (tracked per-user in profile.config.guideSeen).
 */
export default function ScreenGuide({ screenKey, emoji, title, points }: Props) {
  const { shouldShow, markSeen } = useGuideSeen(screenKey);

  return (
    <Modal
      visible={shouldShow}
      transparent
      animationType="fade"
      onRequestClose={markSeen}
    >
      <Pressable
        onPress={markSeen}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        {/* stopPropagation so taps inside don't dismiss */}
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: "white",
            borderRadius: 20,
            padding: 24,
          }}
        >
          {emoji && (
            <Text style={{ fontSize: 48 }} className="text-center mb-2">
              {emoji}
            </Text>
          )}
          <Text className="text-xl font-bold text-gray-800 text-center mb-4">
            {title}
          </Text>

          <View className="gap-3 mb-6">
            {points.map((p, i) => (
              <View key={i} className="flex-row gap-2">
                <Text className="text-green-500 font-bold">•</Text>
                <Text className="flex-1 text-gray-600 text-sm leading-5">{p}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={markSeen}
            className="w-full py-3 bg-green-500 rounded-xl items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">Got it ✓</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
