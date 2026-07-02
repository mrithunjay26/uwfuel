import type { WorkoutLogExercise } from "@/lib/db/types";

export function parseAIWorkout(text: string): WorkoutLogExercise[] {
  const out: WorkoutLogExercise[] = [];
  for (const line of text.split("\n")) {
    const bold = line.match(/\*\*(.+?)\*\*/);
    if (!bold) continue;
    const name = bold[1].replace(/[:#*]/g, "").trim();
    if (!name) continue;

    const rest = line.slice((bold.index ?? 0) + bold[0].length);
    const sr = rest.match(/(\d+)\s*[×xX]\s*(\d+(?:\s*[-–]\s*\d+)?)/);
    if (!sr) continue;

    const setCount = Math.min(Math.max(parseInt(sr[1], 10) || 3, 1), 12);
    const reps = parseInt(sr[2], 10) || 10;

    let tip = rest.slice((sr.index ?? 0) + sr[0].length).replace(/^[\s—–\-:|]+/, "").trim();
    if (tip.length < 4) tip = "";

    out.push({
      name,
      ...(tip ? { tip } : {}),
      sets: Array.from({ length: setCount }, () => ({ weight: 0, reps })),
    });
  }
  return out;
}

export interface AIWorkoutDay {
  label: string;
  exercises: WorkoutLogExercise[];
}

/**
 * Parse a multi-day AI plan into labeled days. Day headers are markdown
 * headings ("## Day 1 — Push") or a bold-only line ("**Day 2 — Pull**").
 */
export function parseAIWeek(text: string): AIWorkoutDay[] {
  const days: AIWorkoutDay[] = [];
  let cur: { label: string; body: string[] } | null = null;
  const flush = () => {
    if (cur) {
      const exercises = parseAIWorkout(cur.body.join("\n"));
      if (exercises.length) days.push({ label: cur.label, exercises });
    }
  };
  for (const line of text.split("\n")) {
    const heading = line.match(/^\s*#{1,3}\s*(.+?)\s*$/);
    const boldHeader = line.match(/^\s*\*\*\s*(day\s*\d+[^*]*)\*\*\s*$/i);
    const label = heading?.[1] || boldHeader?.[1];
    if (label && !/\d+\s*[×xX]\s*\d+/.test(line)) {
      flush();
      cur = { label: label.replace(/[#*]/g, "").trim(), body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  flush();
  return days;
}
