"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { ReadinessCheck } from "@/lib/db/types";

export function useReadiness(dateKey: string): ReadinessCheck | null {
  const handle = useUserDb();
  const [value, setValue] = useState<ReadinessCheck | null>(null);
  useEffect(() => {
    if (!handle) { queueMicrotask(() => setValue(null)); return; }
    return onValue(ref(handle.db, PATHS.readiness(handle.uid, dateKey)), (snap) => setValue(snap.exists() ? snap.val() as ReadinessCheck : null));
  }, [handle, dateKey]);
  return value;
}
