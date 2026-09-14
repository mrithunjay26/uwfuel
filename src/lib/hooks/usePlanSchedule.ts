"use client";

import { useEffect, useState } from "react";
import { ref } from "firebase/database";
import { onValue } from "@/lib/offline/db";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { Weekday } from "@/lib/db/types";

export type PlanScheduleMap = Partial<Record<Weekday, string>>;

interface UsePlanScheduleResult {
  schedule: PlanScheduleMap;
  loading: boolean;
}

export function usePlanSchedule(): UsePlanScheduleResult {
  const handle = useUserDb();
  const [schedule, setSchedule] = useState<PlanScheduleMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setSchedule({});
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.planSchedule(uid)), (snap) => {
      setSchedule(snap.exists() ? (snap.val() as PlanScheduleMap) : {});
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  return { schedule, loading };
}
