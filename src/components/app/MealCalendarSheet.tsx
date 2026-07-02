"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useFoodLogDays } from "@/lib/hooks/useFoodLogDays";
import { Portal } from "@/components/ui/Portal";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function MealCalendarSheet({
  open, onClose, selected, today, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: string;
  today: string;
  onSelect: (dateKey: string) => void;
}) {
  const loggedDays = useFoodLogDays();
  const [view, setView] = useState(() => {
    const [y, m] = selected.split("-").map(Number);
    return { y, m: m - 1 };
  });

  if (!open) return null;

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <Portal>
    <div className="fixed inset-0 z-[75] flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-rise relative mt-auto rounded-t-[26px] border-t border-line bg-bg px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-extrabold text-ink">
            <CalendarDays className="size-[18px] text-accent" /> Jump to a day
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-ink-soft"><X className="size-5" /></button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="press grid size-9 place-items-center rounded-full text-ink-soft"><ChevronLeft className="size-5" /></button>
          <p className="font-display text-[15px] font-extrabold text-ink">{MONTHS[view.m]} {view.y}</p>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="press grid size-9 place-items-center rounded-full text-ink-soft"><ChevronRight className="size-5" /></button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1 text-[10px] font-bold uppercase text-ink-faint">{d}</span>
          ))}
          {cells.map((day, i) => {
            if (day == null) return <span key={i} />;
            const k = key(view.y, view.m, day);
            const isSel = k === selected;
            const isToday = k === today;
            const future = k > today;
            const has = loggedDays.has(k);
            return (
              <button
                key={i}
                disabled={future}
                onClick={() => { onSelect(k); onClose(); }}
                className={`relative mx-auto grid size-9 place-items-center rounded-full text-[13px] font-bold transition ${
                  isSel ? "bg-accent text-accent-contrast"
                    : future ? "text-ink-faint/40"
                    : isToday ? "bg-surface-2 text-accent-ink"
                    : "text-ink hover:bg-surface-2"
                }`}
              >
                {day}
                {has && !isSel && <span className="absolute bottom-1 size-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { onSelect(today); onClose(); }}
          className="press mt-4 w-full rounded-[14px] bg-surface-2 py-2.5 text-[13px] font-bold text-ink-soft"
        >
          Back to today
        </button>
      </div>
    </div>
    </Portal>
  );
}
