"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Check, ChevronDown, ChevronUp, History, Plus, Save, Search, Trash2, X } from "lucide-react";
import { clearActiveWorkoutPlan, deleteWorkoutPlan, setActiveWorkoutPlan, updateWorkoutPlan } from "@/lib/db/userDb";
import { useActiveWorkoutPlan } from "@/lib/hooks/useActiveWorkoutPlan";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useWorkoutPlans } from "@/lib/hooks/useWorkoutPlans";
import { useWorkoutLogs } from "@/lib/hooks/useWorkoutLogs";
import { todayPacificKey } from "@/lib/firebase/dining";
import { buildExerciseStats, searchExercises, relDaysLabel, type ExStat } from "@/lib/workout/exerciseSearch";
import type { WorkoutLogExercise, WorkoutPlan, WorkoutPlanDay, WorkoutPlanItem } from "@/lib/db/types";
import { WEEKDAYS, WEEKDAY_LABELS, cloneTemplateExercise } from "@/lib/workout/plans";

function normalizeDays(days: WorkoutPlanDay[]): WorkoutPlanDay[] {
  const byDay = new Map(days.map((day) => [day.weekday, day]));
  return WEEKDAYS.map((weekday) => {
    const day = byDay.get(weekday);
    return day ? { ...day, exercises: day.exercises.map(cloneTemplateExercise) } : {
      weekday, label: "Rest", is_rest: true, exercises: [],
    };
  });
}

function copyPlan(plan: WorkoutPlanItem): WorkoutPlanItem {
  return { ...plan, days: normalizeDays(plan.days) };
}

export function WorkoutPlanStudio({ focusPlanId, exerciseNames }: { focusPlanId: string | null; exerciseNames: string[] }) {
  const handle = useUserDb();
  const { plans, loading } = useWorkoutPlans();
  const active = useActiveWorkoutPlan();
  const { logs } = useWorkoutLogs();
  const stats = useMemo(() => buildExerciseStats(logs), [logs]);
  const today = todayPacificKey();
  const [draft, setDraft] = useState<WorkoutPlanItem | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!focusPlanId) return;
    const plan = plans.find((item) => item.id === focusPlanId);
    if (plan) queueMicrotask(() => {
      setDraft(copyPlan(plan));
      setExpanded(plan.days.find((day) => !day.is_rest)?.weekday ?? "monday");
    });
  }, [focusPlanId, plans]);

  const trainingDays = useMemo(() => draft?.days.filter((day) => !day.is_rest).length ?? 0, [draft]);

  function editDay(weekday: string, updater: (day: WorkoutPlanDay) => WorkoutPlanDay) {
    setDraft((current) => current ? {
      ...current,
      days: current.days.map((day) => day.weekday === weekday ? updater(day) : day),
    } : current);
  }

  function toggleRest(day: WorkoutPlanDay) {
    editDay(day.weekday, (current) => ({
      ...current,
      is_rest: !current.is_rest,
      label: current.is_rest ? "Workout" : "Rest",
      exercises: current.is_rest ? current.exercises : [],
    }));
    setExpanded(day.is_rest ? day.weekday : null);
  }

  function addExerciseNamed(day: WorkoutPlanDay, rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    editDay(day.weekday, (current) => ({
      ...current,
      is_rest: false,
      label: current.label === "Rest" ? "Workout" : current.label,
      // Preserve the exact prior exercise name so its logged history carries over.
      exercises: [...current.exercises, { name, sets: Array.from({ length: 3 }, () => ({ weight: 0, reps: 10 })) }],
    }));
  }

  function editExercise(day: WorkoutPlanDay, index: number, patch: Partial<WorkoutLogExercise>) {
    editDay(day.weekday, (current) => ({
      ...current,
      exercises: current.exercises.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise),
    }));
  }

  async function saveAndActivate() {
    if (!handle || !draft) return;
    const plan: WorkoutPlan = {
      title: draft.title.trim() || "My training plan",
      split: draft.split.trim() || "Custom split",
      source: draft.source,
      days: normalizeDays(draft.days),
      created_at: draft.created_at,
      updated_at: new Date().toISOString(),
    };
    try {
      await updateWorkoutPlan(handle.db, handle.uid, draft.id, plan);
      await setActiveWorkoutPlan(handle.db, handle.uid, draft.id, plan);
      setDraft({ ...draft, ...plan });
      setMessage("Schedule active — every date in the logger is now prefilled.");
    } catch {
      setMessage("Couldn’t save this schedule. Check your connection.");
    }
  }

  async function removeCurrent() {
    if (!handle || !draft) return;
    await deleteWorkoutPlan(handle.db, handle.uid, draft.id).catch(() => {});
    if (active?.plan_id === draft.id) await clearActiveWorkoutPlan(handle.db, handle.uid).catch(() => {});
    setDraft(null);
    setMessage("Generation removed from history.");
  }

  return (
    <section className="glass-panel mb-6 overflow-hidden rounded-[22px]">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="size-[18px] text-accent" />
          <h2 className="font-display text-[16px] font-extrabold text-ink">Training plan studio</h2>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">Load any generation, reshape the week, then make it your repeating schedule.</p>

        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {loading && <span className="rounded-full bg-surface-2 px-3 py-2 text-[11px] text-ink-soft">Loading history…</span>}
          {!loading && plans.length === 0 && <span className="rounded-full bg-surface-2 px-3 py-2 text-[11px] text-ink-soft">Your generated plans will appear here.</span>}
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => { setDraft(copyPlan(plan)); setExpanded(plan.days.find((day) => !day.is_rest)?.weekday ?? null); setMessage(null); }}
              className={`press min-w-[148px] rounded-[14px] border px-3 py-2 text-left ${draft?.id === plan.id ? "border-accent bg-accent-soft" : "border-line bg-surface-2"}`}
            >
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                {active?.plan_id === plan.id && <Check className="size-3 text-success" />} {plan.source} · {plan.days.filter((day) => !day.is_rest).length} days
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-bold text-ink">{plan.title}</span>
              <span className="block truncate text-[10px] text-ink-soft">{new Date(plan.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>

      {draft ? (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Plan name
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded-[11px] border border-line bg-surface-2 px-3 py-2 text-[13px] normal-case text-ink outline-none focus:border-accent" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Split
              <input value={draft.split} onChange={(event) => setDraft({ ...draft, split: event.target.value })} className="mt-1 w-full rounded-[11px] border border-line bg-surface-2 px-3 py-2 text-[13px] normal-case text-ink outline-none focus:border-accent" />
            </label>
          </div>
          <p className="mt-3 text-[11px] font-semibold text-ink-soft">{trainingDays} training days · repeats weekly without an end date</p>

          <div className="mt-3 flex flex-col gap-2">
            {draft.days.map((day) => {
              const isOpen = expanded === day.weekday;
              return (
                <div key={day.weekday} className={`rounded-[15px] border ${day.is_rest ? "border-line bg-surface-2/60" : "border-accent/20 bg-surface-2"}`}>
                  <div className="flex items-center gap-2 p-3">
                    <button onClick={() => setExpanded(isOpen ? null : day.weekday)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${day.is_rest ? "bg-surface-3 text-ink-faint" : "bg-accent-soft text-accent-ink"}`}>{WEEKDAY_LABELS[day.weekday].slice(0, 2)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-ink">{day.is_rest ? "Rest & recover" : day.label}</span>
                        <span className="text-[10px] text-ink-soft">{day.is_rest ? WEEKDAY_LABELS[day.weekday] : `${day.exercises.length} exercises · ${WEEKDAY_LABELS[day.weekday]}`}</span>
                      </span>
                      {isOpen ? <ChevronUp className="size-4 text-ink-faint" /> : <ChevronDown className="size-4 text-ink-faint" />}
                    </button>
                    <button onClick={() => toggleRest(day)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${day.is_rest ? "bg-accent text-accent-contrast" : "bg-surface-3 text-ink-soft"}`}>{day.is_rest ? "Train" : "Rest"}</button>
                  </div>

                  {isOpen && !day.is_rest && (
                    <div className="border-t border-line px-3 pb-3 pt-2.5">
                      <input value={day.label} onChange={(event) => editDay(day.weekday, (current) => ({ ...current, label: event.target.value }))} placeholder="Day focus" className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] font-bold text-ink outline-none focus:border-accent" />
                      <div className="mt-2 flex flex-col gap-1.5">
                        {day.exercises.map((exercise, index) => {
                          const count = Math.max(1, exercise.sets?.length || 3);
                          const reps = exercise.sets?.[0]?.reps || 10;
                          return (
                            <div key={`${exercise.name}-${index}`} className="flex items-center gap-1.5 rounded-[10px] bg-surface px-2 py-1.5">
                              <input value={exercise.name} onChange={(event) => editExercise(day, index, { name: event.target.value })} className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-ink outline-none" />
                              <input aria-label="Sets" type="number" min={1} max={10} value={count} onChange={(event) => editExercise(day, index, { sets: Array.from({ length: Math.max(1, Number(event.target.value) || 1) }, () => ({ weight: 0, reps })) })} className="w-9 rounded-md bg-surface-2 px-1 py-1 text-center text-[11px] font-bold text-ink outline-none" />
                              <span className="text-[10px] text-ink-faint">×</span>
                              <input aria-label="Reps" type="number" min={1} max={100} value={reps} onChange={(event) => editExercise(day, index, { sets: Array.from({ length: count }, () => ({ weight: 0, reps: Math.max(1, Number(event.target.value) || 1) })) })} className="w-10 rounded-md bg-surface-2 px-1 py-1 text-center text-[11px] font-bold text-ink outline-none" />
                              <button aria-label={`Remove ${exercise.name}`} onClick={() => editDay(day.weekday, (current) => ({ ...current, exercises: current.exercises.filter((_, i) => i !== index) }))} className="grid size-7 place-items-center text-ink-faint hover:text-danger"><X className="size-3.5" /></button>
                            </div>
                          );
                        })}
                      </div>
                      <PlanExercisePicker
                        directory={exerciseNames}
                        stats={stats}
                        today={today}
                        onAdd={(name) => addExerciseNamed(day, name)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={saveAndActivate} className="press flex flex-1 items-center justify-center gap-2 rounded-[13px] bg-accent py-3 text-[13px] font-bold text-accent-contrast"><CalendarCheck2 className="size-4" /> Save &amp; set schedule</button>
            <button onClick={removeCurrent} aria-label="Delete plan" className="press grid size-11 place-items-center rounded-[13px] bg-danger/10 text-danger"><Trash2 className="size-4" /></button>
          </div>
          {message && <p className="mt-2 text-center text-[11px] font-semibold text-success">{message}</p>}
        </div>
      ) : (
        <div className="px-5 py-6 text-center">
          <Save className="mx-auto size-6 text-ink-faint" />
          <p className="mt-2 text-[12px] font-semibold text-ink-soft">Generate a plan or load one from history to customize it.</p>
        </div>
      )}
    </section>
  );
}

// Log-tab-style exercise search: recents first (last done + count), fuzzy, plus
// a "add new" option. Adds the exact chosen name so history carries into the logger.
function PlanExercisePicker({
  directory, stats, today, onAdd,
}: {
  directory: string[];
  stats: Map<string, ExStat>;
  today: string;
  onAdd: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchExercises(directory, stats, query), [directory, stats, query]);
  const trimmed = query.trim();
  const exactExists = results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());

  function pick(name: string) {
    onAdd(name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="mt-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Enter" && trimmed) pick(trimmed); }}
          placeholder="Search or add an exercise…"
          className="w-full rounded-[10px] border border-dashed border-line-strong bg-surface py-2 pl-8 pr-3 text-[12px] text-ink outline-none focus:border-accent"
        />
      </div>
      {open && (
        <div className="thin-scrollbar mt-1.5 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-[10px] border border-line bg-surface p-1">
          {trimmed && !exactExists && (
            <button onClick={() => pick(trimmed)} className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left hover:bg-surface-2">
              <Plus className="size-3.5 shrink-0 text-accent" />
              <span className="truncate text-[12px] font-semibold text-ink">Add “{trimmed}”</span>
            </button>
          )}
          {results.map((r) => (
            <button key={r.name} onClick={() => pick(r.name)} className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-ink">{r.name}</span>
                {r.lastDate && (
                  <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                    <History className="size-2.5" /> {relDaysLabel(r.lastDate, today)} · {r.count}×
                  </span>
                )}
              </span>
              <Plus className="size-3.5 shrink-0 text-accent" />
            </button>
          ))}
          {results.length === 0 && !trimmed && (
            <p className="px-2.5 py-2 text-[11px] text-ink-faint">Start typing to find an exercise.</p>
          )}
        </div>
      )}
    </div>
  );
}
