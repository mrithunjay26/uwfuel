"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, ChevronRight, Clock, MapPin, Sparkles, X } from "lucide-react";
import { useConfig } from "@/lib/config/ConfigContext";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useClassSchedule } from "@/lib/hooks/useClassSchedule";
import { useActivePlan } from "@/lib/hooks/useActivePlan";
import { callCohere } from "@/lib/ai/cohere";
import { setActivePlan, clearActivePlan, savePlanToRepo } from "@/lib/db/userDb";
import { maintenanceCalories, dailyTargetCalories, weeklyChangeLbsFromPhase } from "@/lib/utils/nutrition";
import {
  scheduleMealReminders,
  cancelMealReminders,
  requestNotificationPermission,
  notificationsGranted,
} from "@/lib/utils/notifications";
import { todayPacificKey } from "@/lib/firebase/dining";
import type { ActivePlan, MealPlan, PlanMeal, MealType } from "@/lib/db/types";
import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

const MEAL_COUNT_OPTIONS = [2, 3, 4, 5] as const;
type MealCount = (typeof MEAL_COUNT_OPTIONS)[number];

interface MealPlannerSheetProps {
  open: boolean;
  onClose: () => void;
  menuItems: FlatMenuItem[];
}

function mealTimeForIndex(index: number, totalMeals: number): string {
  const startHour = totalMeals <= 3 ? 7 : 7;
  const endHour = 20;
  const span = endHour - startHour;
  const hour = Math.round(startHour + (span / (totalMeals - 1 || 1)) * index);
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:00 ${ampm}`;
}

export function MealPlannerSheet({ open, onClose, menuItems }: MealPlannerSheetProps) {
  const { cohereKey, hasCohere } = useConfig();
  const handle = useUserDb();
  const { profile } = useUserProfile();
  const { schedule: classSchedule, todayStops } = useClassSchedule();
  const { activePlan } = useActivePlan();

  const [mealCount, setMealCount] = useState<MealCount>(3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remindersOn, setRemindersOn] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setNotifGranted(notificationsGranted());
  }, [open]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const buildPrompt = useCallback(() => {
    const weight = profile?.current_weight ?? 160;
    const phase = profile?.phase ?? "maintain";
    const weeklyChange = weeklyChangeLbsFromPhase(phase);
    const targetKcal = dailyTargetCalories(weight, weeklyChange);
    const todayKey = todayPacificKey();

    const sample = menuItems.slice(0, 60).map((i) =>
      `- ${i.name} @ ${i.location_name} (~${i.calories} cal, ${i.protein_grams}g protein, $${i.price.toFixed(2)})`
    ).join("\n");

    const classCtx = todayStops.length > 0
      ? `Today's class stops: ${todayStops.map((s) => `${s.building_label} (${s.start_time}–${s.end_time})`).join("; ")}.`
      : "No classes today.";

    return [
      {
        role: "system" as const,
        content: `You are a campus nutrition assistant for UW Seattle students. Generate a realistic, practical daily meal plan from UW HFS dining options.
Always respond with ONLY a valid JSON object (no markdown, no extra text) in this exact shape:
{
  "title": "string",
  "summary": "string (1-2 sentences)",
  "meals": [
    {
      "meal_type": "Breakfast"|"Lunch"|"Dinner"|"Snack",
      "item_name": "string",
      "location_name": "string",
      "estimated_calories": number,
      "estimated_protein": number,
      "estimated_cost": number,
      "suggested_time": "string e.g. 8:00 AM",
      "reasoning": "string (short)"
    }
  ],
  "daily_totals": { "calories": number, "protein": number, "cost": number }
}`,
      },
      {
        role: "user" as const,
        content: `Plan ${mealCount} meals for today.
Goal: ${phase} (target ${targetKcal} kcal/day, ${weight} lbs).
${classCtx}
Today's available items:\n${sample || "No menu data — make reasonable suggestions."}
Keep daily cost under $25. Prioritize high-protein for ${phase === "cut" ? "a cut" : phase === "bulk" ? "a bulk" : "maintenance"}.`,
      },
    ];
  }, [mealCount, menuItems, profile, todayStops]);

  async function handleGenerate() {
    if (!handle || !cohereKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setGenerating(true);
    setError(null);

    try {
      const raw = await callCohere(cohereKey, buildPrompt(), { temperature: 0.6, signal: ctrl.signal });

      let parsed: {
        title: string;
        summary: string;
        meals: Array<{
          meal_type: string;
          item_name: string;
          location_name: string;
          estimated_calories: number;
          estimated_protein: number;
          estimated_cost: number;
          suggested_time: string;
          reasoning: string;
        }>;
        daily_totals: { calories: number; protein: number; cost: number };
      };

      try {
        const jsonStart = raw.indexOf("{");
        const jsonEnd = raw.lastIndexOf("}");
        parsed = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : raw);
      } catch {
        throw new Error("AI returned invalid JSON. Try again.");
      }

      const meals: PlanMeal[] = (parsed.meals || []).map((m) => ({
        meal_type: (["Breakfast", "Lunch", "Dinner", "Snack"].includes(m.meal_type)
          ? m.meal_type
          : "Snack") as MealType,
        item_name: m.item_name || "Meal",
        location_id: "",
        location_name: m.location_name || "UW Dining",
        estimated_calories: m.estimated_calories || 0,
        estimated_protein: m.estimated_protein || 0,
        estimated_cost: m.estimated_cost || 0,
        suggested_time: m.suggested_time || mealTimeForIndex(0, mealCount),
        reasoning: m.reasoning || "",
      }));

      const plan: MealPlan = {
        source: "ai",
        title: parsed.title || `${mealCount}-Meal Plan`,
        summary: parsed.summary || "",
        meals,
        daily_totals: parsed.daily_totals || { calories: 0, protein: 0, cost: 0 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const todayKey = todayPacificKey();
      const planId = await savePlanToRepo(handle.db, handle.uid, todayKey, plan);

      const active: Omit<ActivePlan, "set_at"> = {
        plan_id: planId,
        source: "ai",
        title: plan.title,
        date: todayKey,
        daily_totals: plan.daily_totals,
        meals,
      };
      await setActivePlan(handle.db, handle.uid, active);

      if (remindersOn && notifGranted) {
        await scheduleMealReminders(
          meals.map((m) => ({
            mealType: m.meal_type,
            time: convertTo24Hour(m.suggested_time),
            locationName: m.location_name,
            itemName: m.item_name,
          })),
        );
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Generation failed. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleReminders() {
    if (!notifGranted) {
      const granted = await requestNotificationPermission();
      setNotifGranted(granted);
      if (!granted) return;
    }
    const next = !remindersOn;
    setRemindersOn(next);
    if (!next) cancelMealReminders();
  }

  async function handleClearPlan() {
    if (!handle) return;
    await clearActivePlan(handle.db, handle.uid);
    cancelMealReminders();
  }

  if (!open) return null;

  const hasPlan = !!activePlan;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Meal Planner"
        className="animate-rise fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-[28px] bg-surface px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5 shadow-[var(--shadow-lg)]"
        style={{ maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            <h2 className="font-display text-[20px] font-extrabold text-ink">AI Meal Planner</h2>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-surface-3 text-ink-soft">
            <X className="size-4" />
          </button>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto">
          {hasPlan && activePlan && (
            <div className="mt-4 rounded-[18px] bg-mint-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-carbs">Active Plan</p>
                  <p className="mt-0.5 font-display text-[16px] font-extrabold text-ink">{activePlan.title}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    {activePlan.daily_totals.calories} kcal · {activePlan.daily_totals.protein}g protein · ${activePlan.daily_totals.cost.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handleClearPlan}
                  className="shrink-0 text-[11px] font-semibold text-danger"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {activePlan.meals.map((meal, i) => (
                  <PlanMealRow key={i} meal={meal} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="text-[13px] font-bold text-ink">Meals per day</p>
            <div className="mt-2 flex gap-2">
              {MEAL_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setMealCount(n)}
                  className={`flex-1 rounded-[12px] py-2.5 text-[14px] font-bold transition ${
                    mealCount === n
                      ? "bg-accent text-accent-contrast"
                      : "bg-surface-2 text-ink-soft"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {todayStops.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-lav-soft p-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <p className="text-[12px] font-bold text-ink">Class schedule included</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">
                  {todayStops.map((s) => `${s.building_label} ${s.start_time}`).join(" · ")}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-[14px] bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {remindersOn && notifGranted ? (
                <Bell className="size-4 text-accent" />
              ) : (
                <BellOff className="size-4 text-ink-faint" />
              )}
              <div>
                <p className="text-[13px] font-bold text-ink">Meal reminders</p>
                <p className="text-[11px] text-ink-soft">
                  {notifGranted
                    ? "Notified 30 min before each meal"
                    : "Allow notifications to enable"}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleReminders}
              className={`relative h-6 w-11 rounded-full transition ${
                remindersOn && notifGranted ? "bg-accent" : "bg-line-strong"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  remindersOn && notifGranted ? "left-5.5" : "left-0.5"
                }`}
                style={{ left: remindersOn && notifGranted ? "1.375rem" : "0.125rem" }}
              />
            </button>
          </div>

          {profile && (
            <div className="mt-4 rounded-[14px] bg-surface-2 px-4 py-3">
              <p className="text-[12px] font-bold text-ink-soft">Using your profile</p>
              <p className="mt-0.5 text-[13px] text-ink">
                {profile.current_weight} lbs · {profile.phase} ·{" "}
                {dailyTargetCalories(profile.current_weight, weeklyChangeLbsFromPhase(profile.phase))} kcal target
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[14px] bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger">
              {error}
            </div>
          )}

          {!hasCohere && (
            <div className="mt-4 rounded-[14px] bg-peach-soft px-4 py-3 text-[13px] text-ink-soft">
              Add a Cohere AI key in Profile → AI key to enable meal plan generation.
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={generating || !hasCohere || !handle}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3.5 text-[15px] font-bold text-accent-contrast disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {hasPlan ? "Regenerate plan" : `Generate ${mealCount}-meal plan`}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function PlanMealRow({ meal }: { meal: PlanMeal }) {
  const MEAL_COLORS: Record<string, string> = {
    Breakfast: "text-peach",
    Lunch: "text-carbs",
    Dinner: "text-accent",
    Snack: "text-protein",
  };

  return (
    <div className="flex items-start gap-2.5 rounded-[12px] bg-surface/70 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${MEAL_COLORS[meal.meal_type] ?? "text-ink-soft"}`}>
            {meal.meal_type}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-ink-faint">
            <Clock className="size-2.5" /> {meal.suggested_time}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] font-bold text-ink">{meal.item_name}</p>
        <p className="text-[11px] text-ink-soft">{meal.location_name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[12px] font-bold text-ink">{meal.estimated_calories} cal</p>
        <p className="text-[10px] text-ink-soft">${meal.estimated_cost.toFixed(2)}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-faint" />
    </div>
  );
}

function convertTo24Hour(timeStr: string): string {
  try {
    const [time, ampm] = timeStr.split(" ");
    const [h, m] = time.split(":").map(Number);
    const hour24 = ampm === "PM" && h !== 12 ? h + 12 : ampm === "AM" && h === 12 ? 0 : h;
    return `${String(hour24).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  } catch {
    return "12:00";
  }
}
