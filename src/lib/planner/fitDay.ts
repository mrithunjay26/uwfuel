import type { MealType, PlanMeal } from "@/lib/db/types";

export interface PlannerItem {
  key: string;
  name: string;
  location_id: string;
  location_name: string;
  calories: number;
  protein: number;
  price: number;
}

export interface PlannerSlot {
  type: MealType;
  time: string;
  near: { lat: number; lng: number } | null;
}

export interface PlannerPick {
  type: MealType;
  key: string;
  time?: string;
  reasoning?: string;
}

export interface FitDayInput {
  slots: PlannerSlot[];
  pool: PlannerItem[];
  extras: PlannerItem[];
  coords: Record<string, { lat: number; lng: number }>;
  budget: number;
  targetKcal: number;
  picks?: PlannerPick[];
  bias?: (item: PlannerItem) => number;
  isLocationOpen?: (locationId: string, minute: number) => boolean;
}

export interface FitDayResult {
  meals: PlanMeal[];
  totals: { calories: number; protein: number; cost: number };
  notes: string[];
}

export const ANYWHERE_LOCATION = "anywhere";

const TYPE_SHARE: Record<MealType, number> = {
  Breakfast: 0.25,
  Lunch: 0.35,
  Dinner: 0.3,
  Snack: 0.1,
};

const TYPE_ORDER: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const KCAL_FLOOR = 0.95;
const KCAL_CEILING = 1.08;
const MAX_ADD_ONS_PER_MEAL = 0;
const MAX_PASSES = 40;
const BIAS_WEIGHT = 1.6;

export function slotTypesFor(count: number): MealType[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => TYPE_ORDER[Math.min(i, TYPE_ORDER.length - 1)]);
}

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

interface Draft {
  type: MealType;
  time: string;
  near: { lat: number; lng: number } | null;
  kcalTarget: number;
  main: PlannerItem;
  addOns: PlannerItem[];
  reasoning?: string;
}

function clockToMinute(clock: string): number {
  const m = /(d{1,2})(?::(d{2}))?s*(AM|PM)?/i.exec((clock || "").trim());
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || "0", 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function money(n: number): string {
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

function kcalText(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fitDay(input: FitDayInput): FitDayResult {
  const { coords, budget, targetKcal } = input;
  const slots = input.slots.length > 0 ? input.slots : [{ type: "Lunch" as MealType, time: "12:30 PM", near: null }];

  const rank = new Map<string, number>();
  input.pool.forEach((item, i) => rank.set(item.key, 1 - i / Math.max(1, input.pool.length)));
  const bias = (item: PlannerItem): number => input.bias?.(item) ?? 0;
  const isOpen = (item: PlannerItem, minute: number): boolean => input.isLocationOpen?.(item.location_id, minute) ?? true;

  const shares = slots.map((s) => TYPE_SHARE[s.type] ?? 0.2);
  const shareSum = shares.reduce((a, b) => a + b, 0) || 1;
  const slotKcal = shares.map((s) => (targetKcal * s) / shareSum);

  const walkMinutes = (item: PlannerItem, near: Draft["near"]): number | null => {
    if (!near) return null;
    const at = coords[item.location_id];
    if (!at) return null;
    return Math.max(1, Math.round(metresBetween(near, at) / 80));
  };

  const nearness = (item: PlannerItem, near: Draft["near"]): number => {
    if (item.location_id === ANYWHERE_LOCATION) return 1;
    const mins = walkMinutes(item, near);
    if (mins === null) return 0.45;
    return Math.max(0, 1 - mins / 18);
  };

  const calorieFit = (calories: number, want: number): number =>
    want <= 0 ? 0 : Math.max(0, 1 - Math.abs(calories - want) / want);

  const used = new Set<string>();
  const byKey = new Map<string, PlannerItem>();
  [...input.pool, ...input.extras].forEach((item) => { if (!byKey.has(item.key)) byKey.set(item.key, item); });

  const bestOf = (
    list: PlannerItem[],
    score: (item: PlannerItem) => number,
    allow: (item: PlannerItem) => boolean,
  ): PlannerItem | null => {
    let best: PlannerItem | null = null;
    let bestScore = -Infinity;
    for (const item of list) {
      if (used.has(item.key) || !allow(item)) continue;
      const s = score(item);
      if (s > bestScore) { bestScore = s; best = item; }
    }
    return best;
  };

  const pickQueue = new Map<MealType, PlannerPick[]>();
  for (const pick of input.picks ?? []) {
    const list = pickQueue.get(pick.type) ?? [];
    list.push(pick);
    pickQueue.set(pick.type, list);
  }

  const drafts: Draft[] = [];
  slots.forEach((slot, i) => {
    const want = slotKcal[i];
    const slotMinute = clockToMinute(slot.time);
    let main: PlannerItem | null = null;
    let reasoning: string | undefined;
    let time = slot.time;

    const queue = pickQueue.get(slot.type) ?? [];
    while (queue.length > 0 && !main) {
      const pick = queue.shift() as PlannerPick;
      const item = byKey.get(pick.key);
      if (item && !used.has(item.key) && isOpen(item, slotMinute)) {
        main = item;
        reasoning = pick.reasoning;
        if (pick.time) time = pick.time;
      }
    }

    if (!main) {
      main = bestOf(
        input.pool,
        (item) => (rank.get(item.key) ?? 0) * 1.4 + nearness(item, slot.near) * 2 + calorieFit(item.calories, want) * 1.6 + bias(item) * BIAS_WEIGHT,
        (item) => item.price <= budget && isOpen(item, slotMinute),
      );
    }

    if (main) {
      used.add(main.key);
      drafts.push({ type: slot.type, time, near: slot.near, kcalTarget: want, main, addOns: [], reasoning });
    }
  });

  const draftCost = (d: Draft) => d.main.price + d.addOns.reduce((s, a) => s + a.price, 0);
  const draftCalories = (d: Draft) => d.main.calories + d.addOns.reduce((s, a) => s + a.calories, 0);
  const totalCost = () => drafts.reduce((s, d) => s + draftCost(d), 0);
  const totalCalories = () => drafts.reduce((s, d) => s + draftCalories(d), 0);

  let swaps = 0;
  let droppedMeals = 0;
  for (let pass = 0; pass < MAX_PASSES && totalCost() > budget + 1e-9 && drafts.length > 0; pass++) {
    let idx = 0;
    drafts.forEach((d, i) => { if (draftCost(d) > draftCost(drafts[idx])) idx = i; });
    const d = drafts[idx];

    if (d.addOns.length > 0) {
      const removed = d.addOns.pop() as PlannerItem;
      used.delete(removed.key);
      continue;
    }

    const room = budget - (totalCost() - draftCost(d));
    const swap =
      bestOf(
        input.pool,
        (item) => (rank.get(item.key) ?? 0) * 1.2 + nearness(item, d.near) * 2 + calorieFit(item.calories, d.kcalTarget) * 1.6,
        (item) => item.price <= room && isOpen(item, clockToMinute(d.time)),
      ) ?? bestOf(input.pool, (item) => -item.price, (item) => item.price < d.main.price && isOpen(item, clockToMinute(d.time)));

    if (swap) {
      used.delete(d.main.key);
      used.add(swap.key);
      d.main = swap;
      swaps++;
      continue;
    }

    used.delete(d.main.key);
    d.addOns.forEach((a) => used.delete(a.key));
    drafts.splice(idx, 1);
    droppedMeals++;
  }

  let sidesAdded = 0;
  let upgrades = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const calories = totalCalories();
    if (calories >= targetKcal * KCAL_FLOOR || drafts.length === 0) break;
    const room = budget - totalCost();
    const deficit = targetKcal - calories;

    let bestSide: { draft: Draft; item: PlannerItem; score: number } | null = null;
    for (const d of drafts) {
      if (d.addOns.length >= MAX_ADD_ONS_PER_MEAL) continue;
      for (const item of input.extras) {
        if (used.has(item.key) || item.calories <= 0) continue;
        if (item.location_id !== d.main.location_id && item.location_id !== ANYWHERE_LOCATION) continue;
        if (item.price > room) continue;
        const score = Math.min(item.calories, deficit * 1.3) / Math.max(0.5, item.price);
        if (!bestSide || score > bestSide.score) bestSide = { draft: d, item, score };
      }
    }
    if (bestSide) {
      bestSide.draft.addOns.push(bestSide.item);
      used.add(bestSide.item.key);
      sidesAdded++;
      continue;
    }

    let bestUpgrade: { draft: Draft; item: PlannerItem; score: number } | null = null;
    for (const d of drafts) {
      const roomFor = room + d.main.price;
      for (const item of input.pool) {
        if (used.has(item.key) || item.price > roomFor || item.calories <= d.main.calories || !isOpen(item, clockToMinute(d.time))) continue;
        const score = (item.calories - d.main.calories) * (0.6 + nearness(item, d.near) * 0.6);
        if (!bestUpgrade || score > bestUpgrade.score) bestUpgrade = { draft: d, item, score };
      }
    }
    if (bestUpgrade) {
      used.delete(bestUpgrade.draft.main.key);
      used.add(bestUpgrade.item.key);
      bestUpgrade.draft.main = bestUpgrade.item;
      upgrades++;
      continue;
    }
    break;
  }

  let trims = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const calories = totalCalories();
    if (calories <= targetKcal * KCAL_CEILING || drafts.length === 0) break;
    const over = calories - targetKcal;

    let bestDrop: { draft: Draft; index: number; item: PlannerItem } | null = null;
    drafts.forEach((d) => {
      d.addOns.forEach((a, i) => {
        if (!bestDrop || Math.abs(a.calories - over) < Math.abs(bestDrop.item.calories - over)) {
          bestDrop = { draft: d, index: i, item: a };
        }
      });
    });
    if (bestDrop !== null) {
      const drop = bestDrop as { draft: Draft; index: number; item: PlannerItem };
      if (drop.item.calories <= over * 1.4) {
        drop.draft.addOns.splice(drop.index, 1);
        used.delete(drop.item.key);
        trims++;
        continue;
      }
    }

    let idx = 0;
    drafts.forEach((d, i) => { if (d.main.calories > drafts[idx].main.calories) idx = i; });
    const d = drafts[idx];
    const roomFor = budget - totalCost() + d.main.price;
    const lighter = bestOf(
      input.pool,
      (item) => calorieFit(item.calories, Math.max(120, d.main.calories - over)) + nearness(item, d.near),
      (item) => item.calories < d.main.calories && item.price <= roomFor,
    );
    if (!lighter) break;
    used.delete(d.main.key);
    used.add(lighter.key);
    d.main = lighter;
    trims++;
  }

  drafts.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));

  const meals: PlanMeal[] = drafts.map((d) => ({
    meal_type: d.type,
    item_name: d.main.name,
    location_id: d.main.location_id,
    location_name: d.main.location_name,
    estimated_calories: Math.round(draftCalories(d)),
    estimated_protein: Math.round(d.main.protein + d.addOns.reduce((s, a) => s + a.protein, 0)),
    estimated_cost: Math.round(draftCost(d) * 100) / 100,
    suggested_time: d.time,
    reasoning: d.reasoning ?? "",
    ...(d.addOns.length > 0
      ? {
          add_ons: d.addOns.map((a) => ({
            item_name: a.name,
            location_id: a.location_id,
            location_name: a.location_name,
            estimated_calories: Math.round(a.calories),
            estimated_protein: Math.round(a.protein),
            estimated_cost: a.price,
          })),
        }
      : {}),
  }));

  const totals = {
    calories: meals.reduce((s, m) => s + m.estimated_calories, 0),
    protein: meals.reduce((s, m) => s + m.estimated_protein, 0),
    cost: Math.round(meals.reduce((s, m) => s + m.estimated_cost, 0) * 100) / 100,
  };

  const notes: string[] = [];
  if (swaps > 0) notes.push(`Swapped ${swaps} pricier pick${swaps === 1 ? "" : "s"} to stay under ${money(budget)}.`);
  if (sidesAdded > 0) notes.push(`Added ${sidesAdded} side${sidesAdded === 1 ? "" : "s"} where you're already eating to hit ${kcalText(targetKcal)} kcal.`);
  if (upgrades > 0 && sidesAdded === 0) notes.push(`Picked bigger plates to get closer to ${kcalText(targetKcal)} kcal.`);
  if (trims > 0) notes.push(`Trimmed the plan back toward ${kcalText(targetKcal)} kcal.`);
  if (droppedMeals > 0) notes.push(`Dropped ${droppedMeals} meal${droppedMeals === 1 ? "" : "s"} — they don't fit under ${money(budget)}.`);
  if (totals.calories < targetKcal * KCAL_FLOOR) {
    notes.push(`This only gets you to ${kcalText(totals.calories)} of ${kcalText(targetKcal)} kcal. Raise your budget cap to buy more food.`);
  }

  return { meals, totals, notes };
}
