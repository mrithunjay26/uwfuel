import type { FoodExpense, OnboardingProfile } from "@/lib/db/types";

const DAY = 86_400_000;
function dateMs(key: string) { return Date.parse(`${key}T00:00:00`); }
function clampDays(ms: number) { return Math.max(1, Math.ceil(ms / DAY)); }

export interface BudgetSnapshot {
  campusSpentToday: number;
  campusSpentQuarter: number;
  campusDailyGuide: number;
  campusRemaining: number | null;
  campusPaceDelta: number;
  projectedCampusEndBalance: number | null;
  personalSpentMonth: number;
  grocerySpentMonth: number;
  personalRemaining: number;
  personalDailyAllowance: number;
  combinedTodayGuide: number;
}

export function computeBudgetSnapshot(profile: OnboardingProfile | null, expenses: FoodExpense[], today: string): BudgetSnapshot {
  const dining = profile?.dining_wallet;
  const personal = profile?.personal_wallet;
  const monthPrefix = today.slice(0, 7);
  const quarterExpenses = dining ? expenses.filter((e) => e.date >= dining.quarter_start && e.date <= dining.quarter_end) : [];
  const campusQuarter = quarterExpenses.filter((e) => e.funding_source === "dining_plan").reduce((sum, e) => sum + e.amount, 0);
  const campusToday = expenses.filter((e) => e.date === today && e.funding_source === "dining_plan").reduce((sum, e) => sum + e.amount, 0);
  const guide = dining?.selection?.daily_guide ?? 0;
  const elapsedDays = dining ? clampDays(dateMs(today) - dateMs(dining.quarter_start) + DAY) : 1;
  const remainingDays = dining ? clampDays(dateMs(dining.quarter_end) - dateMs(today) + DAY) : 1;
  const paceDelta = campusQuarter - guide * elapsedDays;
  const loggedAfterAnchor = dining?.balance_as_of
    ? quarterExpenses.filter((e) => e.occurred_at > dining.balance_as_of! && e.funding_source === "dining_plan").reduce((sum, e) => sum + e.amount, 0)
    : 0;
  const campusRemaining = dining?.current_balance != null
    ? Math.max(0, dining.current_balance - loggedAfterAnchor)
    : dining?.selection ? Math.max(0, dining.selection.quarterly_amount - campusQuarter) : null;
  const projectedCampusEndBalance = campusRemaining == null ? null : campusRemaining - guide * remainingDays;

  const monthExpenses = expenses.filter((e) => e.date.startsWith(monthPrefix) && e.funding_source !== "dining_plan");
  const personalSpentMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const grocerySpentMonth = monthExpenses.filter((e) => e.category === "groceries").reduce((sum, e) => sum + e.amount, 0);
  const monthlyBudget = personal?.monthly_budget ?? 0;
  const personalRemaining = Math.max(0, monthlyBudget - personalSpentMonth);
  const [year, month] = monthPrefix.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = Number(today.slice(8, 10));
  const personalDailyAllowance = personalRemaining / Math.max(1, daysInMonth - dayOfMonth + 1);

  return {
    campusSpentToday: campusToday,
    campusSpentQuarter: campusQuarter,
    campusDailyGuide: guide,
    campusRemaining,
    campusPaceDelta: paceDelta,
    projectedCampusEndBalance,
    personalSpentMonth,
    grocerySpentMonth,
    personalRemaining,
    personalDailyAllowance,
    combinedTodayGuide: guide + personalDailyAllowance,
  };
}
