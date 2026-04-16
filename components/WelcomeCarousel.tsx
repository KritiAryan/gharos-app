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

type Slide = {
  emoji: string;
  title: string;
  body: string;
};

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
    <SafeAreaView className="flex-1 bg-white">
      {/* Top: Skip */}
      <View className="flex-row justify-between items-center px-5 pt-3">
        <Text className="text-base font-bold text-green-700">🏠 GharOS</Text>
        {!isLast && (
          <TouchableOpacity onPress={onDone} activeOpacity={0.7}>
            <Text className="text-sm text-gray-400 font-medium">Skip</Text>
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
        className="flex-1"
      >
        {SLIDES.map((s, i) => (
          <View
            key={i}
            style={{ width }}
            className="flex-1 items-center justify-center px-8"
          >
            <Text style={{ fontSize: 80 }} className="mb-6">
              {s.emoji}
            </Text>
            <Text className="text-2xl font-bold text-gray-800 text-center mb-3">
              {s.title}
            </Text>
            <Text className="text-base text-gray-500 text-center leading-6">
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + CTA */}
      <View className="px-6 pb-8">
        <View className="flex-row justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? "#16a34a" : "#d1d5db",
              }}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => (isLast ? onDone() : goTo(index + 1))}
          className="w-full py-4 bg-green-500 rounded-xl items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">
            {isLast ? "Let's go! 🚀" : "Next →"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
