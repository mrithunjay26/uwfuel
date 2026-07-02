"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, ChevronRight, CircleDollarSign, ClipboardCheck, Dumbbell, Eye, EyeOff, Gauge, Plus, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { useOnboardingProfile } from "@/lib/hooks/useOnboardingProfile";
import { useFoodExpenses } from "@/lib/hooks/useFoodExpenses";
import { useClassSchedule } from "@/lib/hooks/useClassSchedule";
import { useActiveWorkoutPlan } from "@/lib/hooks/useActiveWorkoutPlan";
import { useReadiness } from "@/lib/hooks/useReadiness";
import { useFlatMenu } from "@/lib/hooks/useFlatMenu";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useConfig } from "@/lib/config/ConfigContext";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { computeBudgetSnapshot } from "@/lib/budget/compute";
import { buildDailyAgenda } from "@/lib/agenda/build";
import { filterSafeCandidates } from "@/lib/dietary/safety";
import { mergeClassSchedules, parseIcsSchedule } from "@/lib/schedule/ics";
import { saveClassSchedule, saveFoodExpense, setOnboardingChecklistHidden } from "@/lib/db/userDb";
import { workoutDayForDate } from "@/lib/workout/plans";
import type { FoodExpenseCategory, FoodFundingSource } from "@/lib/db/types";

export function EverydayOverview({ today }: { today: string }) {
  const handle = useUserDb();
  const { profile: setup, loading: setupLoading } = useOnboardingProfile();
  const { expenses } = useFoodExpenses();
  const { schedule, todayStops } = useClassSchedule();
  const activeWorkout = useActiveWorkoutPlan();
  const readiness = useReadiness(today);
  const { items: menu } = useFlatMenu(Boolean(setup));
  const { profile: goal } = useUserProfile();
  const { hasCohere, remindersOn } = useConfig();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<FoodExpenseCategory>("groceries");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const budget = useMemo(() => computeBudgetSnapshot(setup, expenses, today), [setup, expenses, today]);
  const workoutDay = useMemo(() => activeWorkout ? workoutDayForDate(activeWorkout.days, today) : null, [activeWorkout, today]);
  const safeMenu = useMemo(() => filterSafeCandidates(menu, setup?.dietary ?? null), [menu, setup]);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const agenda = useMemo(() => buildDailyAgenda({ nowMinutes, classes: todayStops, menu: safeMenu, budget, workout: workoutDay, readiness }), [nowMinutes, todayStops, safeMenu, budget, workoutDay, readiness]);

  async function addExpense() {
    const amount = Number(expenseAmount);
    if (!handle || !(amount > 0)) return;
    setSaving(true);
    const funding: FoodFundingSource = expenseCategory === "campus_meal" ? "dining_plan" : "personal";
    await saveFoodExpense(handle.db, handle.uid, { amount, category: expenseCategory, funding_source: funding, date: today, description: expenseCategory === "groceries" ? "Grocery purchase" : "Food purchase" }).catch(() => {});
    setExpenseAmount(""); setExpenseOpen(false); setSaving(false);
  }


  async function importCalendar(file: File) {
    if (!handle) return;
    const imported = parseIcsSchedule(await file.text());
    await saveClassSchedule(handle.db, handle.uid, mergeClassSchedules(schedule, imported));
  }

  async function setChecklistHidden(hidden: boolean) {
    if (!handle) return;
    await setOnboardingChecklistHidden(handle.db, handle.uid, hidden).catch(() => {});
  }

  if (setupLoading) return <div className="mb-5 h-40 rounded-[22px] skeleton" />;
  if (!setup) return <Link href="/setup" className="press mb-5 flex items-center gap-3 rounded-[20px] border border-accent/30 bg-accent-soft p-4"><span className="grid size-11 place-items-center rounded-[15px] bg-accent text-accent-contrast"><Sparkles className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-[14px] font-extrabold text-ink">Build your everyday setup</span><span className="block text-[11px] leading-relaxed text-ink-soft">Add your Dining Plan, personal budget, kitchen, and food rules.</span></span><ChevronRight className="size-4 text-accent" /></Link>;

  const checklist = [
    { label: "Everyday setup", done: true, href: "/setup", icon: ShieldCheck },
    { label: "Class schedule", done: todayStops.length > 0 || Boolean(schedule && Object.keys(schedule).length), href: "#calendar-import", icon: CalendarPlus },
    { label: "Nutrition goal", done: Boolean(goal), href: "/progress", icon: Gauge },
    { label: "Training plan", done: Boolean(activeWorkout), href: "/workout", icon: Dumbbell },
    { label: "AI (optional)", done: hasCohere, href: "/setup/ai", icon: Sparkles },
    { label: "Reminders", done: remindersOn, href: "/profile", icon: ClipboardCheck },
  ];

  return <div className="mb-6 flex flex-col gap-4">
    <section className="glass-panel rounded-[22px] p-4">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Today, already figured out</p><h2 className="mt-1 font-display text-[18px] font-extrabold text-ink">Your next best moves</h2></div><Sparkles className="size-5 text-accent" /></div>
      <div className="mt-3 flex flex-col gap-2">{agenda.slice(0, 4).map((item) => <Link key={item.id} href={item.href} className="press flex items-center gap-3 rounded-[16px] bg-surface-2 p-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><ChevronRight className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-ink-faint">{item.eyebrow}</span><span className="block truncate text-[13px] font-extrabold text-ink">{item.title}</span><span className="block truncate text-[11px] text-ink-soft">{item.detail}</span></span><span className="text-[10px] font-bold text-accent-ink">{item.action}</span></Link>)}</div>
    </section>

    <section id="budgets" className="glass-panel rounded-[22px] p-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><WalletCards className="size-[18px] text-accent" /><h2 className="font-display text-[16px] font-extrabold text-ink">Food wallets</h2></div><button onClick={() => setExpenseOpen(!expenseOpen)} className="press flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-contrast"><Plus className="size-3" /> Expense</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Wallet label="Dining Plan" value={budget.campusRemaining == null ? "Not tracked" : `$${budget.campusRemaining.toFixed(0)} left`} detail={setup.dining_wallet.selection ? `$${budget.campusSpentToday.toFixed(2)} of $${budget.campusDailyGuide.toFixed(0)} guide today` : "No UW plan selected"} progress={budget.campusDailyGuide ? budget.campusSpentToday / budget.campusDailyGuide : 0} />
        <Wallet label="Personal food" value={`$${budget.personalRemaining.toFixed(0)} left`} detail={`$${budget.personalDailyAllowance.toFixed(2)}/day through month-end`} progress={setup.personal_wallet.monthly_budget ? budget.personalSpentMonth / setup.personal_wallet.monthly_budget : 0} />
      </div>
      <div className="mt-3 rounded-[14px] bg-accent-soft px-3 py-2.5"><p className="text-[11px] font-bold text-accent-ink">Safe to spend today · ${budget.combinedTodayGuide.toFixed(2)}</p><p className="text-[10px] text-ink-soft">${budget.campusDailyGuide.toFixed(0)} campus guide + ${budget.personalDailyAllowance.toFixed(2)} personal allowance</p></div>
      {expenseOpen && <div className="mt-3 flex gap-2"><select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value as FoodExpenseCategory)} className="min-w-0 flex-1 rounded-[11px] border border-line bg-surface-2 px-2 text-[12px] text-ink"><option value="groceries">Groceries</option><option value="off_campus_meal">Off-campus meal</option><option value="campus_meal">Campus meal</option><option value="other_food">Other food</option></select><input aria-label="Expense amount" type="number" min={0} value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="$0.00" className="w-24 rounded-[11px] border border-line bg-surface-2 px-2 text-[12px] text-ink outline-none" /><button disabled={saving} onClick={() => void addExpense()} className="rounded-[11px] bg-accent px-3 text-[11px] font-bold text-accent-contrast">Save</button></div>}
    </section>

    {!setup.checklist_hidden ? <section id="calendar-import" className="glass-panel rounded-[22px] p-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarPlus className="size-[18px] text-accent" /><h2 className="font-display text-[16px] font-extrabold text-ink">Setup checklist</h2></div><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-ink-faint">{checklist.filter((item) => item.done).length}/{checklist.length}</span><button aria-label="Hide setup checklist" title="Hide checklist" onClick={() => void setChecklistHidden(true)} className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-faint hover:text-ink"><EyeOff className="size-3.5" /></button></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2">{checklist.map((item) => item.label === "Class schedule" ? <button key={item.label} onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-[13px] bg-surface-2 p-2.5 text-left"><Status done={item.done} /><span className="text-[11px] font-bold text-ink">{item.label}</span></button> : <Link key={item.label} href={item.href} className="flex items-center gap-2 rounded-[13px] bg-surface-2 p-2.5"><Status done={item.done} /><span className="text-[11px] font-bold text-ink">{item.label}</span></Link>)}</div>
      <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCalendar(file); }} />
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-faint"><CalendarPlus className="size-3" /> Class import accepts an .ics calendar and merges it with manual entries.</p>
    </section> : <button onClick={() => void setChecklistHidden(false)} className="press mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold text-ink-faint hover:bg-surface-2 hover:text-ink"><Eye className="size-3" /> Show setup checklist</button>}
  </div>;
}

function Wallet({ label, value, detail, progress }: { label: string; value: string; detail: string; progress: number }) { return <div className="rounded-[16px] bg-surface-2 p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint"><CircleDollarSign className="size-3" /> {label}</p><p className="mt-1 text-[15px] font-extrabold text-ink">{value}</p><p className="mt-0.5 min-h-8 text-[10px] leading-relaxed text-ink-soft">{detail}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-strong"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} /></div></div>; }
function Status({ done }: { done: boolean }) { return <span className={`grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-success text-white" : "bg-surface-3 text-ink-faint"}`}>{done ? <Check className="size-3" /> : <Plus className="size-3" />}</span>; }
