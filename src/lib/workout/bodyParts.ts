// Specific muscle groups used across logging + charts. A workout exercise's
// `muscle` field stores one of these; users can override it per exercise.
export const BODY_PARTS = [
  "Chest",
  "Lats",
  "Upper Back",
  "Traps",
  "Front Delts",
  "Side Delts",
  "Rear Delts",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Abs",
  "Obliques",
  "Cardio",
  "Full Body",
  "Other",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

export const BODY_PART_COLORS: Record<BodyPart, string> = {
  Chest: "#ef4444",
  Lats: "#3b82f6",
  "Upper Back": "#2563eb",
  Traps: "#60a5fa",
  "Front Delts": "#fbbf24",
  "Side Delts": "#f59e0b",
  "Rear Delts": "#d97706",
  Biceps: "#8b7cf6",
  Triceps: "#a78bfa",
  Forearms: "#6d28d9",
  Quads: "#22c55e",
  Hamstrings: "#16a34a",
  Glutes: "#14b8a6",
  Calves: "#4ade80",
  Abs: "#d946ef",
  Obliques: "#c026d3",
  Cardio: "#f472b6",
  "Full Body": "#64748b",
  Other: "#a3a3a3",
};

// Coarser family for grouped views (e.g. a "by region" chart toggle).
export const MUSCLE_FAMILY: Record<BodyPart, string> = {
  Chest: "Chest",
  Lats: "Back", "Upper Back": "Back", Traps: "Back",
  "Front Delts": "Shoulders", "Side Delts": "Shoulders", "Rear Delts": "Shoulders",
  Biceps: "Arms", Triceps: "Arms", Forearms: "Arms",
  Quads: "Legs", Hamstrings: "Legs", Calves: "Legs", Glutes: "Legs",
  Abs: "Core", Obliques: "Core",
  Cardio: "Cardio", "Full Body": "Full Body", Other: "Other",
};

// Map a raw DB muscle string (e.g. "Latissimus Dorsi", "Anterior Deltoid") to a specific muscle.
const MUSCLE_TO_PART: [RegExp, BodyPart][] = [
  [/pec|chest|sternal|clavicular/, "Chest"],
  [/lat\b|latissimus/, "Lats"],
  [/trap|trapezius/, "Traps"],
  [/rhomboid|teres|infraspinatus|erector|spinae|rotator|upper back|middle back|lower back/, "Upper Back"],
  [/rear delt|posterior delt/, "Rear Delts"],
  [/(side|lateral|medial) delt/, "Side Delts"],
  [/(front|anterior) delt/, "Front Delts"],
  [/delt|shoulder/, "Side Delts"],
  [/bicep|brachialis/, "Biceps"],
  [/tricep/, "Triceps"],
  [/forearm|wrist|brachioradialis|grip/, "Forearms"],
  [/quad|thigh/, "Quads"],
  [/hamstring/, "Hamstrings"],
  [/glute|gluteus|\bhip\b/, "Glutes"],
  [/calf|calves|soleus|gastrocnemius/, "Calves"],
  [/oblique/, "Obliques"],
  [/\bab\b|abs|abdominal|core|transverse|serratus/, "Abs"],
  [/cardio|cardiovascular|heart/, "Cardio"],
  [/full body|total body|olympic/, "Full Body"],
];

// Infer a specific muscle from an exercise name. Ordered so specific wins.
const NAME_RULES: [RegExp, BodyPart][] = [
  [/cardio|run|jog|sprint|treadmill|cycl|bike|elliptical|rowing machine|jump rope|jumping jack|burpee|stair|sled|battle rope|\bhiit\b/, "Cardio"],
  [/calf|calves|soleus|gastroc|toe raise/, "Calves"],
  [/leg curl|hamstring|romanian|\brdl\b|stiff[- ]?leg|good morning|nordic/, "Hamstrings"],
  [/hip thrust|glute|hip extension|frog pump|kickback.*glute|abductor|adductor/, "Glutes"],
  [/squat|lunge|leg press|leg extension|hack|step[- ]?up|split squat|wall sit|sissy|\bquad\b/, "Quads"],
  [/forearm|wrist|\bgrip\b|reverse[a-z ]*curl|farmer/, "Forearms"],
  [/bicep|preacher|concentration|hammer|spider curl|bayesian|supinated curl|chin[- ]?up|\bcurl\b/, "Biceps"],
  [/tricep|pushdown|press[- ]?down|skullcrusher|skull crusher|kickback|close[- ]?grip|\bdip\b|overhead extension|tricep extension/, "Triceps"],
  [/rear delt|reverse fly|reverse pec|rear fly|face pull/, "Rear Delts"],
  [/lateral raise|side raise|upright row|lateral (machine|cable|dumbbell)/, "Side Delts"],
  [/front raise|overhead press|\bohp\b|military|arnold|shoulder press/, "Front Delts"],
  [/shrug|kelso/, "Traps"],
  [/pulldown|pull[- ]?up|pullover|pull[- ]?over|straight[- ]?arm|\blat\b/, "Lats"],
  [/row|deadlift|pendlay|\bback\b/, "Upper Back"],
  [/bench|chest|incline press|decline press|push[- ]?up|pushup|\bpec\b|\bfly\b|flye|cable cross|machine press|dumbbell press/, "Chest"],
  [/oblique|russian twist|woodchop|side bend|side plank/, "Obliques"],
  [/plank|crunch|sit[- ]?up|situp|leg raise|knee raise|hanging|\babs?\b|hollow|dead bug|mountain climber/, "Abs"],
];

function canonicalFromRaw(raw: string): BodyPart | null {
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  for (const [re, part] of MUSCLE_TO_PART) {
    if (re.test(v)) return part;
  }
  return null;
}

export function bodyPartFromName(name: string): BodyPart {
  const v = (name || "").toLowerCase();
  for (const [re, part] of NAME_RULES) {
    if (re.test(v)) return part;
  }
  return "Other";
}

export function resolveBodyPart(
  name: string,
  rawMuscle?: string | string[] | null,
): BodyPart {
  const raws = Array.isArray(rawMuscle) ? rawMuscle : rawMuscle ? [rawMuscle] : [];
  for (const r of raws) {
    const hit = canonicalFromRaw(r);
    if (hit) return hit;
  }
  return bodyPartFromName(name);
}

export function colorForBodyPart(part: string): string {
  return BODY_PART_COLORS[part as BodyPart] ?? BODY_PART_COLORS.Other;
}
