import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Vibration } from "react-native";
import { useTimer } from "../contexts/TimerContext";
import { C, F, R } from "../lib/theme";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FloatingTimer() {
  const { timer, pauseTimer, resumeTimer, stopTimer } = useTimer();
  const [expanded, setExpanded] = useState(false);
  const [finished, setFinished] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (timer.remainingSeconds === 0 && timer.totalSeconds > 0 && !timer.active) {
      setFinished(true);
      setExpanded(true);
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 300, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        { iterations: 5 }
      ).start();
    } else {
      setFinished(false);
    }
  }, [timer.remainingSeconds, timer.active]);

  if (!timer.active && !finished) return null;

  const pct = timer.totalSeconds > 0
    ? ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100
    : 0;

  const isLow = timer.remainingSeconds <= 30 && timer.remainingSeconds > 0;

  if (!expanded && !finished) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        activeOpacity={0.8}
        style={{
          position: "absolute", top: 50, right: 12, zIndex: 9999, elevation: 20,
          backgroundColor: isLow ? "#B91C1C" : C.primary,
          borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
          flexDirection: "row", alignItems: "center", gap: 6,
        }}
      >
        <Text style={{ fontSize: 12 }}>{timer.paused ? "⏸" : "⏱"}</Text>
        <Text style={{ fontFamily: F.bodyMedium, color: C.white, fontSize: 13, fontVariant: ["tabular-nums"] }}>
          {formatTime(timer.remainingSeconds)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={{
      position: "absolute", top: 50, right: 12, left: 12,
      zIndex: 9999, elevation: 20,
      transform: [{ scale: finished ? pulseAnim : 1 }],
    }}>
      <View style={{
        backgroundColor: finished ? "#FEF2F2" : C.card,
        borderRadius: 20, borderWidth: 1.5,
        borderColor: finished ? "#FCA5A5" : isLow ? C.accent : C.border,
        padding: 16,
      }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text style={{ fontSize: 18 }}>{finished ? "🔔" : "⏱"}</Text>
            <Text style={{ fontFamily: F.bodyMedium, fontSize: 13, color: C.ink, flex: 1 }} numberOfLines={1}>
              {finished ? "Timer Done!" : timer.label}
            </Text>
          </View>
          {!finished && (
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accentLight, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }}
            >
              <Text style={{ fontFamily: F.bodyMedium, fontSize: 11, color: C.inkMuted }}>−</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Time */}
        <Text style={{
          fontFamily: F.headingBold, fontSize: finished ? 28 : 36,
          textAlign: "center",
          color: finished ? "#DC2626" : isLow ? "#B45309" : C.primary,
          fontVariant: ["tabular-nums"], marginBottom: 8,
        }}>
          {finished ? "0:00 — Done!" : formatTime(timer.remainingSeconds)}
        </Text>

        {/* Progress bar */}
        {!finished && (
          <View style={{ width: "100%", height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
            <View style={{ width: `${pct}%`, height: 6, backgroundColor: isLow ? C.accent : C.primary, borderRadius: 3 }} />
          </View>
        )}

        {/* Controls */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {finished ? (
            <TouchableOpacity
              onPress={() => { stopTimer(); setFinished(false); }}
              style={{ flex: 1, paddingVertical: 10, backgroundColor: C.primary, borderRadius: R.button, alignItems: "center" }}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: F.bodyMedium, color: C.white, fontSize: 13 }}>Dismiss</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => timer.paused ? resumeTimer() : pauseTimer()}
                style={{ flex: 1, paddingVertical: 10, backgroundColor: timer.paused ? C.primary : C.accent, borderRadius: R.button, alignItems: "center" }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: F.bodyMedium, color: timer.paused ? C.white : C.ink, fontSize: 13 }}>
                  {timer.paused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={stopTimer}
                style={{ flex: 1, paddingVertical: 10, backgroundColor: "#FEF2F2", borderRadius: R.button, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: F.bodyMedium, color: "#DC2626", fontSize: 13 }}>Stop</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
