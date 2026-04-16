import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Vibration } from "react-native";
import { useTimer } from "../contexts/TimerContext";

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

  // Detect timer completion
  useEffect(() => {
    if (timer.remainingSeconds === 0 && timer.totalSeconds > 0 && !timer.active) {
      setFinished(true);
      setExpanded(true);
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      // Pulse animation
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

  // Collapsed mini view (top-right bubble)
  if (!expanded && !finished) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          top: 50,
          right: 12,
          zIndex: 9999,
          elevation: 20,
          backgroundColor: isLow ? "#ef4444" : "#16a34a",
          borderRadius: 24,
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <Text style={{ fontSize: 12 }}>{timer.paused ? "⏸" : "⏱"}</Text>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {formatTime(timer.remainingSeconds)}
        </Text>
      </TouchableOpacity>
    );
  }

  // Expanded view
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 50,
        right: 12,
        left: 12,
        zIndex: 9999,
        elevation: 20,
        transform: [{ scale: finished ? pulseAnim : 1 }],
      }}
    >
      <View style={{
        backgroundColor: finished ? "#fef2f2" : "#fff",
        borderRadius: 20,
        borderWidth: 2,
        borderColor: finished ? "#ef4444" : isLow ? "#fbbf24" : "#22c55e",
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 20,
      }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text style={{ fontSize: 18 }}>{finished ? "🔔" : "⏱"}</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", flex: 1 }} numberOfLines={1}>
              {finished ? "Timer Done!" : timer.label}
            </Text>
          </View>
          {!finished && (
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 11, color: "#6b7280", fontWeight: "700" }}>-</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Time display */}
        <Text style={{
          fontSize: finished ? 28 : 36,
          fontWeight: "800",
          textAlign: "center",
          color: finished ? "#ef4444" : isLow ? "#f59e0b" : "#16a34a",
          fontVariant: ["tabular-nums"],
          marginBottom: 8,
        }}>
          {finished ? "0:00 - Done!" : formatTime(timer.remainingSeconds)}
        </Text>

        {/* Progress bar */}
        {!finished && (
          <View style={{
            width: "100%", height: 6, backgroundColor: "#f3f4f6",
            borderRadius: 3, marginBottom: 12, overflow: "hidden",
          }}>
            <View style={{
              width: `${pct}%`, height: 6,
              backgroundColor: isLow ? "#f59e0b" : "#22c55e", borderRadius: 3,
            }} />
          </View>
        )}

        {/* Controls */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {finished ? (
            <TouchableOpacity
              onPress={() => { stopTimer(); setFinished(false); }}
              style={{
                flex: 1, paddingVertical: 10, backgroundColor: "#16a34a",
                borderRadius: 12, alignItems: "center",
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Dismiss</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => timer.paused ? resumeTimer() : pauseTimer()}
                style={{
                  flex: 1, paddingVertical: 10,
                  backgroundColor: timer.paused ? "#16a34a" : "#f59e0b",
                  borderRadius: 12, alignItems: "center",
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                  {timer.paused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={stopTimer}
                style={{
                  flex: 1, paddingVertical: 10,
                  backgroundColor: "#fee2e2", borderRadius: 12, alignItems: "center",
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>Stop</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
