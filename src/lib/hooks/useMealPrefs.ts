"use client";

import { useEffect, useMemo, useState } from "react";
import { ref } from "firebase/database";
import { onValue } from "@/lib/offline/db";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import { buildPreferenceProfile, type PreferenceProfile } from "@/lib/planner/preferences";
import type { MealRatingMap, TasteEventLog } from "@/lib/db/types";

interface UseMealPrefsResult {
  ratings: MealRatingMap;
  events: TasteEventLog;
  profile: PreferenceProfile;
}

export function useMealPrefs(): UseMealPrefsResult {
  const handle = useUserDb();
  const [ratings, setRatings] = useState<MealRatingMap>({});
  const [events, setEvents] = useState<TasteEventLog>({});

  useEffect(() => {
    if (!handle) {
      setRatings({});
      setEvents({});
      return;
    }
    const { db, uid } = handle;
    const unsubR = onValue(ref(db, PATHS.mealRatings(uid)), (snap) => {
      setRatings(snap.exists() ? (snap.val() as MealRatingMap) : {});
    });
    const unsubE = onValue(ref(db, PATHS.tasteEvents(uid)), (snap) => {
      setEvents(snap.exists() ? (snap.val() as TasteEventLog) : {});
    });
    return () => { unsubR(); unsubE(); };
  }, [handle]);

  const profile = useMemo(
    () => buildPreferenceProfile({ ratings, events, nowMs: Date.now() }),
    [ratings, events],
  );

  return { ratings, events, profile };
}
