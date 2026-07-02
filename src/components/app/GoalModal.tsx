"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, X } from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useConfig } from "@/lib/config/ConfigContext";
import { useOnboardingProfile } from "@/lib/hooks/useOnboardingProfile";
import { saveProfile, saveWeight } from "@/lib/db/userDb";
import { todayPacificKey } from "@/lib/firebase/dining";
import { weeklyChangeFromGoal, dailyTargetCalories } from "@/lib/utils/nutrition";
import type { GoalPhase, UserProfile } from "@/lib/db/types";

interface GoalModalProps {
  open: boolean;
  initial?: UserProfile | null;
  initialBudget?: number;
  onClose: () => void;
}

const PHASE_OPTIONS: { value: GoalPhase; label: string; description: string }[] = [
  { value: "cut", label: "Cut", description: "Lose fat" },
  { value: "maintain", label: "Maintain", description: "Stay steady" },
  { value: "bulk", label: "Bulk", description: "Build muscle" },
];

export function GoalModal({ open, initial, initialBudget = 37, onClose }: GoalModalProps) {
  const handle = useUserDb();
  const { dailyBudget, setDailyBudget } = useConfig();
  const { profile: setupProfile } = useOnboardingProfile();

  const [currentWeight, setCurrentWeight] = useState(
    initial?.current_weight ? String(initial.current_weight) : "",
  );
  const [goalWeight, setGoalWeight] = useState(
    initial?.goal_weight ? String(initial.goal_weight) : "",
  );
  const [months, setMonths] = useState(
    initial?.months_to_goal ? String(initial.months_to_goal) : "3",
  );
  const [phase, setPhase] = useState<GoalPhase>(initial?.phase ?? "maintain");
  const [budget, setBudget] = useState(String(dailyBudget || initialBudget));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setBudget(String(dailyBudget || initialBudget));
  }, [open, dailyBudget, initialBudget]);

  const prevInitialRef = useRef(initial);
  useEffect(() => {
    if (initial && initial !== prevInitialRef.current) {
      prevInitialRef.current = initial;
      if (!currentWeight) setCurrentWeight(String(initial.current_weight ?? ""));
      if (!goalWeight) setGoalWeight(String(initial.goal_weight ?? ""));
      if (!months) setMonths(String(initial.months_to_goal ?? 3));
      setPhase(initial.phase ?? "maintain");
    }
  }, [initial, currentWeight, goalWeight, months]);

  const preview = useMemo(() => {
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const mo = parseInt(months, 10);
    if (!cw || !gw || !mo) return null;
    const weekly = weeklyChangeFromGoal(cw, gw, mo);
    const kcal = dailyTargetCalories(cw, weekly);
    const direction = weekly > 0.02 ? "surplus" : weekly < -0.02 ? "deficit" : "maintenance";
    return { weekly, kcal, direction };
  }, [currentWeight, goalWeight, months]);

  async function handleSave() {
    if (!handle) return;
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const mo = parseInt(months, 10);
    const bud = setupProfile ? dailyBudget : parseFloat(budget);

    if (!cw || cw <= 0) return setError("Enter a valid current weight.");
    if (!gw || gw <= 0) return setError("Enter a valid goal weight.");
    if (!mo || mo <= 0) return setError("Enter valid months (1 to 24).");
    if (!setupProfile && (!bud || bud <= 0)) return setError("Enter a valid daily budget.");

    setError(null);
    setSaving(true);
    try {
      const { db, uid } = handle;
      const today = todayPacificKey();
      const weeklyChange = weeklyChangeFromGoal(cw, gw, mo);

      const goalChanged =
        !initial?.goal_start_date ||
        initial.goal_weight !== gw ||
        initial.months_to_goal !== mo;
      const goalStartDate = goalChanged ? today : initial.goal_start_date;
      const goalStartWeight = goalChanged ? cw : (initial.goal_start_weight ?? cw);

      await saveProfile(db, uid, {
        current_weight: cw,
        goal_weight: gw,
        months_to_goal: mo,
        phase,
        target_weekly_change_lbs: weeklyChange,
        goal_start_date: goalStartDate,
        goal_start_weight: goalStartWeight,
      });

      await saveWeight(db, uid, today, cw);

      if (!setupProfile) setDailyBudget(bud);

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set your goals"
        className="animate-rise glass-panel fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5 shadow-[var(--shadow-lg)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />

        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-extrabold text-ink">Your Goals</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full bg-surface-3 text-ink-soft"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex gap-3">
            {!setupProfile && <label className="block flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
                Current (lbs)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={50}
                max={500}
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="135"
                className="w-full rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
            </label>}
            <label className="block flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
                Goal (lbs)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={50}
                max={500}
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                placeholder="170"
                className="w-full rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-soft">
              Goal phase
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PHASE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPhase(opt.value)}
                  className={`flex flex-col items-center rounded-[14px] border px-3 py-3 text-center transition ${
                    phase === opt.value
                      ? "border-accent bg-accent-soft font-bold text-accent-ink"
                      : "border-line bg-surface-2 text-ink-soft"
                  }`}
                >
                  <span className="text-[13px] font-bold">{opt.label}</span>
                  <span className="mt-0.5 text-[10px] font-normal opacity-70">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
                Timeframe (months)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                placeholder="3"
                className="w-full rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
                Daily budget ($)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={200}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="37"
                className="w-full rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
            </label>
          </div>

          {preview && (
            <div className="flex items-center gap-3 rounded-[16px] border border-accent/25 bg-accent-soft/60 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
                <Flame className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="font-display text-[20px] font-extrabold text-ink">
                  {preview.kcal.toLocaleString()} kcal<span className="text-[12px] font-semibold text-ink-soft">/day</span>
                </p>
                <p className="text-[11px] text-ink-soft">
                  {preview.direction === "maintenance"
                    ? "Maintenance calories"
                    : `${Math.abs(preview.weekly).toFixed(1)} lb/week ${preview.direction === "surplus" ? "gain" : "loss"} target`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-1 w-full rounded-[14px] bg-accent py-3.5 text-[15px] font-bold text-accent-contrast shadow-[var(--shadow-md)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Goals"}
          </button>
        </div>
      </div>
    </>
  );
}
