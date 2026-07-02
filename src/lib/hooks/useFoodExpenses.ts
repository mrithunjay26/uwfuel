"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { FoodExpense } from "@/lib/db/types";

export interface FoodExpenseItem extends FoodExpense { id: string }

export function useFoodExpenses(): { expenses: FoodExpenseItem[]; loading: boolean } {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, FoodExpense> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!handle) { queueMicrotask(() => { setRaw(null); setLoading(false); }); return; }
    return onValue(ref(handle.db, PATHS.foodExpenses(handle.uid)), (snap) => {
      setRaw(snap.exists() ? snap.val() as Record<string, FoodExpense> : null);
      setLoading(false);
    });
  }, [handle]);
  const expenses = useMemo(() => !raw ? [] : Object.entries(raw).map(([id, value]) => ({ id, ...value })).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)), [raw]);
  return { expenses, loading };
}
