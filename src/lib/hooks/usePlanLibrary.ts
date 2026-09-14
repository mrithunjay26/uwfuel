"use client";

import { useEffect, useMemo, useState } from "react";
import { ref } from "firebase/database";
import { onValue } from "@/lib/offline/db";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { MealPlan } from "@/lib/db/types";

export interface PlanLibraryItem extends MealPlan {
  id: string;
}

interface UsePlanLibraryResult {
  plans: PlanLibraryItem[];
  loading: boolean;
}

export function usePlanLibrary(): UsePlanLibraryResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, MealPlan> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.planLibrary(uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as Record<string, MealPlan>) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const plans = useMemo<PlanLibraryItem[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, plan]) => ({ id, ...plan }))
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [raw]);

  return { plans, loading };
}
