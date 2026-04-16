import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTimer } from "../contexts/TimerContext";
import ScreenGuide from "../components/ScreenGuide";

// ─── Types ───────────────────────────────────────────────────────────────────
type PrepTask = {
  id: string;
  description: string;
  estimatedMinutes: number;
  forMeals: string[];
  storageNote: string;
};

type PrepTaskGroup = {
  category: string;
  label: string;
  tasks: PrepTask[];
};

type PrepSession = {
  day: string;
  estimatedTime: number;
  taskGroups: PrepTaskGroup[];
};

type QuickCookSlot = {
  mealType: string;
  mealName: string;
  mealId: string;
  estimatedCookMinutes: number;
  quickSteps: string[];
  preppedItems: string[];
};

type DailyCookCard = {
  day: number;
  dayLabel: string;
  slots: QuickCookSlot[];
};

type PrepPlan = {
  weekendPrep: PrepSession[];
  dailyCookCards: DailyCookCard[];
};

// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  soak: "💧", chop: "🔪", boil: "♨️", grind: "🫙",
  cook_base: "🍳", marinate: "🥣", portion: "📦", other: "✨",
};

const DAY_LABEL: Record<string, string> = {
  saturday: "Saturday",
  sunday: "Sunday",
};

// ─── Timer helpers ──────────────────────────────────────────────────────────
/** Parse seconds from step text like "boil for 15 min", "cook for 2 hours", "soak for 30 minutes" */
function parseTimerSeconds(text: string): number | null {
  // Match patterns: "X min", "X minutes", "X hrs", "X hours", "X-Y min"
  const patterns = [
    /(\d+)\s*(?:hr|hour)s?/i,
    /(\d+)\s*(?:min|minute)s?/i,
    /(\d+)\s*(?:sec|second)s?/i,
  ];

  let totalSeconds = 0;
  let found = false;

  // Hours
  const hrMatch = text.match(/(\d+)\s*(?:hr|hour)s?/i);
  if (hrMatch) { totalSeconds += parseInt(hrMatch[1]) * 3600; found = true; }

  // Minutes
  const minMatch = text.match(/(\d+)\s*(?:min|minute)s?/i);
  if (minMatch) { totalSeconds += parseInt(minMatch[1]) * 60; found = true; }

  // Also match common cooking patterns
  if (!found) {
    // "for 15 min" style
    const forMatch = text.match(/for\s+(\d+)\s*(?:min|minute|mins|minutes)/i);
    if (forMatch) return parseInt(forMatch[1]) * 60;

    // "X whistles" → ~5 min per whistle
    const whistleMatch = text.match(/(\d+)\s*whistles?/i);
    if (whistleMatch) return parseInt(whistleMatch[1]) * 5 * 60;
  }

  return found ? totalSeconds : null;
}

function formatTimerPreview(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.floor(seconds / 60)}m`;
}

// ─── Timer Button ───────────────────────────────────────────────────────────
function TimerButton({ seconds, label }: { seconds: number; label: string }) {
  const { startTimer, timer } = useTimer();

  const handlePress = () => {
    if (timer.active) {
      Alert.alert(
        "Timer Running",
        "A timer is already running. Do you want to replace it?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", onPress: () => startTimer(label, seconds) },
        ]
      );
    } else {
      startTimer(label, seconds);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe",
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
        marginTop: 4,
      }}
    >
      <Text style={{ fontSize: 11 }}>⏱</Text>
      <Text style={{ fontSize: 10, fontWeight: "600", color: "#2563eb" }}>
        {formatTimerPreview(seconds)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Progress Header ─────────────────────────────────────────────────────────
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "500" }}>
          {done} of {total} tasks done
        </Text>
        <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "600" }}>
          {pct}%
        </Text>
      </View>
      <View style={{ width: "100%", height: 8, backgroundColor: "#f3f4f6", borderRadius: 4 }}>
        <View style={{
          width: `${pct}%`, height: 8, backgroundColor: "#22c55e",
          borderRadius: 4,
        }} />
      </View>
    </View>
  );
}

// ─── Weekend Prep Section ────────────────────────────────────────────────────
function WeekendPrepView({
  weekendPrep, checked, onToggle,
}: {
  weekendPrep: PrepSession[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const [expandedDay, setExpandedDay] = useState<string>("saturday");

  return (
    <View>
      {weekendPrep.map((session) => {
        const isExpanded = expandedDay === session.day;
        const allTasks = session.taskGroups.flatMap((g) => g.tasks);
        const doneCount = allTasks.filter((t) => checked[t.id]).length;

        return (
          <View key={session.day} style={{ marginBottom: 12 }}>
            {/* Day header */}
            <TouchableOpacity
              onPress={() => setExpandedDay(isExpanded ? "" : session.day)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                backgroundColor: isExpanded ? "#fef3c7" : "#ffffff",
                borderWidth: 1, borderColor: isExpanded ? "#fbbf24" : "#e5e7eb",
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
                elevation: isExpanded ? 2 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: isExpanded ? "#f59e0b" : "#f3f4f6",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 16 }}>
                    {session.day === "saturday" ? "🅢" : "🅤"}
                  </Text>
                </View>
                <View>
                  <Text style={{
                    fontSize: 15, fontWeight: "700",
                    color: isExpanded ? "#92400e" : "#1f2937",
                  }}>
                    {DAY_LABEL[session.day] || session.day} Prep
                  </Text>
                  <Text style={{ fontSize: 12, color: isExpanded ? "#b45309" : "#9ca3af", marginTop: 2 }}>
                    ~{session.estimatedTime} min · {doneCount}/{allTasks.length} done
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 16, color: "#9ca3af" }}>{isExpanded ? "⌃" : "⌄"}</Text>
            </TouchableOpacity>

            {/* Task groups */}
            {isExpanded && (
              <View style={{ marginTop: 8, gap: 8 }}>
                {session.taskGroups.map((group, gi) => (
                  <View key={gi} style={{
                    backgroundColor: "#fff", borderRadius: 16,
                    borderWidth: 1, borderColor: "#f3f4f6",
                    overflow: "hidden", elevation: 1,
                  }}>
                    {/* Group header */}
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 8,
                      paddingHorizontal: 16, paddingVertical: 10,
                      backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
                    }}>
                      <Text style={{ fontSize: 16 }}>
                        {CATEGORY_ICONS[group.category] || "✨"}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>
                        {group.label}
                      </Text>
                    </View>

                    {/* Tasks */}
                    {group.tasks.map((task, ti) => {
                      const isDone = !!checked[task.id];
                      const timerSecs = parseTimerSeconds(task.description);

                      return (
                        <TouchableOpacity
                          key={task.id}
                          onPress={() => onToggle(task.id)}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: "row", alignItems: "flex-start", gap: 12,
                            paddingHorizontal: 16, paddingVertical: 12,
                            borderBottomWidth: ti < group.tasks.length - 1 ? 1 : 0,
                            borderBottomColor: "#f9fafb",
                            backgroundColor: isDone ? "#f0fdf4" : "#fff",
                          }}
                        >
                          {/* Checkbox */}
                          <View style={{
                            width: 22, height: 22, borderRadius: 11,
                            borderWidth: 2, marginTop: 1,
                            borderColor: isDone ? "#22c55e" : "#d1d5db",
                            backgroundColor: isDone ? "#22c55e" : "transparent",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            {isDone && (
                              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text>
                            )}
                          </View>

                          {/* Task details */}
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontSize: 13, color: isDone ? "#9ca3af" : "#1f2937",
                              textDecorationLine: isDone ? "line-through" : "none",
                              lineHeight: 18,
                            }}>
                              {task.description}
                            </Text>

                            {/* Meta row */}
                            <View style={{
                              flexDirection: "row", flexWrap: "wrap",
                              alignItems: "center", gap: 6, marginTop: 6,
                            }}>
                              <Text style={{
                                fontSize: 10, color: "#6b7280",
                                backgroundColor: "#f3f4f6", paddingHorizontal: 6,
                                paddingVertical: 2, borderRadius: 6,
                              }}>
                                ⏱ {task.estimatedMinutes} min
                              </Text>
                              {task.forMeals?.map((meal, mi) => (
                                <Text key={mi} style={{
                                  fontSize: 10, color: "#16a34a",
                                  backgroundColor: "#f0fdf4", paddingHorizontal: 6,
                                  paddingVertical: 2, borderRadius: 6,
                                }}>
                                  {meal}
                                </Text>
                              ))}

                              {/* Timer button — only show for timed tasks */}
                              {timerSecs && timerSecs > 0 && !isDone && (
                                <TimerButton
                                  seconds={timerSecs}
                                  label={task.description.slice(0, 40)}
                                />
                              )}
                            </View>

                            {/* Storage note */}
                            {task.storageNote && (
                              <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, fontStyle: "italic" }}>
                                📦 {task.storageNote}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Quick Cook Cards Section ────────────────────────────────────────────────
function QuickCookView({
  dailyCookCards,
  checkedCook,
  onToggleCook,
}: {
  dailyCookCards: DailyCookCard[];
  checkedCook: Record<string, boolean>;
  onToggleCook: (id: string) => void;
}) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (dailyCookCards.length > 0) s.add(dailyCookCards[0].day);
    if (dailyCookCards.length > 1) s.add(dailyCookCards[1].day);
    return s;
  });

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const MEAL_EMOJIS: Record<string, string> = {
    breakfast: "🌅", lunch: "☀️", snacks: "🍵", dinner: "🌙",
  };

  return (
    <View style={{ gap: 10 }}>
      {dailyCookCards.map((card) => {
        const isExpanded = expandedDays.has(card.day);
        const totalCookTime = card.slots.reduce((s, sl) => s + (sl.estimatedCookMinutes || 0), 0);

        // Check completion of this day's cook tasks
        const allStepIds = card.slots.flatMap((slot, si) =>
          (slot.quickSteps || []).map((_: string, qi: number) => `cook_${card.day}_${si}_${qi}`)
        );
        const doneSteps = allStepIds.filter((id) => checkedCook[id]).length;
        const dayCompleted = allStepIds.length > 0 && doneSteps === allStepIds.length;

        return (
          <View key={card.day}>
            {/* Day header */}
            <TouchableOpacity
              onPress={() => toggleDay(card.day)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                backgroundColor: dayCompleted ? "#f0fdf4" : isExpanded ? "#eff6ff" : "#fff",
                borderWidth: 1, borderColor: dayCompleted ? "#86efac" : isExpanded ? "#93c5fd" : "#e5e7eb",
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
                elevation: isExpanded ? 2 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: dayCompleted ? "#22c55e" : isExpanded ? "#3b82f6" : "#f3f4f6",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {dayCompleted ? (
                    <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>✓</Text>
                  ) : (
                    <Text style={{
                      fontSize: 13, fontWeight: "700",
                      color: isExpanded ? "#fff" : "#6b7280",
                    }}>
                      {card.day}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={{
                    fontSize: 15, fontWeight: "700",
                    color: dayCompleted ? "#16a34a" : isExpanded ? "#1e40af" : "#1f2937",
                  }}>
                    {card.dayLabel} {dayCompleted ? "✓ Done" : ""}
                  </Text>
                  <Text style={{ fontSize: 12, color: isExpanded ? "#3b82f6" : "#9ca3af", marginTop: 2 }}>
                    {card.slots.length} meal{card.slots.length > 1 ? "s" : ""} · ~{totalCookTime} min total
                    {doneSteps > 0 && !dayCompleted ? ` · ${doneSteps}/${allStepIds.length} done` : ""}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 16, color: "#9ca3af" }}>{isExpanded ? "⌃" : "⌄"}</Text>
            </TouchableOpacity>

            {/* Meal slots */}
            {isExpanded && (
              <View style={{ marginTop: 8, gap: 8 }}>
                {card.slots.map((slot, si) => (
                  <View key={si} style={{
                    backgroundColor: "#fff", borderRadius: 16,
                    borderWidth: 1, borderColor: "#f3f4f6",
                    overflow: "hidden", elevation: 1,
                  }}>
                    {/* Meal header */}
                    <View style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingHorizontal: 16, paddingVertical: 10,
                      backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 16 }}>
                          {MEAL_EMOJIS[slot.mealType] || "🍽️"}
                        </Text>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>
                            {slot.mealName}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#9ca3af", textTransform: "capitalize" }}>
                            {slot.mealType}
                          </Text>
                        </View>
                      </View>
                      <View style={{
                        backgroundColor: "#dcfce7", borderRadius: 8,
                        paddingHorizontal: 8, paddingVertical: 4,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#16a34a" }}>
                          {slot.estimatedCookMinutes} min
                        </Text>
                      </View>
                    </View>

                    {/* Already prepped items */}
                    {slot.preppedItems && slot.preppedItems.length > 0 && (
                      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#16a34a", marginBottom: 4 }}>
                          ✓ ALREADY PREPPED
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                          {slot.preppedItems.map((item, pi) => (
                            <Text key={pi} style={{
                              fontSize: 11, color: "#16a34a", backgroundColor: "#f0fdf4",
                              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                            }}>
                              ✓ {item}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Quick steps — with checkboxes + timer */}
                    {slot.quickSteps && slot.quickSteps.length > 0 && (
                      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>
                          JUST DO THIS
                        </Text>
                        {slot.quickSteps.map((step, qi) => {
                          const stepId = `cook_${card.day}_${si}_${qi}`;
                          const isDone = !!checkedCook[stepId];
                          const timerSecs = parseTimerSeconds(step);

                          return (
                            <TouchableOpacity
                              key={qi}
                              onPress={() => onToggleCook(stepId)}
                              activeOpacity={0.7}
                              style={{ flexDirection: "row", marginBottom: 8, alignItems: "flex-start" }}
                            >
                              {/* Checkbox instead of number */}
                              <View style={{
                                width: 22, height: 22, borderRadius: 11,
                                borderWidth: 2,
                                borderColor: isDone ? "#22c55e" : "#bfdbfe",
                                backgroundColor: isDone ? "#22c55e" : "#eff6ff",
                                alignItems: "center", justifyContent: "center",
                                marginRight: 10, marginTop: 1, flexShrink: 0,
                              }}>
                                {isDone ? (
                                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✓</Text>
                                ) : (
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#3b82f6" }}>
                                    {qi + 1}
                                  </Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{
                                  fontSize: 13, color: isDone ? "#9ca3af" : "#4b5563",
                                  textDecorationLine: isDone ? "line-through" : "none",
                                  lineHeight: 18,
                                }}>
                                  {step}
                                </Text>
                                {/* Timer button for timed steps */}
                                {timerSecs && timerSecs > 0 && !isDone && (
                                  <TimerButton
                                    seconds={timerSecs}
                                    label={step.slice(0, 40)}
                                  />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MealPrepScreen() {
  const router = useRouter();
  const [prepPlan, setPrepPlan] = useState<PrepPlan | null>(null);
  const [selectedMeals, setSelectedMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [checkedCook, setCheckedCook] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"prep" | "cook">("prep");
  const [userId, setUserId] = useState<string | null>(null);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [pantryDepletedMeals, setPantryDepletedMeals] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPrepPlan();
  }, []);

  const loadPrepPlan = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("meal_plans")
        .select("prep_plan, selected_meals, shopping_list, prep_checked, cook_checked")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.prep_plan) {
        setPrepPlan(data.prep_plan as PrepPlan);
        setSelectedMeals(data.selected_meals || []);
        setShoppingList(data.shopping_list || []);
        // Restore checked state from DB
        if (data.prep_checked) setChecked(data.prep_checked);
        if (data.cook_checked) setCheckedCook(data.cook_checked);
      }
    } catch (e) {
      console.error("Failed to load prep plan:", e);
    }
    setLoading(false);
  };

  // Save checked state to DB (debounced)
  const saveCheckedState = useCallback(async (
    newPrepChecked: Record<string, boolean>,
    newCookChecked: Record<string, boolean>,
  ) => {
    if (!userId) return;
    try {
      await supabase
        .from("meal_plans")
        .update({ prep_checked: newPrepChecked, cook_checked: newCookChecked })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
    } catch (e) {
      console.warn("Failed to save checked state:", e);
    }
  }, [userId]);

  // ── Pantry auto-depletion (smart) ──────────────────────────────────────────
  // KEY INSIGHT: Only deplete items that were on the SHOPPING LIST (bought for
  // this plan). Items already in the pantry are staples (rice, oil, spices) —
  // using 50g of rice from a 5kg bag shouldn't remove rice from the pantry.
  //
  // Shopping list items = purchased in exact quantities → remove after cooking
  // Pantry-existing items = bulk staples → keep (user removes manually when out)
  //
  const checkAndDepletePantry = useCallback(async (
    newCookChecked: Record<string, boolean>,
  ) => {
    if (!userId || !prepPlan) return;

    const dailyCards = prepPlan.dailyCookCards || [];
    const mealsToDeplete: string[] = [];

    for (const card of dailyCards) {
      for (let si = 0; si < card.slots.length; si++) {
        const slot = card.slots[si];
        const allStepIds = (slot.quickSteps || []).map((_: string, qi: number) =>
          `cook_${card.day}_${si}_${qi}`
        );
        const allDone = allStepIds.length > 0 && allStepIds.every((id) => newCookChecked[id]);

        if (allDone && !pantryDepletedMeals.has(slot.mealId)) {
          mealsToDeplete.push(slot.mealId);
        }
      }
    }

    if (mealsToDeplete.length === 0) return;

    // Build set of shopping list item names (these were BOUGHT for this plan)
    const shoppingItemNames = new Set<string>(
      shoppingList.map((item: any) =>
        (typeof item === "string" ? item : item.name || "").toLowerCase().trim()
      ).filter(Boolean)
    );

    if (shoppingItemNames.size === 0) return; // No shopping list → nothing to deplete

    // Find ingredients used in completed meals that were on the shopping list
    const completedMeals = selectedMeals.filter((m) => mealsToDeplete.includes(m.id));
    const ingredientsToPurge = new Set<string>();
    const ingredientsKept: string[] = [];

    completedMeals.forEach((meal) => {
      (meal.ingredients || []).forEach((ing: any) => {
        const name = (typeof ing === "string" ? ing : ing.name || "").toLowerCase().trim();
        if (!name) return;

        // Check if this ingredient was on the shopping list (bought specifically)
        const wasOnShoppingList = [...shoppingItemNames].some((shopName) =>
          shopName === name ||
          shopName.includes(name) ||
          name.includes(shopName)
        );

        if (wasOnShoppingList) {
          ingredientsToPurge.add(name);
        } else {
          ingredientsKept.push(name);
        }
      });
    });

    // Track which meals we've processed (even if nothing to purge)
    setPantryDepletedMeals((prev) => {
      const next = new Set(prev);
      mealsToDeplete.forEach((id) => next.add(id));
      return next;
    });

    if (ingredientsToPurge.size === 0) {
      // All ingredients were pantry staples — nothing to remove
      return;
    }

    try {
      // Remove only the purchased items from pantry
      const { data: profile } = await supabase
        .from("profiles")
        .select("pantry")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.pantry) return;

      const currentPantry: string[] = profile.pantry;
      const updatedPantry = currentPantry.filter((item) => {
        const normalised = (typeof item === "string" ? item : "").toLowerCase().trim();
        return ![...ingredientsToPurge].some((purge) =>
          purge === normalised || purge.includes(normalised) || normalised.includes(purge)
        );
      });

      const removedCount = currentPantry.length - updatedPantry.length;

      if (removedCount > 0) {
        await supabase.from("profiles")
          .update({ pantry: updatedPantry })
          .eq("id", userId);

        // Build a helpful message
        const removedNames = [...ingredientsToPurge].slice(0, 5).join(", ");
        const keptNote = ingredientsKept.length > 0
          ? `\n\nStaples like ${[...new Set(ingredientsKept)].slice(0, 3).join(", ")} are still in your pantry.`
          : "";

        Alert.alert(
          "Pantry Updated",
          `Removed purchased items: ${removedNames}${ingredientsToPurge.size > 5 ? ` (+${ingredientsToPurge.size - 5} more)` : ""}.${keptNote}`,
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      console.warn("Pantry auto-depletion failed:", e);
    }
  }, [userId, prepPlan, selectedMeals, shoppingList, pantryDepletedMeals]);

  const toggleTask = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveCheckedState(next, checkedCook);
      return next;
    });
  };

  const toggleCookStep = (id: string) => {
    setCheckedCook((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveCheckedState(checked, next);
      // Check if this completion triggers pantry depletion
      if (next[id]) {
        setTimeout(() => checkAndDepletePantry(next), 500);
      }
      return next;
    });
  };

  // Count all prep tasks
  const allPrepTasks = (prepPlan?.weekendPrep || []).flatMap((s) =>
    s.taskGroups.flatMap((g) => g.tasks)
  );
  const donePrepCount = allPrepTasks.filter((t) => checked[t.id]).length;

  // Count all cook tasks
  const allCookStepIds = (prepPlan?.dailyCookCards || []).flatMap((card) =>
    card.slots.flatMap((slot, si) =>
      (slot.quickSteps || []).map((_: string, qi: number) => `cook_${card.day}_${si}_${qi}`)
    )
  );
  const doneCookCount = allCookStepIds.filter((id) => checkedCook[id]).length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🔪</Text>
        <ActivityIndicator color="#f59e0b" size="large" />
        <Text style={{ fontSize: 13, color: "#9ca3af", marginTop: 12 }}>Loading your prep plan...</Text>
      </SafeAreaView>
    );
  }

  if (!prepPlan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 8, textAlign: "center" }}>
          No prep plan yet
        </Text>
        <Text style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 24 }}>
          Create a new weekly plan and the prep guide will be generated automatically.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingVertical: 14, paddingHorizontal: 32, backgroundColor: "#f59e0b",
            borderRadius: 16, alignItems: "center",
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <ScreenGuide
        screenKey="mealPrep"
        emoji="👩‍🍳"
        title="Meal Prep Guide"
        points={[
          "Weekend tasks (soak, chop, boil, marinate) are grouped by category — tick as you go.",
          "Weekday quick-cook cards show the 5-min assembly using prepped ingredients.",
          "Tap the timer button on any step to start a floating countdown with vibration.",
          "Completing meals auto-updates your pantry — staples stay, purchased items get removed.",
        ]}
      />
      {/* Header */}
      <View style={{
        backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: "#f3f4f6", elevation: 2,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ color: "#6b7280", fontSize: 16 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
              🔪 Meal Prep Guide
            </Text>
            <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              Prep on weekends, cook in 15 min
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Tab toggle */}
        <View style={{
          flexDirection: "row", backgroundColor: "#f3f4f6",
          borderRadius: 12, padding: 3,
        }}>
          <TouchableOpacity
            onPress={() => setActiveTab("prep")}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
              backgroundColor: activeTab === "prep" ? "#fff" : "transparent",
              elevation: activeTab === "prep" ? 2 : 0,
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: 13, fontWeight: "600",
              color: activeTab === "prep" ? "#b45309" : "#9ca3af",
            }}>
              🔪 Weekend Prep ({donePrepCount}/{allPrepTasks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("cook")}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
              backgroundColor: activeTab === "cook" ? "#fff" : "transparent",
              elevation: activeTab === "cook" ? 2 : 0,
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: 13, fontWeight: "600",
              color: activeTab === "cook" ? "#1e40af" : "#9ca3af",
            }}>
              ⚡ Quick Cook ({doneCookCount}/{allCookStepIds.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "prep" ? (
          <>
            <ProgressBar done={donePrepCount} total={allPrepTasks.length} />

            {/* Tip */}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 14 }}>💡</Text>
              <Text style={{ fontSize: 12, color: "#92400e", flex: 1 }}>
                Do these tasks on Saturday & Sunday. Tap ⏱ on timed steps to start a timer!
              </Text>
            </View>

            <WeekendPrepView
              weekendPrep={prepPlan.weekendPrep}
              checked={checked}
              onToggle={toggleTask}
            />
          </>
        ) : (
          <>
            <ProgressBar done={doneCookCount} total={allCookStepIds.length} />

            {/* Tip */}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe",
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 14 }}>⚡</Text>
              <Text style={{ fontSize: 12, color: "#1e40af", flex: 1 }}>
                Check off steps as you cook. When a meal is fully cooked, your pantry updates automatically!
              </Text>
            </View>

            <QuickCookView
              dailyCookCards={prepPlan.dailyCookCards || []}
              checkedCook={checkedCook}
              onToggleCook={toggleCookStep}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
