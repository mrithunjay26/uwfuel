"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { WeightLog, WeightEntry } from "@/lib/db/types";

export interface WeightPoint {
  dateKey: string;
  weight: number;
  timestamp: string;
}

interface UseWeightLogResult {
  points: WeightPoint[];
  latest: WeightPoint | null;
  loading: boolean;
}

export function useWeightLog(): UseWeightLogResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.weights(uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as WeightLog) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const points = useMemo<WeightPoint[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([dateKey, entry]: [string, WeightEntry]) => ({
        dateKey,
        weight: entry.weight,
        timestamp: entry.timestamp,
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [raw]);

  const latest = points.length > 0 ? points[points.length - 1] : null;

  return { points, latest, loading };
}
