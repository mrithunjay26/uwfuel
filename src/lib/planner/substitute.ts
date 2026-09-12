import type { PlannerItem } from "@/lib/planner/fitDay";
import type { PreferenceProfile } from "@/lib/planner/preferences";
import { mealFoodKey } from "@/lib/planner/tasteKey";

export interface SubstituteInput {
  pool: PlannerItem[];
  currentName: string;
  currentCalories: number;
  maxPrice: number;
  profile: PreferenceProfile;
  limit?: number;
}

function calorieFit(calories: number, want: number): number {
  if (want <= 0) return 0.5;
  return Math.max(0, 1 - Math.abs(calories - want) / want);
}

export function substituteOptions(input: SubstituteInput): PlannerItem[] {
  const curKey = mealFoodKey(input.currentName);
  const seen = new Set<string>();

  return input.pool
    .filter((item) => {
      const k = mealFoodKey(item.name);
      if (k === curKey) return false;
      if (item.price > input.maxPrice + 1e-9) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((item) => ({
      item,
      score:
        input.profile.bias({ name: item.name, location_id: item.location_id }) * 1.6 +
        calorieFit(item.calories, input.currentCalories) * 1.0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 5)
    .map((s) => s.item);
}
