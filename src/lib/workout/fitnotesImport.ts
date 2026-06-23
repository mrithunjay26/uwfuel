import type { LoggedSet, WorkoutLog, WorkoutLogExercise, ExerciseType } from "@/lib/db/types";

// Maps a FitNotes "Category" to one of the app's muscle groups.
function toMuscle(category: string): string {
  const c = category.trim().toLowerCase();
  if (!c) return "Other";
  if (c.includes("chest")) return "Chest";
  if (c.includes("back") || c.includes("lat")) return "Back";
  if (c.includes("shoulder") || c.includes("delt") || c.includes("trap")) return "Shoulders";
  if (c.includes("bicep") || c.includes("tricep") || c.includes("forearm") || c.includes("arm")) return "Arms";
  if (c.includes("glute")) return "Glutes";
  if (c.includes("quad") || c.includes("hamstring") || c.includes("calf") || c.includes("calves") || c.includes("leg")) return "Legs";
  if (c.includes("ab") || c.includes("core")) return "Core";
  if (c.includes("cardio")) return "Cardio";
  return "Other";
}

/** Parse one CSV line, honoring quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function distanceToMiles(value: number, unit: string): number {
  if (!value) return 0;
  const u = unit.trim().toLowerCase();
  if (u === "km" || u === "kilometers") return value * 0.621371;
  if (u === "m" || u === "meters") return value / 1609.34;
  if (u === "yd" || u === "yards") return value / 1760;
  return value; // miles / mi / unknown → assume miles
}

function timeToSeconds(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return parseInt(t, 10); // already seconds
  const parts = t.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export interface FitNotesImportResult {
  logs: Omit<WorkoutLog, "created_at">[];
  rowCount: number;
  dayCount: number;
  exerciseCount: number;
}

/**
 * Parse a FitNotes CSV export into per-day WorkoutLogs.
 * Columns: Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind
 * One row = one set; rows are grouped by date, then by exercise (order preserved).
 */
export function parseFitNotesCsv(text: string): FitNotesImportResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { logs: [], rowCount: 0, dayCount: 0, exerciseCount: 0 };

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h === name);
  const idx = {
    date: col("date"),
    exercise: col("exercise"),
    category: col("category"),
    lbs: col("weight (lbs)"),
    kg: col("weight (kg)"),
    reps: col("reps"),
    distance: col("distance"),
    unit: col("distance unit"),
    time: col("time"),
    notes: col("notes"),
  };
  if (idx.date === -1 || idx.exercise === -1) {
    return { logs: [], rowCount: 0, dayCount: 0, exerciseCount: 0 };
  }

  // date -> ordered exercises -> exercise aggregate
  const byDate = new Map<string, Map<string, WorkoutLogExercise>>();
  let rowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]);
    const date = (f[idx.date] || "").trim();
    const name = (f[idx.exercise] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) continue;

    const lbs = idx.lbs !== -1 ? parseFloat(f[idx.lbs]) || 0 : 0;
    const kg = idx.kg !== -1 ? parseFloat(f[idx.kg]) || 0 : 0;
    const weight = lbs > 0 ? lbs : kg > 0 ? Math.round(kg * 2.20462 * 10) / 10 : 0;
    const reps = idx.reps !== -1 ? parseInt(f[idx.reps], 10) || 0 : 0;
    const distance = idx.distance !== -1 ? distanceToMiles(parseFloat(f[idx.distance]) || 0, idx.unit !== -1 ? f[idx.unit] : "") : 0;
    const duration = idx.time !== -1 ? timeToSeconds(f[idx.time] || "") : 0;
    const notes = idx.notes !== -1 ? (f[idx.notes] || "").trim() : "";

    // Skip placeholder/empty sets (FitNotes sometimes exports 1lb×0 stubs).
    if (weight <= 1 && reps <= 0 && distance <= 0 && duration <= 0) continue;

    const type: ExerciseType = distance > 0 || duration > 0 ? "cardio" : weight > 0 ? "weighted" : "bodyweight";
    const set: LoggedSet = {
      weight: type === "cardio" ? 0 : Math.round(weight * 10) / 10,
      reps,
      ...(distance > 0 ? { distance: Math.round(distance * 100) / 100 } : {}),
      ...(duration > 0 ? { duration_sec: duration } : {}),
      ...(notes ? { comment: notes } : {}),
    };

    let dayMap = byDate.get(date);
    if (!dayMap) { dayMap = new Map(); byDate.set(date, dayMap); }
    const key = name.toLowerCase();
    let ex = dayMap.get(key);
    if (!ex) {
      ex = { name, muscle: toMuscle(idx.category !== -1 ? f[idx.category] : ""), ...(type !== "weighted" ? { type } : {}), sets: [] };
      dayMap.set(key, ex);
    }
    ex.sets.push(set);
    rowCount++;
  }

  const logs: Omit<WorkoutLog, "created_at">[] = [];
  let exerciseCount = 0;
  for (const [date, dayMap] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const exercises = [...dayMap.values()].filter((e) => e.sets.length > 0);
    if (exercises.length === 0) continue;
    exerciseCount += exercises.length;
    logs.push({ date, title: "Imported workout", exercises, source: "manual" });
  }

  return { logs, rowCount, dayCount: logs.length, exerciseCount };
}
