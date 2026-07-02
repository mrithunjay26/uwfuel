// Shared exercise search matrix — used by both the workout logger and the
// training plan studio so their pickers behave identically (recents first,
// last-done + count badges, fuzzy matching of half-remembered names).

export const normName = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Fuzzy matcher: substrings score highest, then subsequence with word-start/streak bonuses. -1 = no match. */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  const at = t.indexOf(q);
  if (at !== -1) return 200 - at * 2;
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

export function relDaysLabel(from: string, to: string): string {
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

export interface ExStat { name: string; count: number; lastDate: string; }
export interface ExResult { name: string; count: number; lastDate: string | null; }

interface LogLike { date: string; exercises: { name: string; sets?: unknown[] }[] }

/** How often / how recently each exercise was actually done across the logs. */
export function buildExerciseStats(logs: LogLike[]): Map<string, ExStat> {
  const m = new Map<string, ExStat>();
  for (const l of logs) {
    for (const ex of l.exercises) {
      if (!ex.sets?.length) continue;
      const k = normName(ex.name);
      const cur = m.get(k);
      if (!cur) m.set(k, { name: ex.name, count: 1, lastDate: l.date });
      else { cur.count += 1; if (l.date > cur.lastDate) cur.lastDate = l.date; }
    }
  }
  return m;
}

/**
 * Rank exercises: previously-done first (by recency, then count); when searching,
 * fuzzy-score with a recency boost so familiar movements surface first.
 */
export function searchExercises(
  directory: string[],
  stats: Map<string, ExStat>,
  query: string,
): ExResult[] {
  const names = new Map<string, string>();
  directory.forEach((n) => names.set(normName(n), n));
  stats.forEach((s, k) => { if (!names.has(k)) names.set(k, s.name); });
  const list: ExResult[] = [...names.entries()].map(([k, name]) => {
    const st = stats.get(k);
    return { name, count: st?.count ?? 0, lastDate: st?.lastDate ?? null };
  });
  const q = query.trim();
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
}
