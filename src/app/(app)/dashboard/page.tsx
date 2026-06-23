"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Boxes, CalendarDays, Camera, ChevronLeft, ChevronRight, Sparkles, Target, User } from "lucide-react";
import { Ring } from "@/components/ui/Ring";
import { GoalModal } from "@/components/app/GoalModal";
import { JournalCard } from "@/components/app/JournalCard";
import { LoggedFoodSheet } from "@/components/app/LoggedFoodSheet";
import { MealScannerSheet } from "@/components/app/MealScannerSheet";
import { FoodInventorySheet } from "@/components/app/FoodInventorySheet";
import { MealCalendarSheet } from "@/components/app/MealCalendarSheet";
import { SCAN_ENABLED } from "@/lib/nutrition/scan";
import { useAuth } from "@/lib/auth/AuthContext";
import { useConfig } from "@/lib/config/ConfigContext";
import { useFoodLog, type FoodLogItem } from "@/lib/hooks/useFoodLog";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useWeightLog } from "@/lib/hooks/useWeightLog";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { deleteLogEntry, logFoodItem, updateLogEntry, saveInventoryFood } from "@/lib/db/userDb";
import { todayPacificKey } from "@/lib/firebase/dining";
import type { FoodLogEntry, InventoryFood } from "@/lib/db/types";
import {
  dailyTargetCalories,
  macroTargetsFromCalories,
  formatMoney,
} from "@/lib/utils/nutrition";
import { computeGoalAssessment } from "@/lib/utils/goals";

const MACRO_BARS: {
  key: "protein" | "carbs" | "fat";
  label: string;
  color: string;
}[] = [
  { key: "protein", label: "Protein", color: "bg-protein" },
  { key: "carbs", label: "Carbs", color: "bg-carbs" },
  { key: "fat", label: "Fat", color: "bg-fat" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const handle = useUserDb();
  const { dailyBudget, hasCohere } = useConfig();
  const { profile, loading: profileLoading } = useUserProfile();
  const today = todayPacificKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const { entries, totals, loading: logLoading } = useFoodLog(selectedDate);
  const { latest: latestWeight, points: weightPoints } = useWeightLog();

  const goalAssessment = useMemo(
    () =>
      computeGoalAssessment(
        profile ?? null,
        weightPoints.map((p) => ({ dateKey: p.dateKey, weight: p.weight })),
        latestWeight?.weight ?? null,
      ),
    [profile, weightPoints, latestWeight],
  );

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [foodDetail, setFoodDetail] = useState<FoodLogItem | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);

  const isToday = selectedDate === today;
  const dayLabel = isToday
    ? "Today"
    : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (key <= today) setSelectedDate(key);
  }

  async function logToDay(entry: Omit<FoodLogEntry, "logged_at">) {
    if (!handle) return;
    try { await logFoodItem(handle.db, handle.uid, selectedDate, entry); } catch {}
  }
  function logInventoryFood(food: InventoryFood) {
    void logToDay({
      name: food.name,
      description: food.serving ? `${food.serving} · saved food` : "Saved food",
      calories: food.calories,
      protein_grams: food.protein_grams,
      carbs_grams: food.carbs_grams ?? 0,
      fat_grams: food.fat_grams ?? 0,
      price: food.price ?? 0,
      location_id: "inventory",
      location_name: food.name,
      is_custom: true,
    });
  }
  async function handleSaveEdit(id: string, patch: Partial<Omit<FoodLogEntry, "logged_at">>) {
    if (!handle) return;
    try { await updateLogEntry(handle.db, handle.uid, selectedDate, id, patch); } catch {}
  }
  async function saveEntryToInventory(entry: FoodLogItem) {
    if (!handle) return;
    try {
      await saveInventoryFood(handle.db, handle.uid, {
        name: entry.name,
        calories: Math.round(entry.calories),
        protein_grams: Math.round(entry.protein_grams),
        carbs_grams: Math.round(entry.carbs_grams ?? 0),
        fat_grams: Math.round(entry.fat_grams ?? 0),
        ...(entry.price > 0 ? { price: entry.price } : {}),
      });
      setScanToast(`Saved "${entry.name}" to My foods`);
      setTimeout(() => setScanToast(null), 2200);
    } catch {}
  }

  const handleModalClose = () => setGoalModalOpen(false);

  const currentWeight =
    profile?.current_weight ?? latestWeight?.weight ?? 160;
  const weeklyChange = profile?.target_weekly_change_lbs ?? 0;
  const goalPhase = profile?.phase ?? "maintain";
  const targetKcal = dailyTargetCalories(currentWeight, weeklyChange);
  const macroTargets = macroTargetsFromCalories(targetKcal, goalPhase);

  const calorieProgress = Math.min(totals.calories / targetKcal, 1);
  const budgetSpent = totals.cost;
  const budgetRemaining = Math.max(dailyBudget - budgetSpent, 0);
  const budgetProgress = Math.min(budgetSpent / dailyBudget, 1);

  const name = user?.displayName?.split(" ")[0] || "Husky";
  const initials = initialsFrom(user?.displayName || user?.email || "U");
  const greeting = getGreeting();

  async function handleDelete(entryId: string) {
    if (!handle) return;
    try {
      await deleteLogEntry(handle.db, handle.uid, selectedDate, entryId);
    } catch {
    }
  }

  const isLoading = profileLoading || logLoading;

  return (
    <div>
      <GoalModal
        open={goalModalOpen}
        initial={profile}
        initialBudget={dailyBudget}
        onClose={handleModalClose}
      />

      <LoggedFoodSheet
        entry={foodDetail}
        onClose={() => setFoodDetail(null)}
        onDelete={handleDelete}
        onSave={handleSaveEdit}
      />

      <FoodInventorySheet
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        onLog={logInventoryFood}
        dateLabel={dayLabel}
      />

      <MealCalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selected={selectedDate}
        today={today}
        onSelect={setSelectedDate}
      />

      {SCAN_ENABLED && (
        <MealScannerSheet
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          dateKey={selectedDate}
          onLogged={(msg) => { setScanToast(msg); setTimeout(() => setScanToast(null), 2400); }}
        />
      )}
      {scanToast && (
        <div className="animate-rise fixed bottom-[100px] left-1/2 z-[90] -translate-x-1/2 rounded-[14px] bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface shadow-[var(--shadow-lg)]">
          {scanToast}
        </div>
      )}

      <div className="aurora-header rounded-b-[30px] px-5 pb-5 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGoalModalOpen(true)}
              aria-label="Edit your goals"
              className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-contrast"
            >
              {initials}
            </button>
            <div>
              <p className="text-[12px] text-ink-soft">{greeting},</p>
              <p className="font-display text-[17px] font-extrabold leading-tight text-ink">
                {name}
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="press grid size-10 place-items-center rounded-full bg-surface text-ink-soft shadow-[var(--shadow-sm)]"
            aria-label="Profile & settings"
          >
            <User className="size-[18px]" />
          </Link>
        </div>

        <div className="mt-4 rounded-[24px] bg-gradient-to-br from-hero-from to-hero-to p-5 text-white shadow-[var(--shadow-hero)]">
          <div className="flex items-center gap-5">
            <Ring
              size={104}
              stroke={11}
              value={calorieProgress}
              color="#fff"
              track="rgba(255,255,255,0.22)"
            >
              <div className="leading-none">
                {isLoading ? (
                  <div className="mx-auto h-7 w-12 rounded-md skeleton" />
                ) : (
                  <>
                    <div className="font-display text-[26px] font-extrabold">
                      {Math.round(totals.calories)}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-white/70">
                      <span className="text-flame">🔥</span> of {targetKcal}
                    </div>
                  </>
                )}
              </div>
            </Ring>

            <div className="flex flex-1 flex-col gap-2.5">
              {MACRO_BARS.map(({ key, label, color }) => {
                const actual = Math.round(
                  key === "protein"
                    ? totals.protein
                    : key === "carbs"
                      ? totals.carbs
                      : totals.fat,
                );
                const target = macroTargets[key];
                const pct = Math.min(actual / target, 1);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span className="text-white/85">{label}</span>
                      {isLoading ? (
                        <span className="h-3.5 w-16 rounded skeleton" />
                      ) : (
                        <span className="text-white/60">
                          {actual} / {target}g
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ${color}`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-center text-[12px] font-medium text-white/80">
            {isLoading ? (
              <span className="inline-block h-4 w-40 rounded skeleton" />
            ) : totals.calories > targetKcal ? (
              `${Math.round(totals.calories - targetKcal)} kcal over target`
            ) : (
              `${Math.round(targetKcal - totals.calories)} kcal remaining today`
            )}
          </p>
        </div>

        <div className="glass-strong mt-3 rounded-[18px] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-ink">💵 Dining budget</span>
            {isLoading ? (
              <span className="h-4 w-28 rounded skeleton" />
            ) : (
              <span className="text-[12px] text-ink-soft">
                {formatMoney(budgetSpent)} spent · {formatMoney(budgetRemaining)} left
              </span>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${
                budgetProgress > 0.9 ? "bg-danger" : "bg-accent"
              }`}
              style={{ width: `${budgetProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 pb-6">
        {SCAN_ENABLED && (
          <button
            onClick={() => setScanOpen(true)}
            className="press mb-4 flex w-full items-center gap-3 rounded-[18px] border border-accent/25 bg-accent-soft px-4 py-3.5 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
              <Camera className="size-[18px]" />
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-accent-ink">Scan a meal</p>
              <p className="text-[11px] text-ink-soft">Snap a photo, scan a barcode, or type it in.</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-accent-ink/70" />
          </button>
        )}

        <button
          onClick={() => setInventoryOpen(true)}
          className="press mb-4 flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5 text-left"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-accent">
            <Boxes className="size-[18px]" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-ink">My foods</p>
            <p className="text-[11px] text-ink-soft">Save &amp; reuse foods — shakes, snacks, go-to meals.</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-ink-faint" />
        </button>

        {!profileLoading && !profile && (
          <button
            onClick={() => setGoalModalOpen(true)}
            className="mb-4 flex w-full items-center gap-3 rounded-[18px] bg-accent-soft px-4 py-3.5 text-left"
          >
            <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-contrast">
              <Target className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-accent-ink">Set your nutrition goals</p>
              <p className="text-[11px] text-ink-soft">
                Weight, phase, and daily budget, takes 30 seconds.
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-accent-ink/70" />
          </button>
        )}

        {!hasCohere ? (
          <Link
            href="/guide"
            className="press mb-4 flex w-full items-center gap-3 rounded-[18px] bg-accent px-4 py-3.5 text-left text-accent-contrast shadow-[var(--shadow-md)]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/25 backdrop-blur-md">
              <Sparkles className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-[14px] font-bold">Finish setup: add your AI key</p>
              <p className="text-[11px] text-white/80">Step by step Cohere &amp; Firebase guide</p>
            </div>
            <ChevronRight className="size-4 shrink-0" />
          </Link>
        ) : (
          <Link
            href="/guide"
            className="press mb-4 flex w-full items-center gap-2.5 rounded-[16px] bg-surface-2 px-4 py-3 text-left"
          >
            <BookOpen className="size-4 shrink-0 text-accent" />
            <span className="flex-1 text-[13px] font-semibold text-ink-soft">Setup guide &amp; help</span>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          </Link>
        )}

        {goalAssessment && goalAssessment.status !== "no_goal" && (
          <Link
            href="/progress"
            className="press mb-4 flex w-full items-center gap-3 rounded-[18px] bg-surface-2 px-4 py-3.5 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <Target className="size-[18px]" />
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-ink">
                {Math.max(0, Math.ceil(goalAssessment.weeksLeft))} weeks to your {goalAssessment.goalWeight} lb goal
              </p>
              <p className="text-[11px] text-ink-soft">
                {goalAssessment.headline} · {Math.abs(goalAssessment.remainingLbs).toFixed(1)} lbs to go
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          </Link>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-display text-[19px] font-extrabold text-ink">My Journal</h2>
          {profile && (
            <button
              onClick={() => setGoalModalOpen(true)}
              className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
            >
              Edit goals
            </button>
          )}
        </div>

        {/* Day switcher — view & edit any past day */}
        <div className="mt-2 flex items-center justify-between rounded-[14px] bg-surface-2 px-1.5 py-1.5">
          <button onClick={() => shiftDay(-1)} aria-label="Previous day" className="press grid size-8 place-items-center rounded-full text-ink-soft">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => setCalendarOpen(true)} className="press flex items-center gap-1.5 rounded-full px-2 text-center">
            <CalendarDays className="size-3.5 text-accent" />
            <span>
              <span className="block text-[13px] font-extrabold text-ink">{dayLabel}</span>
              {totals.calories > 0 && <span className="block text-[10px] text-ink-soft">{Math.round(totals.calories)} kcal logged</span>}
            </span>
          </button>
          <button onClick={() => shiftDay(1)} disabled={isToday} aria-label="Next day" className="press grid size-8 place-items-center rounded-full text-ink-soft disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3">
          {logLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[110px] rounded-[18px] skeleton" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="grid place-items-center rounded-[22px] border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
              <span className="text-3xl">🍽️</span>
              <p className="mt-3 text-[14px] font-semibold text-ink">Nothing logged yet</p>
              <p className="mt-1 text-[13px] text-ink-soft">
                Tap the + button below to log a campus meal or custom food.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {entries.map((entry, i) => (
                <JournalCard
                  key={entry.id}
                  entry={entry}
                  index={i}
                  onDelete={handleDelete}
                  onSave={saveEntryToInventory}
                  onOpen={setFoodDetail}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function initialsFrom(value: string) {
  const parts = value.trim().split(/[\s@.]+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
