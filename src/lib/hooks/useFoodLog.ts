"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { DayFoodLog, DayTotals, FoodLogEntry } from "@/lib/db/types";

export interface FoodLogItem extends FoodLogEntry {
  id: string;
}

interface UseFoodLogResult {
  entries: FoodLogItem[];
  totals: DayTotals;
  loading: boolean;
}

export function useFoodLog(dateKey: string): UseFoodLogResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<DayFoodLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.dayLogs(uid, dateKey)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as DayFoodLog) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle, dateKey]);

  const entries = useMemo<FoodLogItem[]>(() => {
    if (!raw) return [];
    return Object.entries(raw).map(([id, entry]) => ({ id, ...entry }));
  }, [raw]);

  const totals = useMemo<DayTotals>(() => {
    return entries.reduce<DayTotals>(
      (acc, e) => ({
        calories: acc.calories + (e.calories || 0),
        protein: acc.protein + (e.protein_grams || 0),
        carbs: acc.carbs + (e.carbs_grams || 0),
        fat: acc.fat + (e.fat_grams || 0),
        cost: acc.cost + (e.price || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 },
    );
  }, [entries]);

  return { entries, totals, loading };
}
