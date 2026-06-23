"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, ClipboardList, Database, Dumbbell, ExternalLink, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfig } from "@/lib/config/ConfigContext";
import { useUserDb }  from "@/lib/hooks/useUserDb";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useFirebaseExercises } from "@/lib/hooks/useFirebaseExercises";
import { callCohere } from "@/lib/ai/cohere";
import { setActiveWorkoutTemplate } from "@/lib/db/userDb";
import { parseAIWorkout } from "@/lib/workout/parse";
import { AuroraHeader } from "@/components/app/AuroraHeader";

export interface Exercise {
  exercise_id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  secondary_groups: string[];
  equipment: string;
  movement_pattern: string;
  instructions: string | string[];
  image_url?: string;
  jefit_url?: string;
  difficulty?: string;
  source?: "builtin" | "jefit";
}

const EXERCISE_LIBRARY: Exercise[] = [
  { exercise_id: "barbell_back_squat", name: "Barbell Back Squat", category: "Strength", muscle_groups: ["Quads", "Glutes"], secondary_groups: ["Core", "Hamstrings"], equipment: "Barbell", movement_pattern: "Squat", instructions: "Brace your core, sit between the hips, and drive up through the full foot." },
  { exercise_id: "goblet_squat", name: "Goblet Squat", category: "Strength", muscle_groups: ["Quads", "Glutes"], secondary_groups: ["Core"], equipment: "Dumbbell", movement_pattern: "Squat", instructions: "Hold the bell high, keep your torso tall, and descend with control." },
  { exercise_id: "romanian_deadlift", name: "Romanian Deadlift", category: "Strength", muscle_groups: ["Hamstrings", "Glutes"], secondary_groups: ["Back"], equipment: "Barbell", movement_pattern: "Hinge", instructions: "Push the hips back, keep the bar close, and stop when hamstrings are loaded." },
  { exercise_id: "hip_thrust", name: "Hip Thrust", category: "Strength", muscle_groups: ["Glutes"], secondary_groups: ["Hamstrings", "Core"], equipment: "Barbell", movement_pattern: "Bridge", instructions: "Drive through the heels, lock the ribcage down, and squeeze at the top." },
  { exercise_id: "walking_lunge", name: "Walking Lunge", category: "Strength", muscle_groups: ["Quads", "Glutes"], secondary_groups: ["Core"], equipment: "Dumbbell", movement_pattern: "Lunge", instructions: "Step long enough to keep your front heel planted and torso stacked." },
  { exercise_id: "bench_press", name: "Bench Press", category: "Strength", muscle_groups: ["Chest", "Arms"], secondary_groups: ["Shoulders"], equipment: "Barbell", movement_pattern: "Horizontal Push", instructions: "Retract the shoulder blades, lower with control, and press to a strong lockout." },
  { exercise_id: "incline_dumbbell_press", name: "Incline Dumbbell Press", category: "Strength", muscle_groups: ["Chest", "Shoulders"], secondary_groups: ["Arms"], equipment: "Dumbbell", movement_pattern: "Incline Push", instructions: "Press slightly inward, keep wrists stacked, and control the eccentric." },
  { exercise_id: "push_up", name: "Push-Up", category: "Bodyweight", muscle_groups: ["Chest", "Arms"], secondary_groups: ["Core", "Shoulders"], equipment: "Bodyweight", movement_pattern: "Horizontal Push", instructions: "Keep a straight line from head to heel and lower the chest under control." },
  { exercise_id: "lat_pulldown", name: "Lat Pulldown", category: "Strength", muscle_groups: ["Back"], secondary_groups: ["Arms"], equipment: "Cable", movement_pattern: "Vertical Pull", instructions: "Drive elbows down toward the ribs without leaning too far back." },
  { exercise_id: "seated_row", name: "Seated Cable Row", category: "Strength", muscle_groups: ["Back"], secondary_groups: ["Arms"], equipment: "Cable", movement_pattern: "Horizontal Pull", instructions: "Lead with the elbows and pause briefly with shoulder blades squeezed together." },
  { exercise_id: "single_arm_row", name: "Single-Arm Dumbbell Row", category: "Strength", muscle_groups: ["Back"], secondary_groups: ["Arms", "Core"], equipment: "Dumbbell", movement_pattern: "Horizontal Pull", instructions: "Pull toward the hip and avoid twisting the torso." },
  { exercise_id: "overhead_press", name: "Overhead Press", category: "Strength", muscle_groups: ["Shoulders"], secondary_groups: ["Arms", "Core"], equipment: "Barbell", movement_pattern: "Vertical Push", instructions: "Squeeze glutes, keep ribs down, and press the bar overhead in a straight path." },
  { exercise_id: "lateral_raise", name: "Lateral Raise", category: "Accessory", muscle_groups: ["Shoulders"], secondary_groups: [], equipment: "Dumbbell", movement_pattern: "Isolation", instructions: "Raise to shoulder height with soft elbows and steady tempo." },
  { exercise_id: "bicep_curl", name: "Bicep Curl", category: "Accessory", muscle_groups: ["Arms"], secondary_groups: [], equipment: "Dumbbell", movement_pattern: "Isolation", instructions: "Keep elbows pinned, supinate at the top, and lower under full control." },
  { exercise_id: "tricep_pressdown", name: "Tricep Pressdown", category: "Accessory", muscle_groups: ["Arms"], secondary_groups: [], equipment: "Cable", movement_pattern: "Isolation", instructions: "Lock elbows in, press to full extension, and control the return." },
  { exercise_id: "plank", name: "Plank", category: "Bodyweight", muscle_groups: ["Core"], secondary_groups: ["Shoulders"], equipment: "Bodyweight", movement_pattern: "Anti-Extension", instructions: "Pack the neck, brace like you're about to get punched, and breathe steadily." },
  { exercise_id: "hanging_leg_raise", name: "Hanging Leg Raise", category: "Bodyweight", muscle_groups: ["Core"], secondary_groups: [], equipment: "Bodyweight", movement_pattern: "Flexion", instructions: "Minimize swing, tuck or extend the legs, and lower with control." },
  { exercise_id: "face_pull", name: "Face Pull", category: "Accessory", muscle_groups: ["Shoulders", "Back"], secondary_groups: [], equipment: "Cable", movement_pattern: "External Rotation", instructions: "Pull to face height, rotate externally at the top, and keep elbows high." },
  { exercise_id: "running", name: "Running", category: "Cardio", muscle_groups: ["Legs"], secondary_groups: ["Core"], equipment: "Bodyweight", movement_pattern: "Locomotion", instructions: "Maintain an upright posture and land with a midfoot strike." },
];

const CATEGORIES = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes", "Core", "Cardio"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const PROGRAM_TYPES = [
  { id: "ppl",         label: "PPL",          desc: "Push / Pull / Legs (6 days)" },
  { id: "upper_lower", label: "Upper/Lower",  desc: "4-day split" },
  { id: "full_body",   label: "Full Body",    desc: "3 days/week" },
  { id: "bro_split",   label: "Bro Split",    desc: "5-day isolation" },
  { id: "custom",      label: "Custom",       desc: "Your own program" },
] as const;
type ProgramTypeId = typeof PROGRAM_TYPES[number]["id"];

const EQUIPMENT_COLORS: Record<string, string> = {
  Barbell: "bg-surface-2 text-ink-soft",
  Dumbbell: "bg-surface-2 text-ink-soft",
  Cable: "bg-surface-2 text-ink-soft",
  Bodyweight: "bg-surface-2 text-ink-soft",
};

export default function WorkoutPage() {
  const router = useRouter();
  const { cohereKey, hasCohere } = useConfig();
  const handle = useUserDb();
  const { profile } = useUserProfile();
  const { exercises: fbExercises, loading: fbLoading } = useFirebaseExercises();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [generating, setGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [programType, setProgramType] = useState<ProgramTypeId>("ppl");
  const [customProgram, setCustomProgram] = useState("");

  const allExercises = useMemo<Exercise[]>(() => {
    const fbConverted: Exercise[] = fbExercises.map((fb, i) => ({
      exercise_id: `fb_${i}_${fb.name.replace(/\s+/g, "_").toLowerCase()}`,
      name: fb.name,
      category: fb.body_part || capitalizeFirst(fb.category || "strength"),
      muscle_groups: Array.from(new Set([fb.body_part, fb.muscle_group].filter(Boolean))),
      secondary_groups: fb.secondary_muscles || [],
      equipment: fb.equipment || "Various",
      movement_pattern: capitalizeFirst(fb.category || "Compound"),
      instructions: fb.instructions?.length ? fb.instructions : fb.description || "",
      image_url: fb.image_url,
      jefit_url: fb.jefit_url,
      difficulty: fb.difficulty,
      source: "jefit" as const,
    }));

    const fbNames = new Set(fbConverted.map((e) => e.name.toLowerCase()));
    const builtinFiltered = EXERCISE_LIBRARY.filter(
      (e) => !fbNames.has(e.name.toLowerCase()),
    );

    return [...fbConverted, ...builtinFiltered];
  }, [fbExercises]);

  const filtered = useMemo(() => {
    let list = allExercises;
    if (categoryFilter !== "All") {
      const q = categoryFilter.toLowerCase();
      list = list.filter(
        (e) =>
          e.category.toLowerCase() === q ||
          e.muscle_groups.some((m) => m.toLowerCase().includes(q)),
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscle_groups.some((m) => m.toLowerCase().includes(q)) ||
          e.equipment.toLowerCase().includes(q),
      );
    }
    return list;
  }, [search, categoryFilter, allExercises]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, categoryFilter]);

  const visibleExercises = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const generateWorkout = useCallback(async () => {
    if (!cohereKey || generating) return;
    setGenerating(true);
    setAiPlan(null);
    setAiError(null);
    setAiMsg(null);
    try {
      const phase = profile?.phase ?? "maintain";
      const weight = profile?.current_weight ?? 160;
      const typeMeta = PROGRAM_TYPES.find((p) => p.id === programType);
      const focus = programType === "custom"
        ? (customProgram.trim() || "full-body session")
        : `${typeMeta?.label} (${typeMeta?.desc})`;

      const pool = allExercises.length ? [...allExercises].sort(() => Math.random() - 0.5).slice(0, 70) : [];
      const exerciseMenu = pool.map((e) => e.name).join(", ");

      const prompt = `Create ONE structured gym workout session for a UW college student.

Focus / split: ${focus}
Student: ${weight} lbs, ${phase} phase, full gym (barbell, dumbbell, cable, machine, bodyweight), 45–60 min.

${exerciseMenu ? `Choose VARIED exercises, preferring these REAL exercises from our database (pick a mix, not just the obvious basics):
${exerciseMenu}

` : ""}Provide 5–7 exercises. Format EACH exercise EXACTLY as:
**[Exercise Name]** — [Sets] × [Reps] — [one short, specific form/technique cue]

Rules:
- Use real exercise names (ideally from the list above) and vary the movement patterns.
- The cue after the last "—" MUST be a single helpful sentence the lifter can learn from.
- After the list, add one short "Why this session?" line.`;

      const reply = await callCohere(cohereKey, prompt, { temperature: 0.8 });
      setAiPlan(reply);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [cohereKey, generating, profile, programType, customProgram, allExercises]);

  const exportToLogger = useCallback(async () => {
    if (!handle || !aiPlan) return;
    const exercises = parseAIWorkout(aiPlan);
    if (exercises.length === 0) { setAiMsg("Couldn't read exercises from this workout."); return; }
    const typeMeta = PROGRAM_TYPES.find((p) => p.id === programType);
    const title = programType === "custom"
      ? (customProgram.trim() || "AI Workout")
      : `${typeMeta?.label} Workout`;
    try {
      await setActiveWorkoutTemplate(handle.db, handle.uid, { title, exercises });
      setAiMsg("Sent ✓. Open Log → Today to start.");
    } catch {
      setAiMsg("Couldn't export. Check your connection.");
    }
  }, [handle, aiPlan, programType, customProgram]);

  return (
    <div className="min-h-screen">
      <AuroraHeader
        title="Train"
        subtitle={
          fbLoading ? "Loading…" : fbExercises.length > 0
            ? `${allExercises.length} exercises · ${fbExercises.length} from JEFit`
            : `${allExercises.length} exercises`
        }
        icon={<Dumbbell className="size-[18px]" />}
      >
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="glass-soft w-full rounded-[14px] py-2.5 pl-9 pr-9 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </AuroraHeader>

      <div className="px-5 pb-8 pt-4">
        <section className="glass-panel mb-6 rounded-[22px] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-[18px] text-accent" />
            <p className="font-display text-[16px] font-bold text-ink">AI Workout Generator</p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            Pick a focus and generate a session, then send it straight to your Workout Logger to fill in weights.
          </p>

          <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {PROGRAM_TYPES.map((p) => (
              <button
                key={p.id}
                onClick={() => setProgramType(p.id)}
                className={`press shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition ${
                  programType === p.id ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">{PROGRAM_TYPES.find((p) => p.id === programType)?.desc}</p>

          {programType === "custom" && (
            <input
              type="text"
              value={customProgram}
              onChange={(e) => setCustomProgram(e.target.value)}
              placeholder="Describe it (e.g. PHAT push day, 5/3/1 squat focus…)"
              className="mt-3 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
            />
          )}

          <button
            onClick={generateWorkout}
            disabled={generating || !hasCohere || (programType === "custom" && !customProgram.trim())}
            className="press mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3.5 text-[14px] font-bold text-accent-contrast disabled:opacity-50"
          >
            {generating
              ? <><RefreshCw className="size-4 animate-spin" /> Generating…</>
              : <><Sparkles className="size-4" /> {aiPlan ? "Regenerate workout" : "Generate workout"}</>}
          </button>

          {!hasCohere && (
            <button onClick={() => router.push("/profile")} className="mt-2 w-full text-center text-[11px] font-semibold text-accent-ink">
              Add your Cohere key in Profile to use AI →
            </button>
          )}
          {aiError && <p className="mt-2 text-[12px] text-danger">{aiError}</p>}

          {aiPlan && (
            <div className="mt-5 rounded-[16px] border border-line bg-surface-2 p-4">
              <div className="text-[13px] leading-relaxed text-ink-soft">
                {aiPlan.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return <p key={i} className={`${i > 0 ? "mt-3" : ""} font-display text-[13px] font-extrabold text-ink`}>{line.replace("## ", "")}</p>;
                  }
                  return <p key={i} className={i > 0 ? "mt-1.5" : ""}>{parseBold(line)}</p>;
                })}
              </div>
              <button
                onClick={exportToLogger}
                className="press mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent-soft py-2.5 text-[13px] font-bold text-accent-ink"
              >
                <ClipboardList className="size-4" /> Send to Workout Logger
              </button>
              {aiMsg && <p className="mt-2 text-center text-[11px] font-semibold text-success">{aiMsg}</p>}
            </div>
          )}
        </section>

        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                categoryFilter === cat
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface text-ink-soft"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length > 0 && (
          <p className="mb-2.5 text-[12px] font-semibold text-ink-faint">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length.toLocaleString()} exercises
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[14px] text-ink-soft">No exercises found.</div>
          ) : (
            <>
              {visibleExercises.map((ex) => (
                <ExerciseCard
                  key={ex.exercise_id}
                  exercise={ex}
                  expanded={expandedId === ex.exercise_id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === ex.exercise_id ? null : ex.exercise_id))
                  }
                />
              ))}
              {filtered.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="press mt-1 w-full rounded-[14px] border border-line bg-surface-2 py-3 text-[13px] font-bold text-ink-soft"
                >
                  Load more ({filtered.length - visibleCount} more)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  expanded,
  onToggle,
}: {
  exercise: Exercise;
  expanded: boolean;
  onToggle: () => void;
}) {
  const eqColor = EQUIPMENT_COLORS[exercise.equipment] || "bg-surface-3 text-ink";
  const steps = parseSteps(exercise.instructions);

  return (
    <div className="glass-panel overflow-hidden rounded-[16px]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {exercise.image_url ? (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
            <Image
              src={exercise.image_url}
              alt={exercise.name}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-faint">
            <Dumbbell className="size-5" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-bold text-ink">{exercise.name}</p>
            {exercise.source === "jefit" && (
              <Database className="size-3 text-accent opacity-60" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {exercise.muscle_groups.filter(Boolean).map((m) => (
              <span key={m} className="rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent-ink">{m}</span>
            ))}
            <span className={`rounded-full px-2 py-0.5 font-semibold ${eqColor}`}>
              {exercise.equipment}
            </span>
            {exercise.difficulty && (
              <span className="capitalize text-ink-faint">{exercise.difficulty}</span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`size-4 shrink-0 text-ink-faint transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {exercise.image_url && (
            <div className="relative mb-3 h-32 w-full overflow-hidden rounded-[12px] bg-surface-2">
              <Image
                src={exercise.image_url}
                alt={exercise.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {(exercise.muscle_groups.filter(Boolean).length > 0 || exercise.secondary_groups.filter(Boolean).length > 0) && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">Muscles worked</p>
              <div className="flex flex-wrap gap-1.5">
                {exercise.muscle_groups.filter(Boolean).map((m) => (
                  <span key={m} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent-ink">{m}</span>
                ))}
                {exercise.secondary_groups.filter(Boolean).map((m) => (
                  <span key={m} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">{m}</span>
                ))}
              </div>
            </div>
          )}

          {steps.length > 0 && (
            <>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">Instructions</p>
              {steps.length > 1 ? (
                <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-ink">{i + 1}</span>
                      <span className="flex-1">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-soft">{steps[0]}</p>
              )}
            </>
          )}

          {exercise.jefit_url && (
            <a
              href={exercise.jefit_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-accent"
            >
              <ExternalLink className="size-3" /> View on JEFit
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Split instructions into discrete steps: arrays as-is, or a string broken on
 *  new lines / numbered markers ("1.)", "2.", "3)"). Each step renders on its own line. */
function parseSteps(instructions: string | string[]): string[] {
  const arr = Array.isArray(instructions) ? instructions.map((s) => String(s).trim()).filter(Boolean) : [];
  // A real multi-step array is used as-is; a single blob (even inside an array)
  // falls through to be split on its internal numbered markers / new lines.
  if (arr.length > 1) return arr.map((l) => l.replace(/^\s*\d+\s*[.)]+\s*/, ""));
  const text = (arr.length === 1 ? arr[0] : String(instructions || ""))
    .replace(/^\s*steps?\s*:?\s*/i, "")
    .trim();
  if (!text) return [];
  const byLine = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine.map((l) => l.replace(/^\s*\d+\s*[.)]+\s*/, ""));
  const delimited = text.replace(/\s*\d+\s*[.)]+\s+/g, "");
  const parts = delimited.split("").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
