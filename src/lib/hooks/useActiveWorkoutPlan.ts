"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { PATHS } from "@/lib/db/paths";
import { useUserDb } from "@/lib/hooks/useUserDb";
import type { ActiveWorkoutPlan, WorkoutPlanDay } from "@/lib/db/types";

function asArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value && typeof value === "object" ? Object.values(value).filter(Boolean) : [];
}

export function useActiveWorkoutPlan(): ActiveWorkoutPlan | null {
  const handle = useUserDb();
  const [plan, setPlan] = useState<ActiveWorkoutPlan | null>(null);

  useEffect(() => {
    if (!handle) { queueMicrotask(() => setPlan(null)); return; }
    return onValue(ref(handle.db, PATHS.activeWorkout(handle.uid)), (snap) => {
      if (!snap.exists()) { setPlan(null); return; }
      const next = snap.val() as ActiveWorkoutPlan;
      setPlan({
        ...next,
        days: asArray<WorkoutPlanDay>(next.days).map((day) => ({ ...day, exercises: asArray(day.exercises) })),
      });
    });
  }, [handle]);

  return plan;
}
