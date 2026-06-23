"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { DayPlanRepo, MealPlan } from "@/lib/db/types";

export interface PlanRepoItem extends MealPlan {
  id: string;
}

interface UsePlanRepoResult {
  plans: PlanRepoItem[];
  loading: boolean;
}

export function usePlanRepo(dateKey: string): UsePlanRepoResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<DayPlanRepo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.dayPlanRepo(uid, dateKey)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as DayPlanRepo) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle, dateKey]);

  const plans = useMemo<PlanRepoItem[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, plan]) => ({ id, ...plan }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [raw]);

  return { plans, loading };
}
