import type { MealRatingMap, TasteEventLog, TasteEvent } from "@/lib/db/types";
import { mealFoodKey } from "@/lib/planner/tasteKey";

export interface FoodLike {
  name: string;
  location_id?: string;
}

export interface PreferenceInput {
  ratings: MealRatingMap;
  events: TasteEventLog;
  nowMs: number;
}

export interface PreferenceProfile {
  bias(food: FoodLike): number;
  recentlyEatenNames: string[];
  lovedNames: string[];
  dislikedNames: string[];
  favoriteSpotIds: string[];
  promptLines(resolveSpot?: (id: string) => string | undefined): string[];
}

const DAY = 86_400_000;

const RATING_HALF_LIFE = 45 * DAY;
const RATING_WEIGHT: Record<string, number> = { loved: 1.0, good: 0.4, bad: -1.2 };

const RECENT_MAX = 1.0;
const RECENT_HALF_LIFE = 2 * DAY;

const REPEAT_WINDOW = 3 * DAY;
const REPEAT_STEP = 0.3;
const REPEAT_CAP = 0.9;

const SKIP_WINDOW = 14 * DAY;
const SKIP_STEP = 0.25;
const SKIP_CAP = 0.6;

const SPOT_WINDOW = 30 * DAY;
const SPOT_CAP = 0.3;

const BIAS_MIN = -1.5;
const BIAS_MAX = 1.2;

function decay(ageMs: number, halfLife: number): number {
  if (ageMs <= 0) return 1;
  return Math.pow(0.5, ageMs / halfLife);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function buildPreferenceProfile(input: PreferenceInput): PreferenceProfile {
  const now = input.nowMs;
  const ratings = input.ratings ?? {};
  const events = Object.values(input.events ?? {});

  const eatenByKey = new Map<string, TasteEvent[]>();
  const skipByKey = new Map<string, TasteEvent[]>();
  const spotEaten = new Map<string, number>();

  for (const e of events) {
    if (!e || !e.key) continue;
    if (e.kind === "eaten" || e.kind === "planned") {
      const list = eatenByKey.get(e.key) ?? [];
      list.push(e);
      eatenByKey.set(e.key, list);
      if (e.kind === "eaten" && e.location_id && now - e.at <= SPOT_WINDOW) {
        spotEaten.set(e.location_id, (spotEaten.get(e.location_id) ?? 0) + 1);
      }
    } else if (e.kind === "skipped" || e.kind === "substituted") {
      const list = skipByKey.get(e.key) ?? [];
      list.push(e);
      skipByKey.set(e.key, list);
    }
  }

  const spotMax = Math.max(1, ...spotEaten.values());
  const favoriteSpotIds = [...spotEaten.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 5);

  function ratingBias(key: string): number {
    const r = ratings[key];
    if (!r) return 0;
    const w = RATING_WEIGHT[r.rating] ?? 0;
    return w * decay(now - (r.updated_at ?? now), RATING_HALF_LIFE);
  }

  function recencyPenalty(key: string): number {
    const list = eatenByKey.get(key);
    if (!list || list.length === 0) return 0;
    const mostRecent = Math.max(...list.map((e) => e.at));
    return -RECENT_MAX * decay(now - mostRecent, RECENT_HALF_LIFE);
  }

  function repetitionPenalty(key: string): number {
    const list = eatenByKey.get(key);
    if (!list) return 0;
    const recent = list.filter((e) => now - e.at <= REPEAT_WINDOW).length;
    if (recent <= 1) return 0;
    return -Math.min(REPEAT_CAP, (recent - 1) * REPEAT_STEP);
  }

  function skipPenalty(key: string): number {
    const list = skipByKey.get(key);
    if (!list) return 0;
    let total = 0;
    for (const e of list) {
      if (now - e.at > SKIP_WINDOW) continue;
      total += SKIP_STEP * decay(now - e.at, SKIP_WINDOW / 2);
    }
    return -Math.min(SKIP_CAP, total);
  }

  function spotBias(locationId?: string): number {
    if (!locationId) return 0;
    const n = spotEaten.get(locationId);
    if (!n) return 0;
    return SPOT_CAP * (n / spotMax);
  }

  function bias(food: FoodLike): number {
    const key = mealFoodKey(food.name);
    const raw =
      ratingBias(key) +
      recencyPenalty(key) +
      repetitionPenalty(key) +
      skipPenalty(key) +
      spotBias(food.location_id);
    return clamp(raw, BIAS_MIN, BIAS_MAX);
  }

  const lovedNames = Object.values(ratings)
    .filter((r) => r.rating === "loved")
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
    .map((r) => r.name)
    .slice(0, 8);

  const dislikedNames = Object.values(ratings)
    .filter((r) => r.rating === "bad")
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
    .map((r) => r.name)
    .slice(0, 8);

  const recentlyEatenNames = events
    .filter((e) => e && (e.kind === "eaten" || e.kind === "planned") && now - e.at <= 5 * DAY)
    .sort((a, b) => b.at - a.at)
    .map((e) => e.name)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .slice(0, 10);

  function promptLines(resolveSpot?: (id: string) => string | undefined): string[] {
    const lines: string[] = [];
    if (lovedNames.length) lines.push(`Loves (favor these or similar): ${lovedNames.join(", ")}.`);
    if (dislikedNames.length) lines.push(`Dislikes (avoid): ${dislikedNames.join(", ")}.`);
    if (recentlyEatenNames.length) lines.push(`Ate in the last few days (pick something different for variety): ${recentlyEatenNames.join(", ")}.`);
    if (favoriteSpotIds.length && resolveSpot) {
      const names = favoriteSpotIds.map(resolveSpot).filter(Boolean) as string[];
      if (names.length) lines.push(`Favorite spots: ${names.join(", ")}.`);
    }
    return lines;
  }

  return { bias, recentlyEatenNames, lovedNames, dislikedNames, favoriteSpotIds, promptLines };
}
