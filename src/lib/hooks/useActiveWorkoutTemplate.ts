"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { ActiveWorkoutTemplate } from "@/lib/db/types";

export function useActiveWorkoutTemplate(): { template: ActiveWorkoutTemplate | null } {
  const handle = useUserDb();
  const [template, setTemplate] = useState<ActiveWorkoutTemplate | null>(null);

  useEffect(() => {
    if (!handle) { setTemplate(null); return; }
    const unsub = onValue(ref(handle.db, PATHS.workoutTemplates(handle.uid)), (snap) => {
      const v = snap.val();
      setTemplate(v && Array.isArray(v.exercises) ? (v as ActiveWorkoutTemplate) : null);
    });
    return () => unsub();
  }, [handle]);

  return { template };
}
