import type { WorkoutLogExercise } from "@/lib/db/types";

export type PrKind = "weight" | "reps";

export interface PrLog {
  id: string;
  date: string;
  created_at?: string;
  exercises: WorkoutLogExercise[];
}

export const PR_LABEL: Record<PrKind, string> = { weight: "Weight PR", reps: "Rep PR" };

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const weightKey = (w: number) => Math.round(w * 100);

export function prKey(logId: string, exerciseIndex: number, setIndex: number): string {
  return `${logId}:${exerciseIndex}:${setIndex}`;
}

interface SessionSet { xi: number; si: number; w: number; r: number }

interface ExerciseHistory {
  maxWeight: number | null;
  repsAt: Map<number, number>;
}

function bestRepsAtOrAbove(h: ExerciseHistory, w: number): number | null {
  const k = weightKey(w);
  let best = -1;
  h.repsAt.forEach((reps, key) => {
    if (key >= k && reps > best) best = reps;
  });
  return best < 0 ? null : best;
}

function paretoFrontier(sets: SessionSet[]): SessionSet[] {
  return sets.filter((c, i) => !sets.some((d, j) =>
    j !== i && d.w >= c.w && d.r >= c.r && (d.w > c.w || d.r > c.r || j < i)));
}

export function computePrIndex(logs: PrLog[]): Map<string, PrKind> {
  const ordered = [...logs].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.created_at ?? "").localeCompare(b.created_at ?? "")
    || a.id.localeCompare(b.id));

  const history = new Map<string, ExerciseHistory>();
  const out = new Map<string, PrKind>();

  for (const log of ordered) {
    const byExercise = new Map<string, SessionSet[]>();
    (log.exercises ?? []).forEach((ex, xi) => {
      if (!ex || ex.type === "cardio") return;
      const name = normName(ex.name ?? "");
      if (!name) return;
      const list = byExercise.get(name) ?? [];
      (ex.sets ?? []).forEach((s, si) => {
        const w = Number(s?.weight) || 0;
        const r = Number(s?.reps) || 0;
        if (r > 0 && w >= 0) list.push({ xi, si, w, r });
      });
      byExercise.set(name, list);
    });

    byExercise.forEach((sets, name) => {
      if (sets.length === 0) return;
      const prior = history.get(name);

      if (prior) {
        const frontier = paretoFrontier(sets);

        if (prior.maxWeight !== null) {
          let top: SessionSet | null = null;
          for (const c of frontier) {
            if (c.w > 0 && (!top || c.w > top.w || (c.w === top.w && c.r > top.r))) top = c;
          }
          if (top && top.w > prior.maxWeight + 1e-9) out.set(prKey(log.id, top.xi, top.si), "weight");
        }

        for (const c of frontier) {
          const key = prKey(log.id, c.xi, c.si);
          if (out.has(key)) continue;
          const before = bestRepsAtOrAbove(prior, c.w);
          if (before !== null && c.r > before) out.set(key, "reps");
        }
      }

      const h: ExerciseHistory = prior ?? { maxWeight: null, repsAt: new Map<number, number>() };
      for (const c of sets) {
        if (c.w > 0) h.maxWeight = h.maxWeight === null ? c.w : Math.max(h.maxWeight, c.w);
        const k = weightKey(c.w);
        h.repsAt.set(k, Math.max(h.repsAt.get(k) ?? 0, c.r));
      }
      history.set(name, h);
    });
  }

  return out;
}

export function countPrs(index: Map<string, PrKind>, logIds: Iterable<string>): number {
  const ids = new Set(logIds);
  let n = 0;
  index.forEach((_, key) => {
    if (ids.has(key.slice(0, key.indexOf(":")))) n++;
  });
  return n;
}
