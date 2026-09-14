import type { PlanMeal, ClassStop } from "@/lib/db/types";

function toMinute(t: string | undefined): number {
  const m = (t || "").match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || "0", 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export interface PlanConflict {
  meal: string;
  time: string;
  clashesWith: string;
}

export function planConflicts(meals: PlanMeal[], stops: ClassStop[]): PlanConflict[] {
  const blocks = stops
    .map((s) => ({ start: toMinute(s.start_time), end: toMinute(s.end_time), label: s.building_label || s.title || "a class" }))
    .filter((b) => b.start >= 0 && b.end > b.start);

  const out: PlanConflict[] = [];
  for (const meal of meals) {
    const t = toMinute(meal.suggested_time);
    if (t < 0) continue;
    const hit = blocks.find((b) => t >= b.start && t < b.end);
    if (hit) out.push({ meal: meal.item_name, time: meal.suggested_time, clashesWith: hit.label });
  }
  return out;
}

export function planFitsDay(meals: PlanMeal[], stops: ClassStop[]): boolean {
  return planConflicts(meals, stops).length === 0;
}
