"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";

/** Set of date keys (YYYY-MM-DD) that have at least one food-log entry. */
export function useFoodLogDays(): Set<string> {
  const handle = useUserDb();
  const [days, setDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!handle) {
      setDays(new Set());
      return;
    }
    const { db, uid } = handle;
    const unsub = onValue(ref(db, PATHS.logs(uid)), (snap) => {
      const v = snap.val() as Record<string, unknown> | null;
      const s = new Set<string>();
      if (v) {
        for (const [date, entries] of Object.entries(v)) {
          if (entries && typeof entries === "object" && Object.keys(entries).length > 0) s.add(date);
        }
      }
      setDays(s);
    });
    return () => unsub();
  }, [handle]);

  return days;
}
