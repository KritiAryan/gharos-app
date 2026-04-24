// ─── Agent E — Deterministic prep planner ────────────────────────────────────
//
// Replaces the old LLM-invented prep plan.
//
// Pipeline:
//   1. For each meal in weeklyPlan, find its Card from selectedMeals
//   2. Cards with recipe_id → fetch prep_components from Supabase (batch)
//   3. Classify each component:
//        - soak + time >= 4h   → weekdayEveningPrep (night before that meal)
//        - time >= 20 min       → weekendPrep (Saturday = heavy, Sunday = light)
//        - time < 20 min        → morning-of (noted in preppedItems, no weekend task)
//   4. Deduplicate weekend tasks by component id (shared bases used across recipes)
//   5. Build dailyCookCards with adjusted cook time + preppedItems chips
//
// Returns null if no catalog meals exist — caller falls back to LLM Agent E.
//
// Output shape matches the existing LLM Agent E so meal-prep.tsx is unchanged.

import { supabase } from "../lib/supabase";
import type { Card } from "./agentA";

// ═══════════════════════════════════════════════════════════════════════════
// Types — output shapes must match what meal-prep.tsx consumes
// ═══════════════════════════════════════════════════════════════════════════

interface PrepComponent {
  id:                        string;
  task:                      string;
  category:                  string; // soak | boil | cook_base | chop | grind | marinate | dough | portion
  time_minutes:              number | null;
  storage_options?:          Array<{ location: "refrigerator" | "freezer"; shelf_life_days: number }>;
  default_location?:         string;
  portion_note?:             string;
  produced_from_ingredients?: string[];
}

interface RecipeRow {
  id:                   string;
  display_name:         string;
  prep_components:      PrepComponent[] | null;
  total_time_minutes:   number | null;
  steps:                unknown;
}

export interface WeeklyPlanSlot {
  mealType:      string;
  mealId:        string;
  mealName:      string;
  leftoverNote?: string | null;
}

export interface WeeklyPlanDay {
  day:            number; // 1 = Monday … 7 = Sunday
  slots:          WeeklyPlanSlot[];
  totalCalories?: number;
  calorieWarning?: boolean;
}

// ── PrepPlan output shapes ──────────────────────────────────────────────────

interface PrepTask {
  id:               string;
  description:      string;
  estimatedMinutes: number;
  forMeals:         string[];
  storageNote:      string;
}

interface TaskGroup {
  category: string;
  label:    string;
  tasks:    PrepTask[];
}

interface PrepSession {
  day:           "saturday" | "sunday";
  estimatedTime: number;
  taskGroups:    TaskGroup[];
}

interface EveningPrepItem {
  day:              string; // "monday" | "tuesday" | …
  description:      string;
  estimatedMinutes: number;
}

interface DailyCookSlot {
  mealType:             string;
  mealName:             string;
  mealId:               string;
  estimatedCookMinutes: number;
  quickSteps:           string[];
  preppedItems:         string[];
}

interface DailyCookCard {
  day:      number;
  dayLabel: string;
  slots:    DailyCookSlot[];
}

export interface PrepPlan {
  weekendPrep:         PrepSession[];
  weekdayEveningPrep?: EveningPrepItem[];
  dailyCookCards:      DailyCookCard[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const DAY_NAMES       = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_LOWER = ["", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Soak tasks longer than this go to "evening before" (not weekend)
const OVERNIGHT_SOAK_MIN = 240; // 4 hours

// Tasks shorter than this stay as morning-of (not worth weekend scheduling)
const WEEKEND_MIN_MIN = 20;

// Heavy tasks (cook_base, boil, marinate) → Saturday
// Light tasks (chop, grind, dough, portion) → Sunday
const WEEKEND_DAY: Record<string, "saturday" | "sunday"> = {
  cook_base: "saturday",
  boil:      "saturday",
  marinate:  "saturday",
  soak:      "saturday",   // short soaks that aren't overnight
  chop:      "sunday",
  grind:     "sunday",
  dough:     "sunday",
  portion:   "sunday",
};

const CATEGORY_LABELS: Record<string, string> = {
  cook_base: "Cooking Bases & Gravies",
  boil:      "Boiling & Pressure Cooking",
  soak:      "Soaking",
  marinate:  "Marination",
  chop:      "Chopping & Prep",
  grind:     "Grinding & Blending",
  dough:     "Dough Preparation",
  portion:   "Portioning",
};

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

export async function generatePrepPlanFromCatalog({
  selectedMeals,
  weeklyPlan,
}: {
  selectedMeals: Card[];
  weeklyPlan:    WeeklyPlanDay[];
}): Promise<PrepPlan | null> {

  // 1. Collect catalog cards (those with recipe_id from Agent A)
  const catalogMeals = selectedMeals.filter(m => m.recipe_id);
  if (catalogMeals.length === 0) {
    console.info("[agentE] no catalog meals in plan — falling back to LLM");
    return null;
  }

  const recipeIds = [...new Set(catalogMeals.map(m => m.recipe_id!))];

  // 2. Batch fetch prep_components from Supabase
  const { data: recipesRaw, error } = await supabase
    .from("recipes")
    .select("id, display_name, prep_components, total_time_minutes, steps")
    .in("id", recipeIds);

  if (error) {
    console.warn("[agentE] Supabase fetch failed:", error.message);
    return null;
  }

  const recipesMap = new Map((recipesRaw ?? []).map(r => [r.id, r as RecipeRow]));
  const mealById   = new Map(selectedMeals.map(m => [m.id, m]));

  // ── Accumulators ──────────────────────────────────────────────────────────

  // weekendTasksMap: component_id → { component, category, forMeals, weekendDay }
  const weekendTasksMap = new Map<string, {
    component:  PrepComponent;
    category:   string;
    forMeals:   string[];
    weekendDay: "saturday" | "sunday";
  }>();

  const eveningPrepItems: EveningPrepItem[] = [];
  const cookInfoByDay    = new Map<number, DailyCookSlot[]>();

  // 3. Walk the weekly plan
  for (const planDay of weeklyPlan) {
    const dayNum    = planDay.day;
    const dayLabel  = DAY_NAMES[dayNum] ?? `Day ${dayNum}`;
    const cookSlots: DailyCookSlot[] = [];

    for (const slot of planDay.slots) {
      const meal   = mealById.get(slot.mealId);
      const recipe = meal?.recipe_id ? recipesMap.get(meal.recipe_id) : undefined;

      if (!recipe) {
        // No catalog data for this meal — plain card with no prep breakdown
        cookSlots.push({
          mealType:             slot.mealType,
          mealName:             slot.mealName,
          mealId:               slot.mealId,
          estimatedCookMinutes: meal?.cookTime ?? 30,
          quickSteps:           [],
          preppedItems:         [],
        });
        continue;
      }

      const components: PrepComponent[] = (recipe.prep_components ?? []) as PrepComponent[];
      const totalTime  = recipe.total_time_minutes ?? meal!.cookTime ?? 30;
      const quickSteps = extractQuickSteps(recipe.steps);

      const thisMealPrepped: string[] = [];
      let   savedMinutes = 0;

      for (const comp of components) {
        const timeMin     = comp.time_minutes ?? 0;
        const isLongSoak  = comp.category === "soak" && timeMin >= OVERNIGHT_SOAK_MIN;
        const isWeekendWorth = !isLongSoak && timeMin >= WEEKEND_MIN_MIN;

        if (isLongSoak) {
          // Put soak reminder on the evening before this meal day
          const prevDayIdx = dayNum > 1 ? dayNum - 1 : 7; // day 1 (Mon) → prev = 7 (Sun)
          const prevDayName = DAY_NAMES_LOWER[prevDayIdx] ?? "previous evening";
          const note = comp.portion_note ? ` — ${comp.portion_note}` : "";
          eveningPrepItems.push({
            day:              prevDayName,
            description:      `${comp.task} for ${slot.mealName}${note}`,
            estimatedMinutes: 5, // passive soak; active effort is ~5 min setup
          });
          thisMealPrepped.push(`${comp.task} (soaked night before)`);
          savedMinutes += Math.min(timeMin, 30); // don't over-credit passive time

        } else if (isWeekendWorth) {
          // Weekend prep — deduplicate by component id across recipes
          const weekendDay = WEEKEND_DAY[comp.category] ?? "saturday";
          const existing   = weekendTasksMap.get(comp.id);
          if (existing) {
            if (!existing.forMeals.includes(slot.mealName)) {
              existing.forMeals.push(slot.mealName);
            }
          } else {
            weekendTasksMap.set(comp.id, {
              component: comp,
              category:  comp.category,
              forMeals:  [slot.mealName],
              weekendDay,
            });
          }
          savedMinutes += timeMin;
          thisMealPrepped.push(`${comp.task} (prepped on weekend)`);

        }
        // Short tasks (< WEEKEND_MIN_MIN) — just cook real-time, no mention
      }

      const adjustedTime = Math.max(10, totalTime - savedMinutes);

      cookSlots.push({
        mealType:             slot.mealType,
        mealName:             slot.mealName,
        mealId:               slot.mealId,
        estimatedCookMinutes: Math.round(adjustedTime),
        quickSteps,
        preppedItems:         thisMealPrepped,
      });
    }

    cookInfoByDay.set(dayNum, cookSlots);
  }

  // 4. Build weekendPrep sessions from accumulated tasks
  const satGroups = new Map<string, PrepTask[]>(); // category → tasks
  const sunGroups = new Map<string, PrepTask[]>();

  for (const [, entry] of weekendTasksMap) {
    const task: PrepTask = {
      id:               entry.component.id,
      description:      buildTaskDescription(entry.component),
      estimatedMinutes: entry.component.time_minutes ?? 15,
      forMeals:         entry.forMeals,
      storageNote:      buildStorageNote(entry.component),
    };
    const map = entry.weekendDay === "saturday" ? satGroups : sunGroups;
    if (!map.has(entry.category)) map.set(entry.category, []);
    map.get(entry.category)!.push(task);
  }

  const weekendPrep: PrepSession[] = [];
  if (satGroups.size > 0) weekendPrep.push(buildPrepSession("saturday", satGroups));
  if (sunGroups.size > 0) weekendPrep.push(buildPrepSession("sunday",   sunGroups));

  // 5. Build dailyCookCards, sorted by day
  const dailyCookCards: DailyCookCard[] = Array.from(cookInfoByDay.entries())
    .sort((a, b) => a[0] - b[0])
    .filter(([, slots]) => slots.length > 0)
    .map(([day, slots]) => ({
      day,
      dayLabel: DAY_NAMES[day] ?? `Day ${day}`,
      slots,
    }));

  // 6. Deduplicate evening prep (same description on same day)
  const seen = new Set<string>();
  const weekdayEveningPrep = eveningPrepItems.filter(item => {
    const key = `${item.day}|${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // If no deterministic output, fall back to LLM
  if (weekendPrep.length === 0 && weekdayEveningPrep.length === 0) {
    console.info("[agentE] catalog has no weekendPrep/eveningPrep — falling back to LLM");
    return null;
  }

  console.info(
    `[agentE] catalog plan: ${weekendPrep.length} weekend session(s), ` +
    `${weekdayEveningPrep.length} evening prep(s), ` +
    `${dailyCookCards.length} daily cook card(s)`
  );

  return {
    weekendPrep,
    ...(weekdayEveningPrep.length > 0 ? { weekdayEveningPrep } : {}),
    dailyCookCards,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function buildPrepSession(
  day: "saturday" | "sunday",
  groups: Map<string, PrepTask[]>,
): PrepSession {
  const taskGroups: TaskGroup[] = Array.from(groups.entries()).map(([cat, tasks]) => ({
    category: cat,
    label:    CATEGORY_LABELS[cat] ?? cat,
    tasks,
  }));
  const estimatedTime = taskGroups
    .flatMap(g => g.tasks)
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);
  return { day, estimatedTime, taskGroups };
}

function buildTaskDescription(comp: PrepComponent): string {
  if (comp.portion_note && comp.portion_note.length < 120) {
    return `${comp.task}. ${comp.portion_note}`;
  }
  return comp.task;
}

function buildStorageNote(comp: PrepComponent): string {
  const opts = comp.storage_options ?? [];
  if (opts.length === 0) {
    return comp.default_location
      ? `Store in ${comp.default_location} in airtight container`
      : "Store in airtight container";
  }
  // Pick fridge option if available, else freezer
  const fridge = opts.find(o => o.location === "refrigerator");
  const chosen = fridge ?? opts[0];
  const loc    = chosen.location === "refrigerator" ? "Fridge" : "Freezer";
  return `${loc} in airtight container, up to ${chosen.shelf_life_days} day${chosen.shelf_life_days === 1 ? "" : "s"}`;
}

function extractQuickSteps(stepsRaw: unknown): string[] {
  if (!stepsRaw || !Array.isArray(stepsRaw)) return [];
  const result: string[] = [];

  for (const s of stepsRaw as Array<unknown>) {
    if (typeof s === "string") {
      result.push(s.slice(0, 100));
    } else if (s && typeof s === "object") {
      const obj = s as { heading?: string; steps?: string[] };
      if (obj.heading) result.push(obj.heading);
      for (const step of obj.steps ?? []) {
        result.push(step.slice(0, 100));
      }
    }
    if (result.length >= 5) break; // cap at 5 quick-reference lines
  }

  return result;
}
