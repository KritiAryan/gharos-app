import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useGuideSeen, GuideKey } from "../hooks/useGuideSeen";
import { C, F, R } from "../lib/theme";

type Props = {
  screenKey: GuideKey;
  emoji?: string;
  title: string;
  points: string[];
};

export default function ScreenGuide({ screenKey, emoji, title, points }: Props) {
  const { shouldShow, markSeen } = useGuideSeen(screenKey);

  return (
    <Modal visible={shouldShow} transparent animationType="fade" onRequestClose={markSeen}>
      <Pressable
        onPress={markSeen}
        style={{ flex: 1, backgroundColor: "rgba(44,26,14,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
      >
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 400, backgroundColor: C.card, borderRadius: R.card, padding: 24, borderWidth: 1, borderColor: C.border }}>
          {emoji && (
            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>{emoji}</Text>
          )}
          <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, textAlign: "center", marginBottom: 16 }}>
            {title}
          </Text>

          <View style={{ gap: 10, marginBottom: 24 }}>
            {points.map((p, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                <Text style={{ color: C.primary, fontFamily: F.bodyMedium }}>•</Text>
                <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.inkMuted, lineHeight: 20 }}>{p}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={markSeen}
            style={{ paddingVertical: 14, backgroundColor: C.primary, borderRadius: R.button, alignItems: "center" }}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bodyMedium, fontSize: 14, color: C.white }}>Got it ✓</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
