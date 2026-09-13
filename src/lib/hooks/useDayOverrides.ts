"use client";

import { useEffect, useState } from "react";
import { ref } from "firebase/database";
import { onValue } from "@/lib/offline/db";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";

export function useDayOverrides(dateKey: string): Record<string, number> {
  const handle = useUserDb();
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!handle) { setOverrides({}); return; }
    const unsub = onValue(ref(handle.db, PATHS.dayOverrides(handle.uid, dateKey)), (snap) => {
      const val = snap.exists() ? snap.val() : {};
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(val ?? {})) {
        if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
      }
      setOverrides(clean);
    });
    return () => unsub();
  }, [handle, dateKey]);

  return overrides;
}
