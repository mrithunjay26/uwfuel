import type { GoalPhase } from "@/lib/db/types";

export function maintenanceCalories(weightLbs: number): number {
  if (!weightLbs || weightLbs <= 0) return 2400;
  return Math.round(weightLbs * 15);
}

export function weeklyChangeLbsFromPhase(phase: GoalPhase): number {
  switch (phase) {
    case "bulk":
      return 0.5;
    case "cut":
      return -0.75;
    case "maintain":
    default:
      return 0;
  }
}

const WEEKS_PER_MONTH = 4.345;

const MAX_WEEKLY_RATE = 3;

export function weeklyChangeFromGoal(
  currentWeight: number,
  goalWeight: number,
  monthsToGoal: number,
): number {
  if (!currentWeight || !goalWeight || !monthsToGoal || monthsToGoal <= 0) return 0;
  const weeks = monthsToGoal * WEEKS_PER_MONTH;
  const raw = (goalWeight - currentWeight) / weeks;
  const clamped = Math.max(-MAX_WEEKLY_RATE, Math.min(MAX_WEEKLY_RATE, raw));
  return Math.round(clamped * 100) / 100;
}

export function dailyTargetCalories(
  weightLbs: number,
  weeklyChangeLbs: number,
): number {
  return Math.round(maintenanceCalories(weightLbs) + weeklyChangeLbs * 500);
}

export function projectedWeeklyChange(
  actualCalories: number,
  targetCalories: number,
): number {
  return Math.round(((actualCalories - targetCalories) * 7) / 3500 * 100) / 100;
}

export function estimateProteinGrams(name: string, description: string, calories: number): number {
  const text = `${name} ${description}`.toLowerCase();
  let protein = calories * 0.045;
  const proteinKeywords = [
    "chicken", "beef", "steak", "salmon", "tuna", "turkey",
    "egg", "eggs", "tofu", "soy", "beans", "lentils",
    "yogurt", "greek", "protein", "shrimp", "milk", "pork",
  ];
  if (proteinKeywords.some((k) => text.includes(k))) protein += 12;
  return Math.round(protein * 10) / 10;
}

export function macroTargetsFromCalories(
  targetCalories: number,
  phase: GoalPhase,
): { protein: number; carbs: number; fat: number } {
  const proteinFraction = phase === "cut" ? 0.35 : phase === "bulk" ? 0.28 : 0.3;
  const fatFraction = 0.3;
  const carbFraction = 1 - proteinFraction - fatFraction;

  return {
    protein: Math.round((targetCalories * proteinFraction) / 4),
    carbs: Math.round((targetCalories * carbFraction) / 4),
    fat: Math.round((targetCalories * fatFraction) / 9),
  };
}

export function estimateMacros(
  calories: number,
  proteinGrams: number,
): { carbs: number; fat: number } {
  const proteinKcal = proteinGrams * 4;
  const remaining = Math.max(0, calories - proteinKcal);
  return {
    carbs: Math.round((remaining * 0.55) / 4),
    fat: Math.round((remaining * 0.45) / 9),
  };
}

export function formatMoney(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}
