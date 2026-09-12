"use client";

import { CalendarDays, Dumbbell, Scale, UtensilsCrossed, X } from "lucide-react";
import { useFoodLog } from "@/lib/hooks/useFoodLog";
import { useClassSchedule } from "@/lib/hooks/useClassSchedule";
import { formatMoney } from "@/lib/utils/nutrition";
import type { DailyStats } from "@/lib/hooks/useAllLogs";
import type { Weekday } from "@/lib/db/types";

const WEEKDAYS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function DayDetailPanel({
  dateKey,
  stats,
  weight,
  targetKcal,
  onClose,
}: {
  dateKey: string;
  stats?: DailyStats;
  weight?: number | null;
  targetKcal?: number;
  onClose: () => void;
}) {
  const { entries } = useFoodLog(dateKey);
  const { stopsForDay } = useClassSchedule();

  const [y, m, d] = dateKey.split("-").map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const weekday = WEEKDAYS[dateObj.getDay()];
  const classes = stopsForDay(weekday) ?? [];
  const label = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const cal = stats?.calories ?? entries.reduce((s, e) => s + e.calories, 0);
  const protein = stats?.protein ?? entries.reduce((s, e) => s + e.protein_grams, 0);
  const carbs = stats?.carbs ?? entries.reduce((s, e) => s + (e.carbs_grams ?? 0), 0);
  const fat = stats?.fat ?? entries.reduce((s, e) => s + (e.fat_grams ?? 0), 0);
  const cost = stats?.cost ?? entries.reduce((s, e) => s + e.price, 0);

  return (
    <div className="glass-panel rounded-[20px] border border-accent/25 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-accent" />
          <h3 className="font-display text-[15px] font-extrabold text-ink">{label}</h3>
        </div>
        <button onClick={onClose} aria-label="Close day details" className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-soft">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          { label: "kcal", value: Math.round(cal), tone: "text-flame" },
          { label: "protein", value: `${Math.round(protein)}g`, tone: "text-protein" },
          { label: "carbs", value: `${Math.round(carbs)}g`, tone: "text-carbs" },
          { label: "fat", value: `${Math.round(fat)}g`, tone: "text-fat" },
        ].map((s) => (
          <div key={s.label} className="rounded-[12px] bg-surface-2 py-2">
            <p className={`font-display text-[15px] font-extrabold ${s.tone}`}>{s.value}</p>
            <p className="text-[9px] font-bold uppercase text-ink-faint">{s.label}</p>
          </div>
        ))}
      </div>

      {targetKcal ? (
        <p className="mt-2 text-center text-[11px] text-ink-soft">
          {Math.round(cal)} of {targetKcal.toLocaleString("en-US")} kcal target · spent {formatMoney(cost)}
        </p>
      ) : (
        <p className="mt-2 text-center text-[11px] text-ink-soft">Spent {formatMoney(cost)}</p>
      )}

      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <UtensilsCrossed className="size-3.5" /> Meals logged
        </p>
        {entries.length === 0 ? (
          <p className="mt-1 text-[12px] text-ink-soft">Nothing logged this day.</p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                  {e.name}
                  {e.location_name ? <span className="font-normal text-ink-faint"> · {e.location_name}</span> : null}
                </span>
                <span className="shrink-0 text-[11px] text-ink-soft">{Math.round(e.calories)} cal</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {classes.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            <Dumbbell className="size-3.5" /> On your schedule ({weekday})
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <span key={c.id} className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-ink">
                {c.title || c.building_label} · {c.start_time}
              </span>
            ))}
          </div>
        </div>
      )}

      {weight != null && (
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-soft">
          <Scale className="size-3.5 text-protein" /> Weighed <b className="font-semibold text-ink">{weight} lbs</b> this day
        </div>
      )}
    </div>
  );
}
