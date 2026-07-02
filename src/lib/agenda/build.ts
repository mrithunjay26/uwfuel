import type { BudgetSnapshot } from "@/lib/budget/compute";
import type { ClassStop, ReadinessCheck, WorkoutPlanDay } from "@/lib/db/types";
import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

export interface AgendaItem {
  id: string;
  kind: "class" | "meal" | "budget" | "workout" | "recovery";
  priority: number;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
}

function minutes(raw: string) { const [h, m] = raw.split(":").map(Number); return h * 60 + m; }

export function buildDailyAgenda(input: {
  nowMinutes: number;
  classes: ClassStop[];
  menu: FlatMenuItem[];
  budget: BudgetSnapshot;
  workout: WorkoutPlanDay | null;
  readiness: ReadinessCheck | null;
}): AgendaItem[] {
  const items: AgendaItem[] = [];
  const nextClass = input.classes.filter((item) => minutes(item.start_time) >= input.nowMinutes).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  if (nextClass) items.push({ id: "next-class", kind: "class", priority: 100, eyebrow: "Next commitment", title: nextClass.title || nextClass.building_label, detail: `${nextClass.start_time} · ${nextClass.building_label}`, href: "/plan", action: "View day" });
  const meal = input.menu.filter((item) => item.available_now && item.price > 0 && item.price <= Math.max(input.budget.combinedTodayGuide, 8)).sort((a, b) => (b.protein_grams / Math.max(1, b.price)) - (a.protein_grams / Math.max(1, a.price)))[0];
  if (meal) items.push({ id: "meal-now", kind: "meal", priority: nextClass ? 85 : 105, eyebrow: "Best fit right now", title: meal.name, detail: `${meal.location_name} · ${Math.round(meal.protein_grams)}g protein · $${meal.price.toFixed(2)}`, href: `/menu?location=${encodeURIComponent(meal.location_id)}`, action: "See meal" });
  items.push({ id: "budget", kind: "budget", priority: 75, eyebrow: "Safe to spend today", title: `$${input.budget.combinedTodayGuide.toFixed(2)} across both wallets`, detail: `$${input.budget.campusDailyGuide.toFixed(0)} Dining Plan guide + $${input.budget.personalDailyAllowance.toFixed(2)} personal`, href: "/dashboard#budgets", action: "View wallets" });
  if (input.workout && !input.workout.is_rest) items.push({ id: "workout", kind: "workout", priority: 70, eyebrow: "Scheduled training", title: input.workout.label, detail: `${input.workout.exercises.length} exercises ready in your logger`, href: "/log", action: "Start workout" });
  if (input.readiness && (input.readiness.energy <= 2 || input.readiness.sleep <= 2 || input.readiness.soreness >= 4)) items.push({ id: "recovery", kind: "recovery", priority: 95, eyebrow: "Recovery check", title: "Lower the pressure today", detail: "Your check-in suggests recovery or reduced volume.", href: "/log", action: "Adjust workout" });
  return items.sort((a, b) => b.priority - a.priority);
}
