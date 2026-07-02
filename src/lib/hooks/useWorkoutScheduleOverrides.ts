"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { WorkoutScheduleOverride } from "@/lib/db/types";

export function useWorkoutScheduleOverrides(): Record<string, WorkoutScheduleOverride> {
  const handle = useUserDb();
  const [values, setValues] = useState<Record<string, WorkoutScheduleOverride>>({});
  useEffect(() => {
    if (!handle) { queueMicrotask(() => setValues({})); return; }
    return onValue(ref(handle.db, PATHS.workoutScheduleOverrides(handle.uid)), (snap) => setValues(snap.exists() ? snap.val() as Record<string, WorkoutScheduleOverride> : {}));
  }, [handle]);
  return values;
}
