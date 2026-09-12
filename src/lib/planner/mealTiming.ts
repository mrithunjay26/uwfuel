import type { MealType } from "@/lib/db/types";

export interface MealWindowPref {
  from: number;
  to: number;
}

export type MealTiming = Record<MealType, MealWindowPref>;

export const MEAL_TIMING_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export const DEFAULT_MEAL_TIMING: MealTiming = {
  Breakfast: { from: 7 * 60, to: 10 * 60 },
  Lunch: { from: 11 * 60 + 15, to: 14 * 60 + 30 },
  Dinner: { from: 17 * 60, to: 20 * 60 + 30 },
  Snack: { from: 14 * 60 + 45, to: 16 * 60 + 45 },
};

export function clampMinute(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1439, Math.round(n)));
}

function validWindow(w: unknown): MealWindowPref | null {
  if (!w || typeof w !== "object") return null;
  const from = clampMinute(Number((w as MealWindowPref).from));
  const to = clampMinute(Number((w as MealWindowPref).to));
  if (to <= from) return null;
  return { from, to };
}

export function parseMealTiming(raw: unknown): MealTiming {
  const out: MealTiming = {
    Breakfast: { ...DEFAULT_MEAL_TIMING.Breakfast },
    Lunch: { ...DEFAULT_MEAL_TIMING.Lunch },
    Dinner: { ...DEFAULT_MEAL_TIMING.Dinner },
    Snack: { ...DEFAULT_MEAL_TIMING.Snack },
  };
  if (raw && typeof raw === "object") {
    for (const type of MEAL_TIMING_TYPES) {
      const w = validWindow((raw as Record<string, unknown>)[type]);
      if (w) out[type] = w;
    }
  }
  return out;
}

export function minutesToClock(min: number): string {
  const m = clampMinute(min);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function clockToMinutes(clock: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec((clock || "").trim());
  if (!match) return 0;
  return clampMinute(Number(match[1]) * 60 + Number(match[2]));
}

export function meridianLabel(min: number): string {
  const m = clampMinute(min);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mm).padStart(2, "0")} ${period}`;
}
