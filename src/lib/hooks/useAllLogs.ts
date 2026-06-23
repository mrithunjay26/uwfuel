"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { DayFoodLog, FoodLogEntry } from "@/lib/db/types";

export interface DailyStats {
  dateKey: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cost: number;
  entryCount: number;
}

interface UseAllLogsResult {
  byDay: Record<string, DailyStats>;
  days: DailyStats[];
  loading: boolean;
}

export function useAllLogs(): UseAllLogsResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, DayFoodLog> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onValue(ref(handle.db, PATHS.logs(handle.uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as Record<string, DayFoodLog>) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const { byDay, days } = useMemo<{ byDay: Record<string, DailyStats>; days: DailyStats[] }>(() => {
    if (!raw) return { byDay: {}, days: [] };
    const byDay: Record<string, DailyStats> = {};

    Object.entries(raw).forEach(([dateKey, dayLog]) => {
      const entries = Object.values(dayLog) as FoodLogEntry[];
      byDay[dateKey] = {
        dateKey,
        calories: entries.reduce((s, e) => s + (e.calories ?? 0), 0),
        protein: entries.reduce((s, e) => s + (e.protein_grams ?? 0), 0),
        carbs: entries.reduce((s, e) => s + (e.carbs_grams ?? 0), 0),
        fat: entries.reduce((s, e) => s + (e.fat_grams ?? 0), 0),
        cost: entries.reduce((s, e) => s + (e.price ?? 0), 0),
        entryCount: entries.length,
      };
    });

    const days = Object.values(byDay).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return { byDay, days };
  }, [raw]);

  return { byDay, days, loading };
}
