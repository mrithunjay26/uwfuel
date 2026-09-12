"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TOUR_STEPS } from "@/lib/tutorial/steps";

const DONE_KEY = "uwfuel.tour.done.v1";

interface TutorialValue {
  active: boolean;
  index: number;
  total: number;
  start: () => void;
  next: () => void;
  back: () => void;
  stop: (markDone?: boolean) => void;
}

const TutorialContext = createContext<TutorialValue | null>(null);

function isDone(): boolean {
  try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return false; }
}
function setDone() {
  try { localStorage.setItem(DONE_KEY, "1"); } catch {}
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isDone()) return;
    const t = setTimeout(() => { if (!isDone()) { setIndex(0); setActive(true); } }, 900);
    return () => clearTimeout(t);
  }, []);

  const start = useCallback(() => { setIndex(0); setActive(true); }, []);

  const stop = useCallback((markDone = true) => {
    setActive(false);
    if (markDone) setDone();
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        setActive(false);
        setDone();
        return i;
      }
      return i + 1;
    });
  }, []);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const value = useMemo<TutorialValue>(
    () => ({ active, index, total: TOUR_STEPS.length, start, next, back, stop }),
    [active, index, start, next, back, stop],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
