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
