import type { UserProfile } from "@/lib/db/types";

const WEEKS_PER_MONTH = 4.345;
const GOAL_TOLERANCE_LBS = 1;

export type GoalStatus =
  | "no_goal"
  | "no_data"
  | "achieved"
  | "ahead"
  | "on_track"
  | "behind"
  | "off_track"
  | "deadline_passed";

export interface GoalTrend {
  dateKey: string;
  weight: number;
}

export interface GoalAssessment {
  status: GoalStatus;
  direction: "gain" | "lose" | "maintain";
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
  remainingLbs: number;
  progressPct: number;
  weeksTotal: number;
  weeksElapsed: number;
  weeksLeft: number;
  targetDate: Date;
  requiredRate: number;
  actualRate: number | null;
  projectedWeight: number | null;
  projectedGap: number | null;
  headline: string;
  detail: string;
}

function parseDateKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function weeklyRate(points: GoalTrend[]): number | null {
  if (points.length < 2) return null;
  const t0 = parseDateKey(points[0].dateKey);
  const xs = points.map((p) => (parseDateKey(p.dateKey) - t0) / 86_400_000);
  const ys = points.map((p) => p.weight);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return ((n * sxy - sx * sy) / denom) * 7;
}

export function computeGoalAssessment(
  profile: UserProfile | null,
  trend: GoalTrend[],
  latestWeight: number | null,
): GoalAssessment | null {
  if (!profile || !profile.goal_weight || !profile.months_to_goal) return null;

  const sorted = [...trend].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const startWeight =
    profile.goal_start_weight ?? sorted[0]?.weight ?? profile.current_weight;
  const goalWeight = profile.goal_weight;
  const currentWeight = latestWeight ?? sorted[sorted.length - 1]?.weight ?? profile.current_weight;

  // Anchor the countdown to the stored goal start date. Do NOT fall back to the
  // first weight entry — that can be months in the past and pushes the target
  // date behind "now", freezing the weeks-left countdown at 0.
  const startMs = profile.goal_start_date ? parseDateKey(profile.goal_start_date) : Date.now();
  const weeksTotal = profile.months_to_goal * WEEKS_PER_MONTH;
  const targetMs = startMs + weeksTotal * 7 * 86_400_000;
  const now = Date.now();
  const weeksElapsed = Math.max(0, (now - startMs) / (7 * 86_400_000));
  const weeksLeft = Math.max(0, (targetMs - now) / (7 * 86_400_000));

  const totalChange = goalWeight - startWeight;
  const changeSoFar = currentWeight - startWeight;
  const remaining = goalWeight - currentWeight;

  const direction: GoalAssessment["direction"] =
    Math.abs(totalChange) < 0.5 ? "maintain" : totalChange > 0 ? "gain" : "lose";

  const progressPct =
    Math.abs(totalChange) < 0.5
      ? Math.abs(remaining) <= GOAL_TOLERANCE_LBS ? 1 : 0
      : Math.min(1, Math.max(0, changeSoFar / totalChange));

  const requiredRate = weeksLeft > 0.1 ? remaining / weeksLeft : remaining;

  const recentCutoff = now - 56 * 86_400_000;
  const recentPoints = sorted.filter((p) => parseDateKey(p.dateKey) >= recentCutoff);
  const actualRate = weeklyRate(recentPoints.length >= 2 ? recentPoints : sorted);

  const projectedWeight = actualRate != null ? currentWeight + actualRate * weeksLeft : null;
  const projectedGap = projectedWeight != null ? projectedWeight - goalWeight : null;

  let status: GoalStatus;
  if (Math.abs(remaining) <= GOAL_TOLERANCE_LBS) {
    status = "achieved";
  } else if (weeksLeft <= 0.1) {
    status = "deadline_passed";
  } else if (actualRate == null) {
    status = "no_data";
  } else {
    const movingRightWay =
      direction === "maintain"
        ? Math.abs(actualRate) <= 0.25
        : direction === "gain"
          ? actualRate > 0.05
          : actualRate < -0.05;
    if (!movingRightWay) {
      status = "off_track";
    } else if (projectedGap != null) {
      const overshoot = direction === "lose" ? projectedGap < -GOAL_TOLERANCE_LBS : projectedGap > GOAL_TOLERANCE_LBS;
      const shortfall = direction === "lose" ? projectedGap > GOAL_TOLERANCE_LBS : projectedGap < -GOAL_TOLERANCE_LBS;
      status = overshoot ? "ahead" : shortfall ? "behind" : "on_track";
    } else {
      status = "on_track";
    }
  }

  const headline = headlineFor(status, direction);
  const detail = detailFor({ status, direction, weeksLeft, requiredRate, actualRate, projectedWeight, goalWeight });

  return {
    status,
    direction,
    startWeight,
    currentWeight,
    goalWeight,
    remainingLbs: remaining,
    progressPct,
    weeksTotal,
    weeksElapsed,
    weeksLeft,
    targetDate: new Date(targetMs),
    requiredRate,
    actualRate,
    projectedWeight,
    projectedGap,
    headline,
    detail,
  };
}

function headlineFor(status: GoalStatus, direction: GoalAssessment["direction"]): string {
  switch (status) {
    case "achieved": return "Goal reached";
    case "ahead": return "Ahead of schedule";
    case "on_track": return "On track";
    case "behind": return "Slightly behind";
    case "off_track": return direction === "maintain" ? "Drifting from maintenance" : "Off track";
    case "deadline_passed": return "Deadline reached";
    case "no_data": return "Log your weight to track this";
    default: return "Set a goal";
  }
}

function detailFor(p: {
  status: GoalStatus;
  direction: GoalAssessment["direction"];
  weeksLeft: number;
  requiredRate: number;
  actualRate: number | null;
  projectedWeight: number | null;
  goalWeight: number;
}): string {
  const weeks = Math.max(0, Math.round(p.weeksLeft));
  const need = Math.abs(p.requiredRate).toFixed(1);
  const verb = p.direction === "lose" ? "lose" : p.direction === "gain" ? "gain" : "hold within";
  switch (p.status) {
    case "achieved":
      return "You hit your target weight. Set a new goal to keep the momentum.";
    case "on_track":
      return `Keep your current pace and you will land on target in about ${weeks} weeks.`;
    case "ahead":
      return p.projectedWeight != null
        ? `At this pace you reach your goal early (projected ${p.projectedWeight.toFixed(1)} lbs).`
        : "You are moving faster than required.";
    case "behind":
      return `To still finish on time, aim to ${verb} about ${need} lb/week for the next ${weeks} weeks.`;
    case "off_track":
      return p.direction === "maintain"
        ? "Your weight is drifting. Tighten calories to settle back to maintenance."
        : `You are moving the wrong way. Aim to ${verb} about ${need} lb/week to recover.`;
    case "deadline_passed":
      return "Your timeframe is up. Update the goal to set a fresh target date.";
    case "no_data":
      return "Add at least two weight entries so we can read your trend.";
    default:
      return "";
  }
}
