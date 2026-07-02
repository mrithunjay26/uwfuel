"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { PATHS } from "@/lib/db/paths";
import { useUserDb } from "@/lib/hooks/useUserDb";
import type { WorkoutPlan, WorkoutPlanItem } from "@/lib/db/types";

function asArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value && typeof value === "object" ? Object.values(value).filter(Boolean) : [];
}

export function useWorkoutPlans(): { plans: WorkoutPlanItem[]; loading: boolean } {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, WorkoutPlan> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { queueMicrotask(() => { setRaw(null); setLoading(false); }); return; }
    return onValue(ref(handle.db, PATHS.workoutRepo(handle.uid)), (snap) => {
      setRaw(snap.exists() ? snap.val() as Record<string, WorkoutPlan> : null);
      setLoading(false);
    });
  }, [handle]);

  const plans = useMemo(() => !raw ? [] : Object.entries(raw).map(([id, plan]) => ({
    ...plan,
    id,
    days: asArray(plan.days).map((day) => ({ ...day, exercises: asArray(day.exercises) })),
  })).sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [raw]);

  return { plans, loading };
}
