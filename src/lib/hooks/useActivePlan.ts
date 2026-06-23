"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { ActivePlan } from "@/lib/db/types";

interface UseActivePlanResult {
  activePlan: ActivePlan | null;
  loading: boolean;
}

export function useActivePlan(): UseActivePlanResult {
  const handle = useUserDb();
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setActivePlan(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.activePlan(uid)), (snap) => {
      setActivePlan(snap.exists() ? (snap.val() as ActivePlan) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  return { activePlan, loading };
}
