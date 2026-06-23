"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { LoggedSet, WorkoutLog, WorkoutLogExercise, WorkoutLogItem } from "@/lib/db/types";

interface UseWorkoutLogsResult {
  logs: WorkoutLogItem[];
  loading: boolean;
}

function toList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v.filter((x) => x != null) as T[];
  if (v && typeof v === "object") return Object.values(v as Record<string, T>).filter((x) => x != null);
  return [];
}

function normalizeExercise(raw: unknown): WorkoutLogExercise {
  const ex = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sets: LoggedSet[] = toList<Record<string, unknown>>(ex.sets).map((s) => ({
    weight: Number(s?.weight ?? 0) || 0,
    reps: Number(s?.reps ?? 0) || 0,
    ...(s?.is_pr ? { is_pr: true } : {}),
  }));
  return {
    name: String(ex.name ?? "Exercise"),
    ...(ex.exercise_id ? { exercise_id: String(ex.exercise_id) } : {}),
    ...(ex.muscle ? { muscle: String(ex.muscle) } : {}),
    ...(ex.tip ? { tip: String(ex.tip) } : {}),
    sets,
  };
}

function normalizeLog(id: string, raw: WorkoutLog): WorkoutLogItem {
  return {
    id,
    date: raw.date,
    title: raw.title || "Workout",
    source: raw.source ?? "manual",
    created_at: raw.created_at ?? "",
    ...(raw.duration_min ? { duration_min: raw.duration_min } : {}),
    exercises: toList<unknown>(raw.exercises).map(normalizeExercise),
  };
}

export function useWorkoutLogs(): UseWorkoutLogsResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, WorkoutLog> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.workoutLogs(uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as Record<string, WorkoutLog>) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const logs = useMemo<WorkoutLogItem[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, l]) => normalizeLog(id, l))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [raw]);

  return { logs, loading };
}
