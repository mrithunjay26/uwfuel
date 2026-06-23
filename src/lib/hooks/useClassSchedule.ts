"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { ClassSchedule, ClassStop, Weekday } from "@/lib/db/types";

interface UseClassScheduleResult {
  schedule: ClassSchedule | null;
  loading: boolean;
  stopsForDay: (day: Weekday) => ClassStop[];
  todayStops: ClassStop[];
}

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

function currentWeekday(): Weekday {
  return JS_DAY_TO_WEEKDAY[new Date().getDay()];
}

export function useClassSchedule(): UseClassScheduleResult {
  const handle = useUserDb();
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setSchedule(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onValue(ref(handle.db, PATHS.classSchedule(handle.uid)), (snap) => {
      setSchedule(snap.exists() ? (snap.val() as ClassSchedule) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  function stopsForDay(day: Weekday): ClassStop[] {
    return schedule?.[day] ?? [];
  }

  const todayStops = stopsForDay(currentWeekday());

  return { schedule, loading, stopsForDay, todayStops };
}
