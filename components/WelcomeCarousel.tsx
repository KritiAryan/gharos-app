import { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, F, R } from "../lib/theme";

type Slide = { emoji: string; title: string; body: string };

const SLIDES: Slide[] = [
  {
    emoji: "🍽️",
    title: "We suggest your meals",
    body: "Tell us your diet, cuisines, and household size — we'll recommend meals you'll actually want to cook.",
  },
  {
    emoji: "🛒",
    title: "Smart shopping list",
    body: "We only list what's missing from your pantry, grouped by category, with price comparisons across apps.",
  },
  {
    emoji: "👩‍🍳",
    title: "Meal prep made easy",
    body: "Get a weekend prep plan + daily quick-cook cards with timers, so weekday cooking takes minutes.",
  },
];

export default function WelcomeCarousel({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      {/* Top bar */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={{ fontFamily: F.heading, fontSize: 18, color: C.primary }}>🏠 GharOS</Text>
        {!isLast && (
          <TouchableOpacity onPress={onDone} activeOpacity={0.7}>
            <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkMuted }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 }}>
            <Text style={{ fontSize: 80, marginBottom: 28 }}>{s.emoji}</Text>
            <Text style={{ fontFamily: F.headingBold, fontSize: 24, color: C.ink, textAlign: "center", marginBottom: 14 }}>
              {s.title}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 15, color: C.inkMuted, textAlign: "center", lineHeight: 24 }}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{
              width: i === index ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? C.primary : C.border,
            }} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => (isLast ? onDone() : goTo(index + 1))}
          style={{
            width: "100%", paddingVertical: 16,
            backgroundColor: C.primary, borderRadius: R.button,
            alignItems: "center",
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontFamily: F.bodyMedium, fontSize: 15, color: C.white }}>
            {isLast ? "Let's go! 🚀" : "Next →"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
