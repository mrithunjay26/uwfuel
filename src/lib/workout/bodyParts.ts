export const BODY_PARTS = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Glutes",
  "Core",
  "Cardio",
  "Full Body",
  "Other",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

export const BODY_PART_COLORS: Record<BodyPart, string> = {
  Chest: "#ef4444",
  Back: "#3b82f6",
  Shoulders: "#f59e0b",
  Arms: "#8b7cf6",
  Legs: "#22c55e",
  Glutes: "#14b8a6",
  Core: "#d946ef",
  Cardio: "#f472b6",
  "Full Body": "#64748b",
  Other: "#a3a3a3",
};

const MUSCLE_TO_PART: [RegExp, BodyPart][] = [
  [/pec|chest|sternal|clavicular/, "Chest"],
  [/lat|latissimus|trap|trapezius|rhomboid|erector|spinae|teres|infraspinatus|lower back|upper back|\bback\b/, "Back"],
  [/delt|shoulder|rotator/, "Shoulders"],
  [/bicep|tricep|brachi|forearm|wrist|\barm\b/, "Arms"],
  [/glute|gluteus|hip/, "Glutes"],
  [/quad|hamstring|calf|calves|soleus|gastrocnemius|adductor|abductor|thigh|\bleg\b|\bknee\b/, "Legs"],
  [/\bab\b|abs|abdominal|oblique|core|transverse|serratus/, "Core"],
  [/cardio|cardiovascular|heart/, "Cardio"],
  [/full body|total body|olympic/, "Full Body"],
];

const NAME_RULES: [RegExp, BodyPart][] = [
  [/cardio|run|jog|sprint|treadmill|cycl|bike|elliptical|rowing machine|jump rope|jumping jack|burpee|stair|sled|battle rope|\bhiit\b/, "Cardio"],
  [/shoulder|overhead press|\bohp\b|military press|arnold|lateral raise|front raise|rear delt|reverse fly|upright row|face pull|shrug/, "Shoulders"],
  [/bicep|tricep|curl|pushdown|press[- ]?down|skullcrusher|skull crusher|kickback|hammer|preacher|concentration|forearm|wrist|\bdip\b/, "Arms"],
  [/squat|lunge|leg press|leg curl|leg extension|calf|quad|hamstring|hack|step[- ]?up|split squat|wall sit|adductor|abductor|hip thrust|glute|good morning|romanian|\brdl\b|stiff[- ]?leg/, "Legs"],
  [/bench|chest|incline press|decline press|push[- ]?up|pushup|pec|fly|flye|cable cross|dumbbell press|\bdips? \(chest/, "Chest"],
  [/row|pull[- ]?up|pull[- ]?down|chin[- ]?up|lat |deadlift|pullover|pull[- ]?over|back extension|\bpull\b/, "Back"],
  [/plank|crunch|sit[- ]?up|situp|oblique|russian twist|leg raise|knee raise|hanging|\babs?\b|hollow|dead bug|mountain climber|woodchop/, "Core"],
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
