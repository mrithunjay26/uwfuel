import type { ClassStop, PlanMeal, WorkoutPlanDay } from "@/lib/db/types";
import { resolveCampusPlace, campusPlaceByCode } from "@/lib/campus/buildings";
import { haversineMetres } from "@/lib/geo/distance";

export type DayEventKind =
  | "class" | "meal" | "workout" | "study"
  | "home" | "gym" | "club" | "activity";

const TAG_KIND: Record<string, DayEventKind> = {
  class: "class", home: "home", gym: "gym", club: "club",
  work: "activity", study: "study", other: "activity",
};

export interface DayPlace {
  label: string;
  lat: number;
  lng: number;
}

export interface DayEvent {
  id: string;
  kind: DayEventKind;
  title: string;
  subtitle: string;
  start: number;
  end: number;
  place: DayPlace | null;
  href: string;
  locked: boolean;
  alternatives?: (DayPlace & { walkMin: number })[];
}

export interface DayWindow {
  wake: number;
  sleep: number;
}

const DEFAULT_WINDOW: DayWindow = { wake: 7 * 60 + 30, sleep: 22 * 60 + 30 };

interface MealWindow { from: number; to: number; minutes: number }

const MEAL_WINDOWS: Record<string, MealWindow> = {
  breakfast: { from: 7 * 60,       to: 10 * 60,      minutes: 30 },
  lunch:     { from: 11 * 60 + 15, to: 14 * 60 + 30, minutes: 40 },
  dinner:    { from: 17 * 60,      to: 20 * 60 + 30, minutes: 45 },
  snack:     { from: 9 * 60,       to: 21 * 60,      minutes: 15 },
};

const ANY_MEAL_WINDOW: MealWindow = { from: 8 * 60, to: 21 * 60, minutes: 30 };

function mealWindow(type: string): MealWindow {
  return MEAL_WINDOWS[String(type || "").toLowerCase()] ?? ANY_MEAL_WINDOW;
}

const WORKOUT_MINUTES = 75;

export function toMinutes(clock: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec((clock || "").trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fmtTime(mins: number): string {
  const total = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

interface Gap { start: number; end: number }

function gapsBetween(events: DayEvent[], window: DayWindow): Gap[] {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const gaps: Gap[] = [];
  let cursor = window.wake;
  for (const e of sorted) {
    if (e.start - cursor >= 15) gaps.push({ start: cursor, end: e.start });
    cursor = Math.max(cursor, e.end);
  }
  if (window.sleep - cursor >= 15) gaps.push({ start: cursor, end: window.sleep });
  return gaps;
}

function nearest<T extends DayPlace>(origin: DayPlace | null, candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  if (!origin) return candidates[0];
  return candidates.reduce((best, c) =>
    haversineMetres(origin.lat, origin.lng, c.lat, c.lng) <
    haversineMetres(origin.lat, origin.lng, best.lat, best.lng) ? c : best,
  );
}

function campusPlace(label: string): DayPlace | null {
  const resolved = resolveCampusPlace(label);
  return resolved ? { label: label || resolved.name, lat: resolved.lat, lng: resolved.lng } : null;
}

export function placeForClass(stop: ClassStop): DayPlace | null {
  if (typeof stop.lat === "number" && typeof stop.lng === "number") {
    return { label: stop.building_label || "Class", lat: stop.lat, lng: stop.lng };
  }
  const resolved = resolveCampusPlace(stop.building_label);
  return resolved ? { label: stop.building_label || resolved.name, lat: resolved.lat, lng: resolved.lng } : null;
}

export interface BuildDayInput {
  classes: ClassStop[];
  workout: WorkoutPlanDay | null;
  plannedMeals: PlanMeal[];
  diningPlaces: DayPlace[];
  window?: DayWindow;
}

export function buildDayPlan(input: BuildDayInput): DayEvent[] {
  const window = input.window ?? DEFAULT_WINDOW;
  const events: DayEvent[] = [];

  for (const stop of input.classes) {
    const start = toMinutes(stop.start_time);
    const end = Math.max(start + 30, toMinutes(stop.end_time));
    events.push({
      id: `class-${stop.id}`,
      kind: TAG_KIND[String(stop.tag ?? "class").toLowerCase()] ?? "class",
      title: stop.title || stop.building_label || "Class",
      subtitle: stop.building_label,
      start,
      end,
      place: placeForClass(stop),
      href: "/profile",
      locked: true,
    });
  }

  const orderedMeals = input.plannedMeals
    .map((meal, order) => ({ meal, order }))
    .sort((a, b) => {
      const ta = a.meal.suggested_time ? toMinutes(a.meal.suggested_time) : mealWindow(a.meal.meal_type).from;
      const tb = b.meal.suggested_time ? toMinutes(b.meal.suggested_time) : mealWindow(b.meal.meal_type).from;
      return ta - tb || a.order - b.order;
    });

  for (const { meal: planned, order } of orderedMeals) {
    const slot = mealWindow(planned.meal_type);
    const gaps = gapsBetween(events, window);

    let start: number | null = null;
    if (planned.suggested_time) {
      const t = toMinutes(planned.suggested_time);
      const fits = gaps.find((g) => t >= g.start && t + slot.minutes <= g.end);
      if (fits) start = t;
    }
    if (start === null) {
      const candidates = gaps
        .map((g) => {
          const from = Math.max(g.start, slot.from);
          const to = Math.min(g.end, slot.to);
          return { from, to, room: to - from };
        })
        .filter((c) => c.room >= slot.minutes)
        .sort((a, b) => b.room - a.room);
      if (candidates[0]) start = candidates[0].from;
    }
    if (start === null) {
      start = planned.suggested_time ? toMinutes(planned.suggested_time) : slot.from;
    }

    const end = start + slot.minutes;
    const anchor =
      events.filter((e) => e.locked && e.start >= end && e.place).sort((a, b) => a.start - b.start)[0]?.place
      ?? events.filter((e) => e.locked && e.end <= start && e.place).sort((a, b) => b.end - a.end)[0]?.place
      ?? null;

    const plannedPlace =
      input.diningPlaces.find((p) => p.label.toLowerCase() === planned.location_name.toLowerCase())
      ?? campusPlace(planned.location_name);

    const ranked = anchor
      ? input.diningPlaces
          .map((p) => ({ ...p, walkMin: Math.max(1, Math.round(haversineMetres(anchor.lat, anchor.lng, p.lat, p.lng) / 80)) }))
          .sort((a, b) => a.walkMin - b.walkMin)
      : input.diningPlaces.map((p) => ({ ...p, walkMin: 0 }));

    const place = plannedPlace ?? ranked[0] ?? nearest(anchor, input.diningPlaces);
    const sides = planned.add_ons?.length ?? 0;

    events.push({
      id: `meal-${order}-${String(planned.meal_type || "meal").toLowerCase()}`,
      kind: "meal",
      title: planned.item_name || String(planned.meal_type || "Meal"),
      subtitle: place
        ? sides > 0 ? `${place.label} · +${sides} side${sides === 1 ? "" : "s"}` : place.label
        : "Pick a spot",
      start,
      end,
      place,
      href: planned.location_id
        ? `/menu?location=${encodeURIComponent(planned.location_id)}`
        : "/menu",
      locked: false,
      alternatives: ranked.filter((p) => p.label !== place?.label).slice(0, 3),
    });
  }

  if (input.workout && !input.workout.is_rest) {
    const gaps = gapsBetween(events, window).filter((g) => g.end - g.start >= WORKOUT_MINUTES);
    const preferred = gaps.filter((g) => g.start >= 14 * 60);
    const chosen = (preferred.length > 0 ? preferred : gaps)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
    if (chosen) {
      const gym = campusPlaceByCode("IMA");
      events.push({
        id: "workout",
        kind: "workout",
        title: input.workout.label || "Training",
        subtitle: `${input.workout.exercises.length} exercises`,
        start: chosen.start,
        end: chosen.start + WORKOUT_MINUTES,
        place: gym ? { label: gym.name, lat: gym.lat, lng: gym.lng } : null,
        href: "/log",
        locked: false,
      });
    }
  }

  for (const gap of gapsBetween(events, window)) {
    if (gap.end - gap.start < 60) continue;
    events.push({
      id: `study-${gap.start}`,
      kind: "study",
      title: "Open block",
      subtitle: "Study, rest, or catch up",
      start: gap.start,
      end: gap.end,
      place: null,
      href: "/dashboard",
      locked: false,
    });
  }

  return events.sort((a, b) => a.start - b.start);
}

export function routeStops(events: DayEvent[]): DayEvent[] {
  return events.filter((e) => e.place !== null);
}

export function nextStopIndex(stops: DayEvent[], nowMinutes: number): number {
  const idx = stops.findIndex((s) => s.end > nowMinutes);
  return idx === -1 ? Math.max(0, stops.length - 1) : idx;
}
