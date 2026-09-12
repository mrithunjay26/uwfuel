"use client";

import { useEffect, useState } from "react";
import { ref } from "firebase/database";
import { onValue } from "@/lib/offline/db";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import { DEFAULT_MEAL_TIMING, parseMealTiming, type MealTiming } from "@/lib/planner/mealTiming";

export function useMealTiming(): { timing: MealTiming; loading: boolean } {
  const handle = useUserDb();
  const [timing, setTiming] = useState<MealTiming>(DEFAULT_MEAL_TIMING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { setTiming(DEFAULT_MEAL_TIMING); setLoading(false); return; }
    const { db, uid } = handle;
    const unsub = onValue(ref(db, PATHS.mealTiming(uid)), (snap) => {
      setTiming(parseMealTiming(snap.exists() ? snap.val() : null));
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  return { timing, loading };
}
