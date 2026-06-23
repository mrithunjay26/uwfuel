"use client";

import { useMemo, useState } from "react";
import { Activity, Check, Flame, Pencil, Trash2, Utensils, X, Zap } from "lucide-react";
import { useWeightLog } from "@/lib/hooks/useWeightLog";
import { useAllLogs } from "@/lib/hooks/useAllLogs";
import { useFoodLog, type FoodLogItem } from "@/lib/hooks/useFoodLog";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { saveWeight, deleteLogEntry, updateLogEntry } from "@/lib/db/userDb";
import { dailyTargetCalories, formatMoney } from "@/lib/utils/nutrition";
import { computeGoalAssessment } from "@/lib/utils/goals";
import { todayPacificKey } from "@/lib/firebase/dining";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { GoalTracker } from "@/components/app/GoalTracker";
import { LoggedFoodSheet } from "@/components/app/LoggedFoodSheet";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_LABELS: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

function daysForRange(range: Range): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 9999;
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

function Sparkline({ data, width = 300, height = 60, color = "var(--color-accent)", filled = false }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * w,
    y: pad + h - ((v - min) / range) * h,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const fillD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad + h).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad + h).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {filled && (
        <path d={fillD} fill={color} fillOpacity={0.12} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill={color} />
    </svg>
  );
}

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  target?: number;
  height?: number;
}

function BarChart({ data, target, height = 100 }: BarChartProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1);
  const barW = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {target != null && (
        <line
          x1={0} y1={height - (target / max) * height}
          x2={100} y2={height - (target / max) * height}
          stroke="var(--color-danger)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {data.map((d, i) => {
        const barH = (d.value / max) * height;
        const x = i * barW + barW * 0.1;
        const w = barW * 0.8;
        const color = d.color || "var(--color-accent)";
        return (
          <rect
            key={i}
            x={x} y={height - barH}
            width={w} height={barH}
            fill={color}
            fillOpacity={0.8}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

function WeightInput({ onSave }: { onSave: (w: number) => Promise<void> }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(val);
    if (!w || w < 50 || w > 600) return;
    setSaving(true);
    await onSave(w);
    setVal("");
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={50}
        max={600}
        placeholder="Weight (lbs)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />
      <button
        type="submit"
        disabled={saving || !val}
        className="rounded-[12px] bg-accent px-4 py-2.5 text-[13px] font-bold text-accent-contrast disabled:opacity-50"
      >
        {saving ? "…" : "Log"}
      </button>
    </form>
  );
}

function MacroRing({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(1, target > 0 ? value / target : 0);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative size-[72px]">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90">
          <circle cx={36} cy={36} r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth={5} />
          <circle
            cx={36} cy={36} r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-extrabold text-ink">{Math.round(value)}</span>
          <span className="text-[8px] text-ink-faint">{label === "Fat" ? "g" : label === "Carbs" ? "g" : "g"}</span>
        </div>
      </div>
      <span className="text-[11px] font-bold text-ink-soft">{label}</span>
      <span className="text-[10px] text-ink-faint">/ {target}g</span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "text-accent",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="glass-panel flex-1 rounded-[18px] p-4">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="font-display text-[22px] font-extrabold text-ink leading-none">{value}</p>
      <p className="mt-1 text-[12px] font-semibold text-ink-soft">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}

export default function ProgressPage() {
  const handle = useUserDb();
  const { profile } = useUserProfile();
  const { points: weightPoints, latest: latestWeight } = useWeightLog();
  const { days: logDays, loading: logsLoading } = useAllLogs();
  const [range, setRange] = useState<Range>("30d");
  const today = todayPacificKey();
  const { entries: todayEntries } = useFoodLog(today);
  const [foodDetail, setFoodDetail] = useState<FoodLogItem | null>(null);

  async function handleDeleteFood(id: string) {
    if (!handle) return;
    await deleteLogEntry(handle.db, handle.uid, today, id).catch(() => {});
  }
  async function handleUpdateFood(id: string, patch: Partial<FoodLogItem>) {
    if (!handle) return;
    await updateLogEntry(handle.db, handle.uid, today, id, patch).catch(() => {});
  }

  const filteredDays = useMemo(() => {
    const maxDays = daysForRange(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    return logDays.filter((d) => d.dateKey >= cutoffKey);
  }, [logDays, range]);

  const filteredWeightPts = useMemo(() => {
    const maxDays = daysForRange(range);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    return weightPoints.filter((p) => p.dateKey >= cutoffKey);
  }, [weightPoints, range]);

  const targetKcal = useMemo(() => {
    if (!profile) return 2400;
    return dailyTargetCalories(profile.current_weight, profile.target_weekly_change_lbs ?? 0);
  }, [profile]);

  const todayStats = logDays.find((d) => d.dateKey === today);
  const todayCal = todayStats?.calories ?? 0;
  const todayProtein = todayStats?.protein ?? 0;
  const todayCarbs = todayStats?.carbs ?? 0;
  const todayFat = todayStats?.fat ?? 0;

  const proteinTarget = Math.round((targetKcal * 0.30) / 4);
  const carbsTarget = Math.round((targetKcal * 0.40) / 4);
  const fatTarget = Math.round((targetKcal * 0.30) / 9);

  const streak = useMemo(() => {
    if (logDays.length === 0) return 0;
    let count = 0;
    const sortedKeys = [...logDays].reverse().map((d) => d.dateKey);
    const base = sortedKeys[0] === today ? 0 : -1;
    if (base < 0) return 0;
    for (let i = 0; i < sortedKeys.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedKey = expected.toISOString().slice(0, 10);
      if (sortedKeys[i] === expectedKey) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [logDays, today]);

  const avg = useMemo(() => {
    if (filteredDays.length === 0) return { calories: 0, protein: 0, cost: 0 };
    const n = filteredDays.length;
    return {
      calories: Math.round(filteredDays.reduce((s, d) => s + d.calories, 0) / n),
      protein: Math.round(filteredDays.reduce((s, d) => s + d.protein, 0) / n),
      cost: filteredDays.reduce((s, d) => s + d.cost, 0) / n,
    };
  }, [filteredDays]);

  const weightTrend = useMemo(() => {
    if (filteredWeightPts.length < 2) return null;
    const first = filteredWeightPts[0].weight;
    const last = filteredWeightPts[filteredWeightPts.length - 1].weight;
    return { delta: last - first, direction: last > first ? "up" : "down" };
  }, [filteredWeightPts]);

  const bmi = useMemo(() => {
    if (!latestWeight || !profile) return null;
    const heightIn = 68;
    const bmiVal = (latestWeight.weight / (heightIn * heightIn)) * 703;
    return Math.round(bmiVal * 10) / 10;
  }, [latestWeight, profile]);

  const bmiCategory = bmi
    ? bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese"
    : null;

  const goalAssessment = useMemo(
    () =>
      computeGoalAssessment(
        profile ?? null,
        weightPoints.map((p) => ({ dateKey: p.dateKey, weight: p.weight })),
        latestWeight?.weight ?? null,
      ),
    [profile, weightPoints, latestWeight],
  );

  async function handleLogWeight(w: number) {
    if (!handle) return;
    await saveWeight(handle.db, handle.uid, today, w);
  }

  const calData = filteredDays.map((d) => d.calories);
  const proteinData = filteredDays.map((d) => d.protein);
  const costData = filteredDays.map((d) => d.cost);
  const weightData = filteredWeightPts.map((p) => p.weight);

  const barData = filteredDays.slice(-14).map((d) => ({
    label: d.dateKey.slice(5),
    value: d.calories,
    color: d.calories >= targetKcal * 0.9 && d.calories <= targetKcal * 1.1
      ? "var(--color-success)"
      : d.calories > targetKcal * 1.1
      ? "var(--color-danger)"
      : "var(--color-accent)",
  }));

  return (
    <div className="pb-8">
      <AuroraHeader
        title="Progress"
        subtitle={profile ? `${profile.phase} · ${latestWeight?.weight ?? profile.current_weight} lbs` : "Log data to see trends"}
        icon={<Activity className="size-[18px]" />}
        right={streak > 0 ? (
          <div className="glass-soft flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <span className="text-[16px]">🔥</span>
            <span className="font-display text-[15px] font-extrabold text-ink">{streak}</span>
            <span className="text-[11px] font-semibold text-ink-soft">days</span>
          </div>
        ) : undefined}
      />

      <div className="flex flex-col gap-5 px-5 pt-5">

        <div className="flex gap-1.5">
          {RANGE_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`flex-1 rounded-[10px] py-2 text-[12px] font-bold transition ${
                range === value ? "bg-accent text-accent-contrast" : "bg-surface text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <section>
          <h2 className="mb-3 font-display text-[16px] font-extrabold text-ink">Today&apos;s Macros</h2>
          <div className="glass-panel rounded-[20px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-display text-[28px] font-extrabold text-ink leading-none">{todayCal}</p>
                <p className="text-[12px] text-ink-soft">of {targetKcal} kcal target</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-ink-soft">
                  {todayCal >= targetKcal * 0.9 && todayCal <= targetKcal * 1.1 ? "✅ On track" :
                   todayCal > targetKcal ? "⚠️ Over" : "📉 Under"}
                </p>
                <p className="text-[11px] text-ink-faint">{Math.abs(targetKcal - todayCal)} kcal {todayCal > targetKcal ? "over" : "left"}</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-line-strong">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, (todayCal / targetKcal) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-around">
              <MacroRing label="Protein" value={todayProtein} target={proteinTarget} color="var(--color-protein)" />
              <MacroRing label="Carbs" value={todayCarbs} target={carbsTarget} color="var(--color-carbs)" />
              <MacroRing label="Fat" value={todayFat} target={fatTarget} color="var(--color-flame)" />
            </div>
          </div>
        </section>

        {todayEntries.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-extrabold text-ink">Today&apos;s Food</h2>
              <span className="text-[12px] text-ink-faint">
                {todayEntries.length} item{todayEntries.length === 1 ? "" : "s"} ·{" "}
                {formatMoney(todayEntries.reduce((s, e) => s + (e.price || 0), 0))}
              </span>
            </div>
            <div className="glass-panel rounded-[20px] p-2.5">
              <div className="flex flex-col gap-1.5">
                {todayEntries.map((e) => (
                  <FoodLogRow
                    key={e.id}
                    entry={e}
                    onDelete={handleDeleteFood}
                    onUpdate={handleUpdateFood}
                    onOpen={setFoodDetail}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="flex gap-3">
          <StatCard
            icon={<Flame className="size-5" />}
            label={`Avg cal (${range})`}
            value={avg.calories ? String(avg.calories) : "N/A"}
            sub={`target ${targetKcal}`}
            color="text-flame"
          />
          <StatCard
            icon={<Zap className="size-5" />}
            label={`Avg protein (${range})`}
            value={avg.protein ? `${avg.protein}g` : "N/A"}
            sub={`target ${proteinTarget}g`}
            color="text-accent"
          />
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-extrabold text-ink">Weight</h2>
            {latestWeight && (
              <span className="text-[13px] font-bold text-ink">
                {latestWeight.weight} lbs
                {weightTrend && (
                  <span className={`ml-1.5 text-[12px] ${weightTrend.direction === "up" ? "text-protein" : "text-carbs"}`}>
                    {weightTrend.direction === "up" ? "▲" : "▼"} {Math.abs(weightTrend.delta).toFixed(1)}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="glass-panel rounded-[20px] p-4">
            {weightData.length >= 2 ? (
              <Sparkline data={weightData} height={80} color="var(--color-protein)" filled />
            ) : (
              <p className="py-4 text-center text-[13px] text-ink-faint">Log weight below to see your trend</p>
            )}

            {filteredWeightPts.length >= 2 && (
              <div className="mt-1 flex justify-between">
                <span className="text-[10px] text-ink-faint">{filteredWeightPts[0].dateKey.slice(5)}</span>
                <span className="text-[10px] text-ink-faint">{filteredWeightPts[filteredWeightPts.length - 1].dateKey.slice(5)}</span>
              </div>
            )}

            <div className="mt-3">
              <WeightInput onSave={handleLogWeight} />
            </div>
          </div>

          {bmi && (
            <div className="mt-3 flex items-center justify-between rounded-[16px] bg-lav-soft px-4 py-3">
              <span className="text-[13px] font-bold text-ink">BMI</span>
              <span className="text-[12px] text-ink-soft">
                <b className="font-semibold text-ink">{bmi}</b>{" "}
                <span className={`font-semibold ${bmi < 18.5 ? "text-warning" : bmi < 25 ? "text-success" : "text-danger"}`}>
                  ({bmiCategory})
                </span>
              </span>
            </div>
          )}
        </section>

        {goalAssessment && (
          <GoalTracker
            assessment={goalAssessment}
            months={profile?.months_to_goal ?? 3}
            phase={profile?.phase ?? "maintain"}
            nutrition={{
              avgCalories: avg.calories,
              targetCalories: targetKcal,
              avgProtein: avg.protein,
              proteinTarget,
            }}
          />
        )}

        {filteredDays.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-extrabold text-ink">Calorie Trend</h2>
              <span className="text-[12px] text-ink-faint">{filteredDays.length} days</span>
            </div>
            <div className="glass-panel rounded-[20px] p-4">
              <Sparkline data={calData} height={70} color="var(--color-accent)" filled />
              {filteredDays.length >= 2 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-[10px] text-ink-faint">{filteredDays[0].dateKey.slice(5)}</span>
                  <span className="text-[10px] text-ink-faint">{filteredDays[filteredDays.length - 1].dateKey.slice(5)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {barData.length >= 3 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-extrabold text-ink">Last 14 Days</h2>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-success" /> On target</span>
                <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-danger" /> Over</span>
                <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-accent" /> Under</span>
              </div>
            </div>
            <div className="glass-panel rounded-[20px] p-4">
              <BarChart data={barData} target={targetKcal} height={100} />
              <div className="mt-2 flex justify-between">
                <span className="text-[10px] text-ink-faint">{barData[0]?.label}</span>
                <span className="text-[10px] text-ink-faint">Target: {targetKcal}</span>
                <span className="text-[10px] text-ink-faint">{barData[barData.length - 1]?.label}</span>
              </div>
            </div>
          </section>
        )}

        {proteinData.length > 1 && (
          <section>
            <h2 className="mb-3 font-display text-[16px] font-extrabold text-ink">Protein Trend</h2>
            <div className="glass-panel rounded-[20px] p-4">
              <Sparkline data={proteinData} height={60} color="var(--color-protein)" />
              <p className="mt-2 text-[12px] text-ink-soft">
                avg <b className="font-semibold text-ink">{avg.protein}g</b> · target <b className="font-semibold text-ink">{proteinTarget}g</b>
              </p>
            </div>
          </section>
        )}

        {costData.length > 1 && (
          <section>
            <h2 className="mb-3 font-display text-[16px] font-extrabold text-ink">Dining Spend</h2>
            <div className="flex gap-3">
              <div className="glass-panel flex-1 rounded-[18px] p-4">
                <p className="font-display text-[22px] font-extrabold text-ink">
                  ${avg.cost.toFixed(2)}
                </p>
                <p className="mt-1 text-[12px] text-ink-soft">avg per day</p>
              </div>
              <div className="glass-panel flex-1 rounded-[18px] p-4">
                <p className="font-display text-[22px] font-extrabold text-ink">
                  ${filteredDays.reduce((s, d) => s + d.cost, 0).toFixed(2)}
                </p>
                <p className="mt-1 text-[12px] text-ink-soft">total ({range})</p>
              </div>
            </div>
            <div className="mt-3 glass-panel rounded-[20px] p-4">
              <Sparkline data={costData} height={50} color="var(--color-carbs)" />
            </div>
          </section>
        )}

        {latestWeight && profile && (
          <section>
            <h2 className="mb-3 font-display text-[16px] font-extrabold text-ink">Body Est.</h2>
            <div className="glass-panel rounded-[20px] p-4">
              <p className="mb-3 text-[12px] text-ink-soft">
                Rough estimates based on weight, BMI, and phase. Not medical advice.
              </p>
              <BodyCompositionBars weight={latestWeight.weight} bmi={bmi} phase={profile.phase} />
            </div>
          </section>
        )}

        {!logsLoading && logDays.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
            <span className="text-4xl">📊</span>
            <p className="mt-3 font-display text-[16px] font-extrabold text-ink">No data yet</p>
            <p className="mt-1 text-[13px] text-ink-soft">Log meals in the Dining tab to see your progress here.</p>
          </div>
        )}

      </div>

      <LoggedFoodSheet
        entry={foodDetail}
        onClose={() => setFoodDetail(null)}
        onDelete={(id) => { handleDeleteFood(id); }}
      />
    </div>
  );
}

function BodyCompositionBars({
  weight,
  bmi,
  phase,
}: {
  weight: number;
  bmi: number | null;
  phase: string;
}) {
  const estimatedBF = bmi
    ? phase === "bulk"
      ? Math.round(bmi * 0.9 - 5)
      : phase === "cut"
      ? Math.round(bmi * 0.9 - 7)
      : Math.round(bmi * 0.9 - 6)
    : null;

  const clampedBF = estimatedBF ? Math.max(5, Math.min(40, estimatedBF)) : 15;
  const leanMass = Math.round(weight * (1 - clampedBF / 100));
  const fatMass = Math.round(weight * (clampedBF / 100));

  const bars = [
    { label: "Lean", value: leanMass, total: weight, color: "var(--color-accent)" },
    { label: "Fat", value: fatMass, total: weight, color: "var(--color-flame)" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {bars.map(({ label, value, total, color }) => (
        <div key={label}>
          <div className="mb-1 flex justify-between">
            <span className="text-[12px] font-semibold text-ink">{label} mass</span>
            <span className="text-[12px] font-semibold text-ink">{value} lbs ({Math.round((value / total) * 100)}%)</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line-strong">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(value / total) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
      <p className="mt-1 text-[11px] text-ink-faint">
        ~{clampedBF}% body fat (rough estimate)
        {bmi ? ` · BMI ${bmi}` : ""}
      </p>
    </div>
  );
}

function FoodLogRow({
  entry,
  onDelete,
  onUpdate,
  onOpen,
}: {
  entry: FoodLogItem;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FoodLogItem>) => void;
  onOpen?: (entry: FoodLogItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const [cal, setCal] = useState(String(Math.round(entry.calories)));
  const [pro, setPro] = useState(String(Math.round(entry.protein_grams)));
  const [price, setPrice] = useState(String(entry.price ?? 0));

  function save() {
    onUpdate(entry.id, {
      name: name.trim() || entry.name,
      calories: parseFloat(cal) || 0,
      protein_grams: parseFloat(pro) || 0,
      price: parseFloat(price) || 0,
    });
    setEditing(false);
  }
  function cancel() {
    setName(entry.name);
    setCal(String(Math.round(entry.calories)));
    setPro(String(Math.round(entry.protein_grams)));
    setPrice(String(entry.price ?? 0));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-[14px] bg-surface-2 p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-accent"
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([
            { label: "Cal", value: cal, set: setCal },
            { label: "Protein g", value: pro, set: setPro },
            { label: "Cost $", value: price, set: setPrice },
          ] as const).map(({ label, value, set }) => (
            <label key={label} className="block">
              <span className="block text-[10px] font-semibold text-ink-soft">{label}</span>
              <input
                type="number"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="mt-0.5 w-full rounded-[10px] border border-line bg-surface px-2 py-1.5 text-center text-[13px] text-ink outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={save}
            className="press flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-accent py-2 text-[12px] font-bold text-accent-contrast"
          >
            <Check className="size-3.5" /> Save
          </button>
          <button
            onClick={cancel}
            className="press flex items-center justify-center gap-1 rounded-[10px] bg-surface-3 px-3 py-2 text-[12px] font-bold text-ink-soft"
          >
            <X className="size-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[14px] bg-surface-2/70 px-3 py-2.5">
      <button
        onClick={() => onOpen?.(entry)}
        className="press flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={`Details for ${entry.name}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-ink-soft">
          <Utensils className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{entry.name}</span>
          <span className="block truncate text-[11px] text-ink-soft">
            {Math.round(entry.calories)} cal · {Math.round(entry.protein_grams)}g protein · {formatMoney(entry.price)}
            {entry.location_name ? ` · ${entry.location_name}` : ""}
          </span>
        </span>
      </button>
      <button
        onClick={() => setEditing(true)}
        aria-label={`Edit ${entry.name}`}
        className="press grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:text-accent"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        onClick={() => onDelete(entry.id)}
        aria-label={`Delete ${entry.name}`}
        className="press grid size-8 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
