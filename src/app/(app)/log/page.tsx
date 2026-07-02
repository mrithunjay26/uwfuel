"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Dumbbell,
  History,
  Lightbulb,
  Minus,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Star,
  Target,
  Timer,
  Trash2,
  Trophy,
  TrendingUp,
  X,
} from "lucide-react";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useWorkoutLogs } from "@/lib/hooks/useWorkoutLogs";
import { useFirebaseExercises } from "@/lib/hooks/useFirebaseExercises";
import { useActiveWorkoutTemplate } from "@/lib/hooks/useActiveWorkoutTemplate";
import { useActiveWorkoutPlan } from "@/lib/hooks/useActiveWorkoutPlan";
import { useWorkoutScheduleOverrides } from "@/lib/hooks/useWorkoutScheduleOverrides";
import { useCustomize } from "@/lib/customize/CustomizeContext";
import { logWorkout, updateWorkoutLog, deleteWorkoutLog, clearActiveWorkoutTemplate, saveWorkoutScheduleOverride } from "@/lib/db/userDb";
import { todayPacificKey } from "@/lib/firebase/dining";
import { bodyPartFromName, resolveBodyPart, colorForBodyPart, BODY_PART_COLORS, BODY_PARTS } from "@/lib/workout/bodyParts";
import { loggerExercisesFromPlan, workoutDayForDate } from "@/lib/workout/plans";
import { haptic } from "@/lib/utils/haptics";
import type { ExerciseType, LoggedSet, WorkoutLogExercise, WorkoutLogItem, WorkoutPlanDay } from "@/lib/db/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const CHART_COLORS = ["#22c55e", "#d946ef", "#ef4444", "#3b82f6", "#f59e0b", "#8b7cf6", "#14b8a6", "#f472b6", "#a3a3a3"];

function dateKey(y: number, m0: number, d: number) { return `${y}-${pad(m0 + 1)}-${pad(d)}`; }
function shiftDate(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + delta);
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function monthGrid(y: number, m0: number): (number | null)[] {
  const start = new Date(y, m0, 1).getDay();
  const days = new Date(y, m0 + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: start }, () => null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}
function prettyDate(key: string, opts?: Intl.DateTimeFormatOptions) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts ?? { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
const exVolume = (ex: WorkoutLogExercise) => (ex.sets ?? []).reduce((s, st) => s + st.weight * st.reps, 0);
const logVolume = (l: WorkoutLogItem) => (l.exercises ?? []).reduce((s, ex) => s + exVolume(ex), 0);
function bigNum(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`; }
// Epley estimated one-rep max — lets us detect rep PRs (more reps at a given weight), not just heaviest lifts.
const e1rm = (w: number, r: number) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);

// Lightweight fuzzy matcher: exact substrings score highest, then subsequence
// matches with word-start & streak bonuses. Returns -1 when there's no match.
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  const at = t.indexOf(q);
  if (at !== -1) return 200 - at * 2; // substring: earlier = better
  let qi = 0, score = 0, streak = 0, prev = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak = prev === ti - 1 ? streak + 1 : 1;
      const wordStart = ti === 0 || t[ti - 1] === " ";
      score += streak + (wordStart ? 4 : 1);
      prev = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

function relDaysLabel(from: string, to: string): string {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (isNaN(a) || isNaN(b)) return "";
  const d = Math.round((b - a) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 31) return `${Math.round(d / 7)}w ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

type Tab = "today" | "calendar" | "records" | "charts";

export default function WorkoutLogPage() {
  const handle = useUserDb();
  const { logs, loading: logsLoading } = useWorkoutLogs();
  const { exercises: fbExercises } = useFirebaseExercises();
  const { template } = useActiveWorkoutTemplate();
  const activePlan = useActiveWorkoutPlan();
  const scheduleOverrides = useWorkoutScheduleOverrides();
  const today = todayPacificKey();

  const [tab, setTab] = useState<Tab>("today");
  const [selectedDate, setSelectedDate] = useState(today);
  const [focusExercise, setFocusExercise] = useState<string | null>(null);
  const [recordsExercise, setRecordsExercise] = useState<string | null>(null);
  const scheduledDay = useMemo(() => {
    const incoming = Object.values(scheduleOverrides).find((item) => item.action === "move" && item.moved_to === selectedDate && item.day);
    if (incoming?.day) return incoming.day;
    const exact = scheduleOverrides[selectedDate];
    if (exact?.action === "replace" && exact.day) return exact.day;
    if (exact?.action === "skip" || exact?.action === "move") return { weekday: workoutDayForDate(activePlan?.days ?? [], selectedDate)?.weekday ?? "monday", label: "Rest", is_rest: true, exercises: [] } as WorkoutPlanDay;
    return activePlan ? workoutDayForDate(activePlan.days, selectedDate) : null;
  }, [activePlan, selectedDate, scheduleOverrides]);

  const logsByDate = useMemo(() => {
    const map: Record<string, WorkoutLogItem[]> = {};
    logs.forEach((l) => { (map[l.date] ||= []).push(l); });
    return map;
  }, [logs]);

  const directory = useMemo(() => {
    const names = new Set<string>();
    fbExercises.forEach((e) => names.add(e.name));
    logs.forEach((l) => l.exercises.forEach((ex) => names.add(ex.name)));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [fbExercises, logs]);

  const muscleByName = useMemo(() => {
    const map: Record<string, string> = {};
    fbExercises.forEach((e) => {
      const n = norm(e.name);
      // Prefer the DB's specific muscle_group, then body_part, then infer from the name.
      if (n) map[n] = resolveBodyPart(e.name, [e.muscle_group, e.body_part]);
    });
    return map;
  }, [fbExercises]);

  return (
    <div className="min-h-screen">
      <div className="workout-log-header"><AuroraHeader
        title="Workout Log"
        subtitle={`${logs.length} workout${logs.length === 1 ? "" : "s"} tracked`}
        icon={<ClipboardList className="size-[18px]" />}
      >
        <div className="glass-soft mt-3 flex gap-1 rounded-[16px] p-1">
          {([["today", "Today", Dumbbell], ["calendar", "Calendar", Calendar], ["records", "Records", Trophy], ["charts", "Charts", BarChart3]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                if (id === "today") {
                  setSelectedDate(today);
                  setFocusExercise(null);
                }
                setTab(id);
              }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-[12px] py-2 text-[12px] font-bold transition ${
                tab === id ? "glass-strong text-ink shadow-[var(--shadow-sm)]" : "text-ink-soft"
              }`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </AuroraHeader></div>

      <div key={tab} className="workout-log-content tab-panel-anim px-5 pb-8 pt-4">
        {tab === "today" && (
          <TodayTab
            key={selectedDate}
            date={selectedDate}
            existing={logsByDate[selectedDate]?.[0]}
            allLogs={logs}
            loading={logsLoading}
            directory={directory}
            muscleByName={muscleByName}
            today={today}
            template={template}
            scheduledDay={scheduledDay}
            scheduleTitle={activePlan?.title ?? null}
            onMoveScheduled={async (day) => {
              if (!handle) return;
              await saveWorkoutScheduleOverride(handle.db, handle.uid, selectedDate, { action: "move", moved_to: shiftDate(selectedDate, 1), day });
              setSelectedDate(shiftDate(selectedDate, 1));
            }}
            focusExercise={focusExercise}
            onConsumeFocus={() => setFocusExercise(null)}
            onChangeDate={setSelectedDate}
            onViewRecords={(name) => { setRecordsExercise(name); setTab("records"); }}
          />
        )}
        {tab === "calendar" && (
          <CalendarTab
            logsByDate={logsByDate}
            logs={logs}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            onOpenDate={(d) => { setSelectedDate(d); setFocusExercise(null); setTab("today"); }}
            onOpenExercise={(d, name) => { setSelectedDate(d); setFocusExercise(name); setTab("today"); }}
            onDelete={async (id) => { if (handle) await deleteWorkoutLog(handle.db, handle.uid, id).catch(() => {}); }}
          />
        )}
        {tab === "records" && <RecordsTab logs={logs} directory={directory} focusName={recordsExercise} onConsumeFocus={() => setRecordsExercise(null)} />}
        {tab === "charts" && <ChartsTab logs={logs} muscleByName={muscleByName} today={today} />}
      </div>
    </div>
  );
}

function TodayTab({
  date, existing, allLogs, loading, directory, muscleByName, today, template, scheduledDay, scheduleTitle, onMoveScheduled, focusExercise, onConsumeFocus, onChangeDate, onViewRecords,
}: {
  date: string;
  existing?: WorkoutLogItem;
  allLogs: WorkoutLogItem[];
  loading: boolean;
  directory: string[];
  muscleByName: Record<string, string>;
  today: string;
  template: { title: string; exercises: WorkoutLogExercise[] } | null;
  scheduledDay: WorkoutPlanDay | null;
  scheduleTitle: string | null;
  onMoveScheduled: (day: WorkoutPlanDay) => void;
  onViewRecords: (name: string) => void;
  focusExercise: string | null;
  onConsumeFocus: () => void;
  onChangeDate: (d: string) => void;
}) {
  const handle = useUserDb();
  const { customize } = useCustomize();
  const scheduledSeed = scheduledDay && !scheduledDay.is_rest ? loggerExercisesFromPlan(scheduledDay) : [];
  const [logId, setLogId] = useState<string | null>(existing?.id ?? null);
  const [exercises, setExercises] = useState<WorkoutLogExercise[]>(existing ? clone(existing.exercises) : scheduledSeed);
  const [openEx, setOpenEx] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [customMuscle, setCustomMuscle] = useState<string | null>(null);
  const [customType, setCustomType] = useState<ExerciseType>("weighted");
  const entryRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusActive = customize.workoutCardMode === "focus" && customize.autoFocusMode && openEx !== null;

  useEffect(() => {
    const root = document.documentElement;
    if (focusActive) root.setAttribute("data-workout-focus", "on");
    else root.removeAttribute("data-workout-focus");
    return () => root.removeAttribute("data-workout-focus");
  }, [focusActive]);

  // The workout logs load asynchronously, so on the first open of a day `existing`
  // is often undefined and the tab seeds empty. Adopt the saved log once it
  // arrives — but only while there are no local edits, so we never clobber.
  useEffect(() => {
    if (existing) {
      setExercises(clone(existing.exercises));
      setLogId(existing.id);
      return;
    }
    if (logId === null && exercises.length === 0) {
      setExercises(scheduledDay && !scheduledDay.is_rest ? loggerExercisesFromPlan(scheduledDay) : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id, scheduledDay?.weekday, scheduledDay?.label]);

  // Best prior numbers for an exercise (everything logged before this day, this log excluded).
  function priorStats(name: string) {
    let maxWeight = 0, maxE1rm = 0, maxReps0 = 0;
    for (const l of allLogs) {
      if (l.id === logId || l.date >= date) continue;
      for (const ex of l.exercises) {
        if (norm(ex.name) !== norm(name)) continue;
        for (const s of ex.sets) {
          if (s.weight > maxWeight) maxWeight = s.weight;
          const e = e1rm(s.weight, s.reps);
          if (e > maxE1rm) maxE1rm = e;
          if (s.weight === 0 && s.reps > maxReps0) maxReps0 = s.reps;
        }
      }
    }
    return { maxWeight, maxE1rm, maxReps0 };
  }
  const priorMax = (name: string) => priorStats(name).maxWeight;
  const muscleFor = (name: string) => muscleByName[norm(name)] || bodyPartFromName(name);

  // A set is a PR only when it's a genuine max: heaviest weight ever, best estimated
  // 1RM ever (catches "more reps at the same weight"), or a bodyweight rep max.
  function withPRs(list: WorkoutLogExercise[]): WorkoutLogExercise[] {
    return list.map((ex) => {
      const stats = priorStats(ex.name);
      let { maxWeight, maxE1rm, maxReps0 } = stats;
      const muscle = ex.muscle || muscleFor(ex.name);
      const sets = (ex.sets ?? []).map((s) => {
        const w = s.weight, r = s.reps;
        const e = e1rm(w, r);
        let isPr = false;
        if (r > 0) {
          if (w > 0 && w > maxWeight + 1e-6) isPr = true;
          else if (w > 0 && e > maxE1rm + 1e-6) isPr = true;
          else if (w === 0 && r > maxReps0) isPr = true;
        }
        if (w > maxWeight) maxWeight = w;
        if (e > maxE1rm) maxE1rm = e;
        if (w === 0 && r > maxReps0) maxReps0 = r;
        const { is_pr: _was, ...rest } = s; // recompute PR, keep comment/distance/duration
        void _was;
        return { ...rest, weight: w, reps: r, ...(isPr ? { is_pr: true } : {}) };
      });
      return {
        name: ex.name,
        ...(ex.exercise_id ? { exercise_id: ex.exercise_id } : {}),
        ...(muscle ? { muscle } : {}),
        ...(ex.type ? { type: ex.type } : {}),
        ...(ex.tip ? { tip: ex.tip } : {}),
        sets,
      };
    });
  }

  // Opening an exercise straight from the calendar.
  useEffect(() => {
    if (!focusExercise) return;
    const idx = exercises.findIndex((e) => norm(e.name) === norm(focusExercise));
    if (idx >= 0) {
      setOpenEx(idx);
      requestAnimationFrame(() => entryRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
    onConsumeFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusExercise]);

  async function persist(next: WorkoutLogExercise[]) {
    const flagged = withPRs(next);
    setExercises(flagged);
    if (!handle) return;
    try {
      if (logId) {
        if (flagged.length === 0) { await deleteWorkoutLog(handle.db, handle.uid, logId); setLogId(null); }
        else await updateWorkoutLog(handle.db, handle.uid, logId, { exercises: flagged });
      } else if (flagged.length > 0) {
        const id = await logWorkout(handle.db, handle.uid, { date, title: scheduledDay?.label || "Workout", exercises: flagged, source: scheduledDay ? "library" : "manual" });
        setLogId(id);
      }
    } catch {}
  }

  function addExercise(name: string, muscle?: string, type?: ExerciseType) {
    const next = [
      ...exercises,
      { name, ...(muscle ? { muscle } : {}), ...(type && type !== "weighted" ? { type } : {}), sets: [] as LoggedSet[] },
    ];
    persist(next);
    setOpenEx(next.length - 1);
    setShowPicker(false);
    setPickerSearch("");
    setCustomMuscle(null);
    setCustomType("weighted");
  }

  // Most recent prior session's sets for an exercise (for the "Previous" reference).
  function prevSetsFor(name: string): LoggedSet[] {
    let best: { date: string; sets: LoggedSet[] } | null = null;
    for (const l of allLogs) {
      if (l.id === logId || l.date >= date) continue;
      const ex = l.exercises.find((e) => norm(e.name) === norm(name));
      if (ex?.sets?.length && (!best || l.date > best.date)) best = { date: l.date, sets: ex.sets };
    }
    return best?.sets ?? [];
  }
  function removeExercise(i: number) { persist(exercises.filter((_, idx) => idx !== i)); if (openEx === i) setOpenEx(null); }
  function setSets(i: number, sets: LoggedSet[]) {
    persist(exercises.map((ex, idx) => (idx === i ? { ...ex, sets } : ex)));
  }

  function loadTemplate() {
    if (!template) return;
    persist([...exercises, ...template.exercises.map((e) => ({ name: e.name, ...(e.tip ? { tip: e.tip } : {}), sets: [] as LoggedSet[] }))]);
  }

  function resetToSchedule() {
    if (!scheduledDay || scheduledDay.is_rest) return;
    setLogId(existing?.id ?? null);
    setExercises(loggerExercisesFromPlan(scheduledDay));
    setOpenEx(null);
  }

  // How often / how recently each exercise has been done (across all logs).
  const exerciseStats = useMemo(() => {
    const m = new Map<string, { name: string; count: number; lastDate: string }>();
    for (const l of allLogs) {
      for (const ex of l.exercises) {
        if (!ex.sets?.length) continue;
        const k = norm(ex.name);
        const cur = m.get(k);
        if (!cur) m.set(k, { name: ex.name, count: 1, lastDate: l.date });
        else { cur.count += 1; if (l.date > cur.lastDate) cur.lastDate = l.date; }
      }
    }
    return m;
  }, [allLogs]);

  // Search matrix: previously-done exercises rank first (with recency + count),
  // fuzzy-matched so half-remembered names still surface.
  const pickerResults = useMemo(() => {
    const names = new Map<string, string>();
    directory.forEach((n) => names.set(norm(n), n));
    exerciseStats.forEach((s, k) => { if (!names.has(k)) names.set(k, s.name); });
    const list = [...names.entries()].map(([k, name]) => {
      const st = exerciseStats.get(k);
      return { name, count: st?.count ?? 0, lastDate: st?.lastDate ?? null };
    });
    const q = pickerSearch.trim();
    if (!q) {
      return list
        .sort((a, b) => {
          if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate);
          if (a.lastDate) return -1;
          if (b.lastDate) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 60);
    }
    return list
      .map((e) => ({ e, raw: fuzzyScore(q, e.name) }))
      .filter((x) => x.raw >= 0)
      .sort((a, b) => (b.raw + (b.e.lastDate ? 60 : 0)) - (a.raw + (a.e.lastDate ? 60 : 0)))
      .slice(0, 40)
      .map((x) => x.e);
  }, [directory, exerciseStats, pickerSearch]);

  const isNewName = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return q.length > 0 && !directory.some((n) => n.toLowerCase() === q);
  }, [pickerSearch, directory]);

  const totalVolume = exercises.reduce((s, ex) => s + exVolume(ex), 0);

  return (
    <div className="flex flex-col gap-4">
      {focusActive && <button onClick={() => setOpenEx(null)} className="press sticky top-2 z-20 mx-auto flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-bold text-accent-contrast shadow-[var(--shadow-fab)]"><X className="size-3.5" /> Exit focus</button>}

      <div className="workout-date-switcher glass-panel flex items-center justify-between rounded-[16px] px-2 py-2">
        <button onClick={() => onChangeDate(shiftDate(date, -1))} className="press grid size-9 place-items-center rounded-full text-ink-soft"><ChevronLeft className="size-5" /></button>
        <div className="text-center">
          <p className="font-display text-[15px] font-extrabold text-ink">{date === today ? "Today" : prettyDate(date, { weekday: "short", month: "short", day: "numeric" })}</p>
          {totalVolume > 0 && <p className="text-[11px] text-ink-soft">{totalVolume.toLocaleString()} lb volume</p>}
        </div>
        <button onClick={() => onChangeDate(shiftDate(date, 1))} className="press grid size-9 place-items-center rounded-full text-ink-soft"><ChevronRight className="size-5" /></button>
      </div>

      {scheduledDay && (
        <div className={`workout-supporting-card flex items-center gap-3 rounded-[16px] border px-4 py-3 ${scheduledDay.is_rest ? "border-line bg-surface-2/70" : "border-accent/25 bg-accent-soft/50"}`}>
          <Calendar className={`size-4 shrink-0 ${scheduledDay.is_rest ? "text-ink-faint" : "text-accent"}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink">{scheduledDay.is_rest ? "Rest & recover" : scheduledDay.label}</p>
            <p className="truncate text-[11px] text-ink-soft">{scheduleTitle} · {scheduledDay.is_rest ? "No workout scheduled" : `${scheduledDay.exercises.length} exercises prefilled`}</p>
          </div>
          {!scheduledDay.is_rest && <span className="flex shrink-0 gap-1"><button onClick={() => onMoveScheduled(scheduledDay)} className="press rounded-full bg-surface px-2.5 py-1.5 text-[10px] font-bold text-ink-soft">Tomorrow</button><button onClick={resetToSchedule} className="press rounded-full bg-accent px-2.5 py-1.5 text-[10px] font-bold text-accent-contrast">Reset</button></span>}
        </div>
      )}

      {template && (
        <div className="workout-supporting-card flex items-center gap-3 rounded-[16px] border border-accent/25 bg-accent-soft/50 px-4 py-3">
          <Sparkles className="size-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink">{template.title}</p>
            <p className="text-[11px] text-ink-soft">{template.exercises.length} exercises from AI</p>
          </div>
          <button onClick={loadTemplate} className="press shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-contrast">Load</button>
          <button onClick={() => handle && clearActiveWorkoutTemplate(handle.db, handle.uid)} className="shrink-0 text-ink-faint"><X className="size-4" /></button>
        </div>
      )}

      {exercises.map((ex, i) => (focusActive && openEx !== i ? null : (
        <div key={i} ref={(el) => { entryRefs.current[i] = el; }}>
          <ExerciseEntry
            exercise={ex}
            priorMax={priorMax(ex.name)}
            prevSets={prevSetsFor(ex.name)}
            open={openEx === i}
            onToggle={() => { if (openEx !== i) haptic("medium"); setOpenEx(openEx === i ? null : i); }}
            onRemove={() => removeExercise(i)}
            onSets={(sets) => setSets(i, sets)}
            onViewRecords={() => onViewRecords(ex.name)}
            dense={customize.workoutCardMode === "notebook"}
            restAlerts={customize.restAlerts}
          />
        </div>
      )))}

      {showPicker ? (
        <section className="glass-panel rounded-[18px] p-3.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Search or name a new exercise…"
              className="w-full rounded-[10px] border border-line bg-surface-2 py-2 pl-8 pr-3 text-[13px] text-ink outline-none focus:border-accent" />
          </div>
          {!pickerSearch.trim() && pickerResults.some((r) => r.lastDate) && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
              <History className="size-3" /> Recent &amp; frequent
            </p>
          )}
          <div className="thin-scrollbar mt-1.5 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {pickerResults.map((r) => (
              <button
                key={r.name}
                onClick={() => addExercise(r.name, muscleByName[norm(r.name)])}
                className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{r.name}</span>
                  {r.lastDate ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-ink-faint">
                      <History className="size-2.5" /> {relDaysLabel(r.lastDate, today)} · {r.count}×
                    </span>
                  ) : (
                    muscleByName[norm(r.name)] && <span className="text-[10px] text-ink-faint">{muscleByName[norm(r.name)]}</span>
                  )}
                </span>
                <Plus className="size-3.5 shrink-0 text-accent" />
              </button>
            ))}
          </div>

          {isNewName && (
            <div className="mt-2 rounded-[12px] border border-accent/30 bg-accent-soft/40 p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                <Plus className="size-3.5 text-accent" /> New exercise: “{pickerSearch.trim()}”
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                <Activity className="size-3" /> Type
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {([["weighted", "Weight & reps"], ["bodyweight", "Bodyweight"], ["cardio", "Cardio"]] as [ExerciseType, string][]).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setCustomType(t)}
                    className={`flex-1 rounded-full px-2 py-1 text-[11px] font-bold transition ${
                      customType === t ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                <Target className="size-3" /> Target muscle
              </p>
              <div className="no-scrollbar -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {BODY_PARTS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setCustomMuscle(customMuscle === m ? null : m)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      customMuscle === m ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                onClick={() => addExercise(pickerSearch.trim(), customMuscle ?? undefined, customType)}
                className="press mt-2.5 w-full rounded-[10px] bg-accent py-2 text-[13px] font-bold text-accent-contrast"
              >
                Add {customMuscle ? `as ${customMuscle}` : "exercise"}
              </button>
            </div>
          )}

          <button onClick={() => { setShowPicker(false); setCustomMuscle(null); }} className="mt-2 w-full text-[12px] font-semibold text-ink-soft">Close</button>
        </section>
      ) : (
        <button onClick={() => setShowPicker(true)} className="press flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-accent/40 py-4 text-[14px] font-bold text-accent-ink">
          <Plus className="size-4" /> Add exercise
        </button>
      )}

      {exercises.length === 0 && !showPicker && (
        <div className="glass-panel rounded-[18px] px-6 py-8 text-center">
          <span className="text-3xl">🏋️</span>
          <p className="mt-2 text-[13px] font-semibold text-ink">
            {loading ? `Loading ${date === today ? "today's" : "this day's"} workout...` : `Nothing logged for ${date === today ? "today" : "this day"}`}
          </p>
          <p className="text-[12px] text-ink-soft">
            {loading ? "Checking your saved workout log." : "Add an exercise to start tracking sets."}
          </p>
        </div>
      )}
    </div>
  );
}

const REST_DEFAULT = 90;
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtSet(s: LoggedSet, type: ExerciseType): string {
  if (type === "cardio") {
    const parts: string[] = [];
    if (s.distance) parts.push(`${s.distance} mi`);
    if (s.duration_sec) parts.push(fmtDuration(s.duration_sec));
    return parts.join(" · ") || "—";
  }
  if (type === "bodyweight" || s.weight === 0) return `${s.reps} reps`;
  return `${s.weight} × ${s.reps}`;
}

function ExerciseEntry({
  exercise, priorMax, prevSets, open, onToggle, onRemove, onSets, onViewRecords, dense, restAlerts,
}: {
  exercise: WorkoutLogExercise;
  priorMax: number;
  prevSets: LoggedSet[];
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onSets: (sets: LoggedSet[]) => void;
  onViewRecords: () => void;
  dense: boolean;
  restAlerts: boolean;
}) {
  const type: ExerciseType = exercise.type ?? "weighted";
  const seed = (exercise.sets ?? [])[(exercise.sets ?? []).length - 1] ?? prevSets[prevSets.length - 1];
  const [weight, setWeight] = useState(() => seed?.weight ?? 0);
  const [reps, setReps] = useState(() => seed?.reps ?? 0);
  const [distance, setDistance] = useState(() => seed?.distance ?? 0);
  const [durationMin, setDurationMin] = useState(() => (seed?.duration_sec ?? 0) / 60);
  const [comment, setComment] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [rest, setRest] = useState<number | null>(null);
  const expanded = dense || open;

  // Rest countdown between sets.
  useEffect(() => {
    if (rest == null) return;
    const id = window.setTimeout(() => setRest((current) => {
      if (current == null) return null;
      if (current <= 1) { if (restAlerts) haptic("heavy"); return null; }
      return current - 1;
    }), 1000);
    return () => window.clearTimeout(id);
  }, [rest, restAlerts]);

  function buildSet(): LoggedSet | null {
    const c = comment.trim();
    const note = c ? { comment: c } : {};
    if (type === "cardio") {
      const dur = Math.round(durationMin * 60);
      if (distance <= 0 && dur <= 0) return null;
      return { weight: 0, reps: 0, ...(distance > 0 ? { distance } : {}), ...(dur > 0 ? { duration_sec: dur } : {}), ...note };
    }
    if (type === "bodyweight") {
      if (reps <= 0) return null;
      return { weight: 0, reps, ...note };
    }
    if (weight <= 0 && reps <= 0) return null;
    return { weight, reps, ...note };
  }

  function commit() {
    const set = buildSet();
    if (!set) return;
    if (editIdx != null) {
      onSets(exercise.sets.map((s, i) => (i === editIdx ? set : s)));
      setEditIdx(null);
    } else {
      onSets([...exercise.sets, set]);
      setRest(REST_DEFAULT); // FitNotes-style rest timer after each new set
      haptic("medium");
    }
    setComment("");
  }
  function clearForm() { setEditIdx(null); setComment(""); }
  function fillFrom(s: LoggedSet) {
    setWeight(s.weight); setReps(s.reps);
    setDistance(s.distance ?? 0); setDurationMin((s.duration_sec ?? 0) / 60);
  }
  function editSet(i: number) { fillFrom(exercise.sets[i]); setComment(exercise.sets[i].comment ?? ""); setEditIdx(i); }
  function delSet(i: number) { onSets(exercise.sets.filter((_, idx) => idx !== i)); if (editIdx === i) setEditIdx(null); }

  const hasPR = exercise.sets.some((s) => s.is_pr);
  const setCount = exercise.sets.length;
  const summary = `${setCount} set${setCount === 1 ? "" : "s"}${setCount && type !== "cardio" ? ` · ${exVolume(exercise).toLocaleString()} lb` : ""}`;

  return (
    <section className="glass-panel overflow-hidden rounded-[18px]">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Dumbbell className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
            <span className="truncate">{exercise.name}</span>
            {exercise.muscle && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-ink">{exercise.muscle}</span>}
            {type !== "weighted" && <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-soft">{type === "cardio" ? "Cardio" : "BW"}</span>}
            {hasPR && <Trophy className="size-3.5 shrink-0 text-warning" />}
          </span>
          <span className="text-[11px] text-ink-soft">{summary}</span>
        </span>
        {!dense && (open ? <ChevronUp className="size-4 text-ink-faint" /> : <ChevronDown className="size-4 text-ink-faint" />)}
      </button>

      {!expanded && setCount > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {exercise.sets.map((s, i) => (
            <span key={i} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.is_pr ? "bg-warning/15 text-warning" : "bg-surface-2 text-ink-soft"}`}>
              {fmtSet(s, type)}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {exercise.tip && (
            <div className="mb-2.5">
              <button onClick={() => setShowTip((s) => !s)} className="flex w-full items-center justify-between rounded-[10px] bg-accent-soft/50 px-3 py-1.5 text-left">
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-accent-ink"><Lightbulb className="size-3.5" /> Form tip</span>
                {showTip ? <ChevronUp className="size-3.5 text-accent-ink" /> : <ChevronDown className="size-3.5 text-accent-ink" />}
              </button>
              {showTip && <p className="mt-1.5 px-1 text-[12px] leading-relaxed text-ink-soft">{exercise.tip}</p>}
            </div>
          )}

          {prevSets.length > 0 && (
            <div className="mb-2.5 rounded-[10px] bg-surface-2 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft"><History className="size-3.5" /> Previous</span>
                <button onClick={() => fillFrom(prevSets[prevSets.length - 1])} className="flex items-center gap-1 text-[11px] font-bold text-accent-ink"><Repeat className="size-3" /> Repeat</button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {prevSets.map((s, i) => (
                  <button key={i} onClick={() => fillFrom(s)} className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft active:bg-surface-3">{fmtSet(s, type)}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mb-2 flex items-center justify-between">
            {priorMax > 0 && type !== "cardio"
              ? <p className="text-[11px] text-ink-faint">Best so far: {priorMax} lb</p>
              : <span />}
            <button onClick={onViewRecords} className="press flex items-center gap-1 text-[11px] font-bold text-accent-ink">
              <Trophy className="size-3" /> View records
            </button>
          </div>

          {type === "cardio" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Stepper label="Distance (mi)" value={distance} step={0.1} min={0} onChange={setDistance} />
              <Stepper label="Time (min)" value={durationMin} step={1} min={0} onChange={setDurationMin} />
            </div>
          ) : type === "bodyweight" ? (
            <Stepper label="Reps" value={reps} step={1} min={0} onChange={setReps} />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Stepper label="Weight (lb)" value={weight} step={2.5} min={0} onChange={setWeight} />
              <Stepper label="Reps" value={reps} step={1} min={0} onChange={setReps} />
            </div>
          )}

          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={120}
            placeholder="Add a note (rest, spotter, machine setting…)"
            className="mt-2.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] text-ink outline-none focus:border-accent"
          />

          <div className="mt-3 flex gap-2">
            <button onClick={commit} className="press flex-1 rounded-[12px] bg-accent py-2.5 text-[13px] font-bold text-accent-contrast">{editIdx != null ? "Update set" : "Add set"}</button>
            {editIdx != null && <button onClick={clearForm} className="press rounded-[12px] bg-surface-3 px-4 py-2.5 text-[13px] font-bold text-ink-soft">Cancel</button>}
            <button onClick={onRemove} className="press grid size-[42px] shrink-0 place-items-center rounded-[12px] bg-danger/10 text-danger"><Trash2 className="size-4" /></button>
          </div>

          {rest != null && (
            <div className="mt-3 flex items-center justify-between rounded-[10px] bg-accent-soft px-3 py-2">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-accent-ink"><Timer className="size-3.5" /> Rest {fmtDuration(rest)}</span>
              <span className="flex items-center gap-3">
                <button onClick={() => setRest((r) => (r ?? 0) + 30)} className="text-[11px] font-bold text-accent-ink">+30s</button>
                <button onClick={() => setRest(null)} className="text-[11px] font-bold text-ink-soft">Stop</button>
              </span>
            </div>
          )}

          {setCount > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {exercise.sets.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-[10px] px-3 py-2 ${editIdx === i ? "bg-accent-soft" : "bg-surface-2"}`}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-ink-soft">{i + 1}</span>
                  {s.is_pr && <Star className="size-4 shrink-0 fill-warning text-warning" />}
                  <button onClick={() => editSet(i)} className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="text-[14px] font-bold text-ink">{fmtSet(s, type)}</span>
                    {s.comment && <span className="truncate text-[10px] text-ink-faint">{s.comment}</span>}
                  </button>
                  <button onClick={() => delSet(i)} className="grid size-6 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"><X className="size-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stepper({ label, value, step, min, onChange }: { label: string; value: number; step: number; min: number; onChange: (v: number) => void }) {
  // Local text state so the field can be cleared / typed freely (incl. 0 and
  // trailing decimals) without being snapped back to a forced value.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseFloat(text) !== value) setText(value === 0 ? "0" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-ink-soft">{label}</span>
      <div className="flex min-w-0 items-stretch overflow-hidden rounded-[10px] border border-line bg-surface">
        <button
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          aria-label={`Decrease ${label}`}
          className="press grid w-8 shrink-0 place-items-center bg-surface-2 text-ink-soft"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            const t = e.target.value;
            if (!/^\d*\.?\d*$/.test(t)) return;
            setText(t);
            const n = parseFloat(t);
            if (!Number.isNaN(n)) onChange(Math.max(min, n));
          }}
          onBlur={() => {
            if (text.trim() === "" || Number.isNaN(parseFloat(text))) { onChange(min); setText(String(min)); }
          }}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 flex-1 border-x border-line bg-surface px-1 py-2 text-center text-[15px] font-bold text-ink outline-none focus:bg-accent-soft/40"
        />
        <button
          onClick={() => onChange(Math.round((value + step) * 10) / 10)}
          aria-label={`Increase ${label}`}
          className="press grid w-8 shrink-0 place-items-center bg-surface-2 text-ink-soft"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </label>
  );
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-[12px] bg-surface-2 px-2 py-2.5 text-center">
      <span className="mx-auto mb-1 grid size-6 place-items-center rounded-full bg-surface-3 text-accent">{icon}</span>
      <p className="font-display text-[16px] font-extrabold leading-none text-ink">{value}<span className="text-[9px] font-bold text-ink-faint">{unit ? ` ${unit}` : ""}</span></p>
      <p className="mt-1 text-[10px] font-semibold text-ink-soft">{label}</p>
    </div>
  );
}

function CalendarTab({
  logsByDate, logs, today, selectedDate, onSelectDate, onOpenDate, onOpenExercise, onDelete,
}: {
  logsByDate: Record<string, WorkoutLogItem[]>;
  logs: WorkoutLogItem[];
  today: string;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  onOpenDate: (d: string) => void;
  onOpenExercise: (d: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [view, setView] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
  const cells = monthGrid(view.year, view.month);
  const monthPrefix = `${view.year}-${pad(view.month + 1)}`;
  const monthLogs = logs.filter((l) => l.date.startsWith(monthPrefix));
  const monthVolume = monthLogs.reduce((s, l) => s + logVolume(l), 0);
  const monthPRs = monthLogs.reduce((s, l) => s + l.exercises.reduce((a, ex) => a + ex.sets.filter((st) => st.is_pr).length, 0), 0);
  const dayLogs = logsByDate[selectedDate] ?? [];

  function shift(d: number) {
    setView((v) => { const m = v.month + d; if (m < 0) return { year: v.year - 1, month: 11 }; if (m > 11) return { year: v.year + 1, month: 0 }; return { ...v, month: m }; });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[{ l: "Workouts", v: `${monthLogs.length}` }, { l: "Volume", v: bigNum(monthVolume), u: "lb" }, { l: "PRs", v: `${monthPRs}` }].map((s) => (
          <div key={s.l} className="glass-panel rounded-[16px] px-2 py-3 text-center">
            <p className="font-display text-[20px] font-extrabold text-ink">{s.v}<span className="text-[10px] text-ink-faint">{s.u ?? ""}</span></p>
            <p className="text-[10px] font-semibold text-ink-soft">{s.l}</p>
          </div>
        ))}
      </div>

      <section className="glass-panel rounded-[22px] p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-soft"><ChevronLeft className="size-4" /></button>
          <p className="font-display text-[15px] font-bold text-ink">{MONTHS[view.month]} {view.year}</p>
          <button onClick={() => shift(1)} className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-soft"><ChevronRight className="size-4" /></button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LETTERS.map((d, i) => <span key={i} className="text-[10px] font-bold text-ink-faint">{d}</span>)}
          {cells.map((day, i) => {
            if (day === null) return <span key={`b${i}`} />;
            const key = dateKey(view.year, view.month, day);
            const has = (logsByDate[key]?.length ?? 0) > 0;
            const isToday = key === today;
            const isSel = key === selectedDate;
            return (
              <button key={key} onClick={() => onSelectDate(key)}
                className={`relative mx-auto grid size-9 place-items-center rounded-full text-[13px] font-semibold transition ${
                  isSel ? "bg-accent text-accent-contrast" : has ? "bg-accent-soft text-accent-ink" : isToday ? "ring-1 ring-accent/40 text-ink" : "text-ink-soft"
                }`}>
                {day}
                {has && !isSel && <span className="absolute bottom-1 size-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-extrabold text-ink">{selectedDate === today ? "Today" : prettyDate(selectedDate, { weekday: "short", month: "short", day: "numeric" })}</h2>
            {dayLogs.length > 0 && <p className="text-[11px] text-ink-soft">Tap an exercise to open it in the logger</p>}
          </div>
          <button onClick={() => onOpenDate(selectedDate)} className="press flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-contrast">
            {dayLogs.length ? <><ChevronRight className="size-3.5" /> Open day</> : <><Plus className="size-3.5" /> Log</>}
          </button>
        </div>
        {dayLogs.length === 0 ? (
          <button onClick={() => onOpenDate(selectedDate)} className="press glass-panel w-full rounded-[18px] px-6 py-8 text-center">
            <span className="text-3xl">🗓️</span>
            <p className="mt-2 text-[13px] font-semibold text-ink">No workout logged</p>
            <p className="text-[11px] text-ink-soft">Tap to start one for this day</p>
          </button>
        ) : dayLogs.map((log) => (
          <div key={log.id} className="glass-panel mb-2.5 rounded-[18px] p-4">
            <div className="flex items-start justify-between">
              <div><p className="font-display text-[15px] font-extrabold text-ink">{log.title}</p><p className="text-[11px] text-ink-soft">{logVolume(log).toLocaleString()} lb · {log.exercises.length} exercises</p></div>
              <button onClick={() => onDelete(log.id)} className="grid size-7 place-items-center rounded-full text-ink-faint hover:text-danger"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {log.exercises.map((ex, xi) => (
                <button
                  key={xi}
                  onClick={() => onOpenExercise(selectedDate, ex.name)}
                  className="press flex w-full items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2 text-left active:bg-surface-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                      <span className="truncate">{ex.name}</span>
                      {ex.muscle && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent-ink">{ex.muscle}</span>}
                      {ex.sets.some((s) => s.is_pr) && <Trophy className="size-3.5 shrink-0 text-warning" />}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {ex.sets.map((s, si) => <span key={si} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.is_pr ? "bg-warning/15 text-warning" : "bg-surface-3 text-ink-soft"}`}>{s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps} reps`}</span>)}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-faint" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function RecordsTab({ logs, directory, focusName, onConsumeFocus }: {
  logs: WorkoutLogItem[];
  directory: string[];
  focusName?: string | null;
  onConsumeFocus?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Open a specific exercise's records when navigated from the logger.
  useEffect(() => {
    if (focusName) { setSelected(focusName); onConsumeFocus?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusName]);

  const loggedNames = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.exercises.forEach((ex) => { if (ex.sets.length) set.add(ex.name); }));
    return Array.from(set).sort();
  }, [logs]);

  const byDate = useMemo(() => {
    if (!selected) return [];
    const map: Record<string, LoggedSet[]> = {};
    logs.forEach((l) => { const ex = l.exercises.find((e) => norm(e.name) === norm(selected)); if (ex?.sets.length) (map[l.date] ||= []).push(...ex.sets); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs, selected]);

  const repMaxes = useMemo(() => {
    const all: { weight: number; reps: number; date: string }[] = [];
    byDate.forEach(([d, sets]) => sets.forEach((s) => { if (s.weight > 0) all.push({ weight: s.weight, reps: s.reps, date: d }); }));
    const maxReps = all.reduce((m, s) => Math.max(m, s.reps), 0);
    const out: { rm: number; weight: number; reps: number; date: string }[] = [];
    for (let n = 1; n <= Math.min(maxReps, 15); n++) {
      let best: { weight: number; reps: number; date: string } | null = null;
      for (const s of all) {
        if (s.reps >= n && (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps))) best = s;
      }
      if (best) out.push({ rm: n, ...best });
    }
    return out.reverse();
  }, [byDate]);

  const chartData = useMemo(() => byDate.map(([, sets]) => Math.max(...sets.map((s) => s.weight), 0)).reverse(), [byDate]);

  // e1RM per session (oldest → newest) for the trend line.
  const e1rmSeries = useMemo(
    () => byDate.map(([, sets]) => Math.max(...sets.map((s) => e1rm(s.weight, s.reps)), 0)).reverse(),
    [byDate],
  );

  const diagnostics = useMemo(() => {
    const flat: LoggedSet[] = byDate.flatMap(([, sets]) => sets);
    if (flat.length === 0) return null;
    const sessions = byDate.length;
    const totalSets = flat.length;
    const totalReps = flat.reduce((s, x) => s + x.reps, 0);
    const totalVolume = flat.reduce((s, x) => s + x.weight * x.reps, 0);
    const bestWeight = Math.max(...flat.map((s) => s.weight), 0);
    const bestE1rm = Math.max(...flat.map((s) => e1rm(s.weight, s.reps)), 0);
    const weighted = flat.filter((s) => s.weight > 0);
    const avgWeight = weighted.length ? weighted.reduce((s, x) => s + x.weight, 0) / weighted.length : 0;
    const prCount = flat.filter((s) => s.is_pr).length;
    // trend: newest e1RM vs first recorded e1RM
    const valid = e1rmSeries.filter((v) => v > 0);
    let trendPct: number | null = null;
    if (valid.length >= 2 && valid[0] > 0) trendPct = ((valid[valid.length - 1] - valid[0]) / valid[0]) * 100;
    return { sessions, totalSets, totalReps, totalVolume, bestWeight, bestE1rm, avgWeight, prCount, trendPct };
  }, [byDate, e1rmSeries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? directory.filter((n) => n.toLowerCase().includes(q)) : loggedNames).slice(0, 50);
  }, [search, directory, loggedNames]);

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink"><ChevronLeft className="size-4" /> All exercises</button>
        <h2 className="font-display text-[20px] font-extrabold text-ink">{selected}</h2>

        {byDate.length === 0 ? (
          <p className="text-[13px] text-ink-soft">No sets logged for this exercise yet.</p>
        ) : (
          <>
            {diagnostics && (
              <section className="glass-panel rounded-[20px] p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[14px] font-extrabold text-ink"><Activity className="size-4 text-accent" /> Diagnostics</p>
                <div className="grid grid-cols-3 gap-2.5">
                  <Stat icon={<Dumbbell className="size-3.5" />} label="Best weight" value={`${diagnostics.bestWeight.toFixed(diagnostics.bestWeight % 1 ? 1 : 0)}`} unit="lb" />
                  <Stat icon={<TrendingUp className="size-3.5" />} label="Est. 1RM" value={`${Math.round(diagnostics.bestE1rm)}`} unit="lb" />
                  <Stat icon={<Trophy className="size-3.5" />} label="PRs" value={`${diagnostics.prCount}`} />
                  <Stat icon={<BarChart3 className="size-3.5" />} label="Volume" value={bigNum(diagnostics.totalVolume)} unit="lb" />
                  <Stat icon={<Repeat className="size-3.5" />} label="Total reps" value={`${diagnostics.totalReps}`} />
                  <Stat icon={<Calendar className="size-3.5" />} label="Sessions" value={`${diagnostics.sessions}`} />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2.5">
                  <span className="text-[12px] font-semibold text-ink-soft">Strength trend (est. 1RM)</span>
                  {diagnostics.trendPct == null ? (
                    <span className="text-[12px] text-ink-faint">Need more data</span>
                  ) : (
                    <span className={`text-[13px] font-bold ${diagnostics.trendPct >= 0 ? "text-success" : "text-danger"}`}>
                      {diagnostics.trendPct >= 0 ? "▲" : "▼"} {Math.abs(diagnostics.trendPct).toFixed(1)}%
                    </span>
                  )}
                </div>
              </section>
            )}

            {chartData.length >= 2 && (
              <section className="glass-panel rounded-[20px] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink"><TrendingUp className="size-4 text-accent" /> Top weight over time</p>
                <MiniChart data={chartData} />
                {e1rmSeries.some((v) => v > 0) && (
                  <>
                    <p className="mb-2 mt-4 flex items-center gap-1.5 text-[13px] font-bold text-ink"><Activity className="size-4 text-accent" /> Estimated 1RM over time</p>
                    <MiniChart data={e1rmSeries} />
                  </>
                )}
              </section>
            )}

            <section className="glass-panel rounded-[20px] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[14px] font-extrabold text-ink"><Trophy className="size-4 text-warning" /> Records · All time</p>
              <div className="flex flex-col">
                {repMaxes.map((r) => (
                  <div key={r.rm} className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0">
                    <span className="font-display text-[18px] font-extrabold text-ink">{r.rm}<span className="text-[11px] font-bold text-ink-faint"> RM</span></span>
                    <div className="text-right">
                      <p className="text-[15px] font-bold text-ink">{r.weight.toFixed(1)}<span className="text-[11px] text-ink-faint"> lb × </span>{r.reps}</p>
                      <p className="text-[11px] text-ink-faint">{prettyDate(r.date, { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-2 font-display text-[14px] font-extrabold text-ink">History</p>
              <div className="flex flex-col gap-2.5">
                {byDate.map(([d, sets]) => {
                  const best = Math.max(...sets.map((s) => s.weight), 0);
                  return (
                    <div key={d} className="glass-panel rounded-[16px] p-3.5">
                      <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-soft">{prettyDate(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                      <div className="flex flex-col gap-1">
                        {sets.map((s, i) => (
                          <div key={i} className="flex items-center justify-between rounded-[8px] bg-surface-2 px-3 py-1.5">
                            <span className="flex items-center gap-2">{(s.is_pr || s.weight === best) && <Star className="size-3.5 fill-warning text-warning" />}<span className="text-[14px] font-bold text-ink">{s.weight.toFixed(1)}<span className="text-[11px] font-semibold text-ink-faint"> lb</span></span></span>
                            <span className="text-[14px] font-bold text-ink">{s.reps}<span className="text-[11px] font-semibold text-ink-faint"> reps</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search an exercise…" className="w-full rounded-[12px] border border-line bg-surface-2 py-2.5 pl-9 pr-3 text-[13px] text-ink outline-none focus:border-accent" />
      </div>
      {!search && <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Your logged exercises</p>}
      <div className="flex flex-col gap-1.5">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-soft">{loggedNames.length === 0 ? "Log a workout to build records." : "No matches."}</p>
        ) : filtered.map((n) => {
          const has = loggedNames.some((x) => norm(x) === norm(n));
          return (
            <button key={n} onClick={() => setSelected(n)} className="glass-panel flex items-center justify-between rounded-[14px] px-4 py-3 text-left">
              <span className="text-[13px] font-semibold text-ink">{n}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-faint">{has ? "View" : "No data"}<ChevronRight className="size-3.5" /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Range = "all" | "year" | "month" | "week";

function ChartsTab({ logs, muscleByName, today }: { logs: WorkoutLogItem[]; muscleByName: Record<string, string>; today: string }) {
  const [range, setRange] = useState<Range>("all");

  const cutoff = useMemo(() => {
    if (range === "all") return "0000-00-00";
    const days = range === "year" ? 365 : range === "month" ? 31 : 7;
    return shiftDate(today, -days);
  }, [range, today]);

  const segments = useMemo(() => {
    const vol: Record<string, number> = {};
    logs.filter((l) => l.date >= cutoff).forEach((l) => l.exercises.forEach((ex) => {
      const cat = muscleByName[norm(ex.name)] || bodyPartFromName(ex.name);
      vol[cat] = (vol[cat] || 0) + exVolume(ex);
    }));
    return Object.entries(vol).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: colorForBodyPart(label) === BODY_PART_COLORS.Other ? CHART_COLORS[i % CHART_COLORS.length] : colorForBodyPart(label) }));
  }, [logs, cutoff, muscleByName]);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const inRange = useMemo(() => logs.filter((l) => l.date >= cutoff), [logs, cutoff]);
  const workoutsInRange = inRange.length;

  const metrics = useMemo(() => {
    let sets = 0, reps = 0, prs = 0;
    const days = new Set<string>();
    inRange.forEach((l) => {
      days.add(l.date);
      l.exercises.forEach((ex) => ex.sets.forEach((s) => { sets++; reps += s.reps; if (s.is_pr) prs++; }));
    });
    // workouts per week across the active span
    const span = inRange.length
      ? Math.max(1, (Date.parse(today) - Date.parse(inRange.reduce((m, l) => (l.date < m ? l.date : m), today))) / 86400000)
      : 1;
    const perWeek = (days.size / span) * 7;
    return { sets, reps, prs, perWeek, topMuscle: segments[0]?.label ?? "—" };
  }, [inRange, today, segments]);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-soft flex gap-1 rounded-[14px] p-1">
        {([["all", "All"], ["year", "Year"], ["month", "Month"], ["week", "Week"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)} className={`flex-1 rounded-[10px] py-1.5 text-[12px] font-bold transition ${range === v ? "glass-strong text-ink" : "text-ink-soft"}`}>{l}</button>
        ))}
      </div>

      <section className="glass-panel rounded-[22px] p-4">
        <p className="mb-3 flex items-center gap-1.5 font-display text-[15px] font-bold text-ink"><Activity className="size-4 text-accent" /> Diagnostics</p>
        <div className="grid grid-cols-3 gap-2.5">
          <Stat icon={<Dumbbell className="size-3.5" />} label="Workouts" value={`${workoutsInRange}`} />
          <Stat icon={<BarChart3 className="size-3.5" />} label="Volume" value={bigNum(total)} unit="lb" />
          <Stat icon={<Trophy className="size-3.5" />} label="PRs" value={`${metrics.prs}`} />
          <Stat icon={<Repeat className="size-3.5" />} label="Total sets" value={`${metrics.sets}`} />
          <Stat icon={<Calendar className="size-3.5" />} label="Per week" value={metrics.perWeek.toFixed(1)} />
          <Stat icon={<Target className="size-3.5" />} label="Top focus" value={metrics.topMuscle} />
        </div>
      </section>

      <section className="glass-panel rounded-[22px] p-4">
        <p className="flex items-center gap-1.5 font-display text-[15px] font-bold text-ink"><BarChart3 className="size-4 text-accent" /> Volume by muscle</p>
        {total === 0 ? (
          <div className="py-10 text-center"><span className="text-3xl">📊</span><p className="mt-2 text-[13px] text-ink-soft">No volume logged in this range.</p></div>
        ) : (
          <>
            <Donut segments={segments} total={total} />
            <div className="mt-3 flex flex-col">
              <div className="flex items-center justify-between border-t border-line py-2">
                <span className="text-[13px] font-bold text-ink">Total</span>
                <span className="text-[13px] font-bold text-ink">{total.toLocaleString()} lb</span>
              </div>
              {segments.map((s) => (
                <div key={s.label} className="flex items-center justify-between border-t border-line py-2">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                  <span className="text-[12px] text-ink-soft">{s.value.toLocaleString()} lb · {((s.value / total) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="text-center text-[12px] text-ink-faint">{workoutsInRange} workout{workoutsInRange === 1 ? "" : "s"} in range</p>
    </div>
  );
}

function Donut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const r = 52, c = 2 * Math.PI * r, sw = 24;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="mx-auto mt-3" style={{ width: 180, height: 180 }}>
      <g transform="rotate(-90 70 70)">
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={sw} />
        {segments.map((seg, i) => {
          const dash = (seg.value / (total || 1)) * c;
          const el = (
            <circle key={i} cx={70} cy={70} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
          );
          offset += dash;
          return el;
        })}
      </g>
      <text x={70} y={67} textAnchor="middle" style={{ fill: "var(--color-ink)", fontSize: 13, fontWeight: 800 }}>{segments[0]?.label ?? ""}</text>
      <text x={70} y={84} textAnchor="middle" style={{ fill: "var(--color-ink-soft)", fontSize: 10 }}>{total ? `${((segments[0]?.value ?? 0) / total * 100).toFixed(0)}%` : ""}</text>
    </svg>
  );
}

function MiniChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 300, h = 64, pad = 6;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => ({ x: pad + (i / (data.length - 1)) * (w - pad * 2), y: pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2) }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <path d={`${d} L ${pts[pts.length - 1].x.toFixed(1)} ${h - pad} L ${pts[0].x.toFixed(1)} ${h - pad} Z`} fill="var(--color-accent)" fillOpacity={0.12} />
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill="var(--color-accent)" />
    </svg>
  );
}

function clone<T>(v: T): T {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)) as T; }
}
