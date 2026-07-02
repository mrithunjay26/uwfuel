"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CookingPot, DollarSign, Home, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useOnboardingProfile } from "@/lib/hooks/useOnboardingProfile";
import { saveOnboardingProfile } from "@/lib/db/userDb";
import { currentQuarterDefaults, plansForHousing, SETUP_VERSION } from "@/lib/onboarding/catalog";
import type { DietaryStyle, DiningPlanSelection, HousingContext, KitchenAccess, OnboardingProfile } from "@/lib/db/types";

const HOUSING: { id: HousingContext; label: string; detail: string }[] = [
  { id: "residence_hall", label: "Residence hall", detail: "Required UW Dining Plan" },
  { id: "campus_apartment", label: "Campus apartment", detail: "Optional apartment plans" },
  { id: "commuter_off_campus", label: "Commuter / off campus", detail: "Personal food budget" },
  { id: "other", label: "Something else", detail: "Build a custom mix" },
];
const ALLERGENS = ["Milk", "Eggs", "Fish", "Shellfish", "Tree nuts", "Peanuts", "Wheat", "Soy", "Sesame"];
const STYLES: { id: DietaryStyle; label: string }[] = [
  { id: "halal", label: "Halal" }, { id: "vegan", label: "Vegan" }, { id: "vegetarian", label: "Vegetarian" }, { id: "gluten_sensitive", label: "Gluten-sensitive" },
];

export default function AdaptiveSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const handle = useUserDb();
  const { profile: existing, loading } = useOnboardingProfile();
  const seeded = useRef(false);
  const quarter = useMemo(() => currentQuarterDefaults(), []);
  const [step, setStep] = useState(0);
  const [housing, setHousing] = useState<HousingContext>("residence_hall");
  const [plan, setPlan] = useState<DiningPlanSelection | null>(null);
  const [currentBalance, setCurrentBalance] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("250");
  const [groceryTarget, setGroceryTarget] = useState("120");
  const [kitchen, setKitchen] = useState<KitchenAccess>("shared");
  const [cookedMeals, setCookedMeals] = useState(3);
  const [styles, setStyles] = useState<DietaryStyle[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState("");
  const [crossContact, setCrossContact] = useState(false);
  const [allowUnknown, setAllowUnknown] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || user) return;
    router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    queueMicrotask(() => {
      setHousing(existing.housing);
      setPlan(existing.dining_wallet.selection);
      setCurrentBalance(existing.dining_wallet.current_balance == null ? "" : String(existing.dining_wallet.current_balance));
      setMonthlyBudget(String(existing.personal_wallet.monthly_budget || ""));
      setGroceryTarget(String(existing.personal_wallet.grocery_target || ""));
      setKitchen(existing.cooking.kitchen_access);
      setCookedMeals(existing.cooking.cooked_meals_per_week);
      setStyles(existing.dietary.styles);
      setAllergens(existing.dietary.allergens);
      setExclusions(existing.dietary.hard_exclusions.join(", "));
      setCrossContact(existing.dietary.cross_contact_sensitive);
      setAllowUnknown(existing.dietary.allow_unknown);
    });
  }, [existing]);

  const planOptions = plansForHousing(housing);
  useEffect(() => {
    if (planOptions.length === 0 && plan) queueMicrotask(() => setPlan(null));
    else if (plan && !planOptions.some((option) => option.level === plan.level && option.program === plan.program)) queueMicrotask(() => setPlan(null));
  }, [housing, plan, planOptions]);

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) { setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]); }

  async function finish() {
    if (!handle) return;
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    const payload: Omit<OnboardingProfile, "updated_at"> = {
      setup_version: SETUP_VERSION,
      completed_at: existing?.completed_at ?? now,
      housing,
      dining_wallet: {
        selection: plan,
        quarter_key: existing?.dining_wallet.quarter_key ?? quarter.key,
        quarter_start: existing?.dining_wallet.quarter_start ?? quarter.start,
        quarter_end: existing?.dining_wallet.quarter_end ?? quarter.end,
        ...(Number(currentBalance) >= 0 && currentBalance.trim() ? { current_balance: Number(currentBalance), balance_as_of: now } : {}),
      },
      personal_wallet: { monthly_budget: Math.max(0, Number(monthlyBudget) || 0), ...(Number(groceryTarget) > 0 ? { grocery_target: Number(groceryTarget) } : {}), cycle_day: 1 },
      cooking: { kitchen_access: kitchen, cooked_meals_per_week: cookedMeals },
      checklist_hidden: existing?.checklist_hidden ?? false,
      dietary: {
        styles, allergens,
        hard_exclusions: exclusions.split(",").map((item) => item.trim()).filter(Boolean),
        dislikes: [], cross_contact_sensitive: crossContact, allow_unknown: crossContact ? false : allowUnknown,
      },
    };
    try { await saveOnboardingProfile(handle.db, handle.uid, payload); router.replace("/dashboard"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save setup."); setSaving(false); }
  }

  if (loading || authLoading) return <div className="grid min-h-[100dvh] place-items-center text-sm text-ink-soft">Preparing your setup…</div>;

  return (
    <div className="flex min-h-[100dvh] flex-col px-5 pb-8 pt-[max(env(safe-area-inset-top),20px)]">
      <div className="flex items-center justify-between">
        <button onClick={() => step ? setStep(step - 1) : router.back()} className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink"><ChevronLeft className="size-5" /></button>
        <p className="text-[12px] font-bold text-ink-soft">Your everyday setup · {step + 1}/4</p>
        <span className="size-10" />
      </div>
      <div className="mt-4 flex gap-1.5">{[0, 1, 2, 3].map((index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-accent" : "bg-line-strong"}`} />)}</div>

      {step === 0 && <section className="mt-6">
        <Header icon={<Home />} title="How do you eat at UW?" detail="We’ll only show plans that fit your living situation." />
        <div className="mt-5 grid grid-cols-2 gap-3">{HOUSING.map((option) => <button key={option.id} onClick={() => setHousing(option.id)} className={`rounded-[18px] border p-4 text-left ${housing === option.id ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}><p className="text-[14px] font-extrabold text-ink">{option.label}</p><p className="mt-1 text-[11px] text-ink-soft">{option.detail}</p></button>)}</div>
        {planOptions.length > 0 && <><p className="mt-5 text-[12px] font-bold uppercase tracking-wide text-ink-faint">Dining Plan</p><div className="mt-2 flex flex-col gap-2">{planOptions.map((option) => <button key={`${option.program}-${option.level}`} onClick={() => setPlan(option)} className={`flex items-center gap-3 rounded-[16px] border px-4 py-3 text-left ${plan?.program === option.program && plan.level === option.level ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}><span className="grid size-9 place-items-center rounded-full bg-surface-2 text-[12px] font-extrabold text-accent">{option.level}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-ink">{option.label} · ${option.quarterly_amount.toLocaleString()}/quarter</span><span className="block text-[11px] text-ink-soft">{option.daily_guide ? `$${option.daily_guide}/day guide · ` : ""}{option.intended_usage}</span></span>{plan?.program === option.program && plan.level === option.level && <Check className="size-4 text-accent" />}</button>)}</div></>}
      </section>}

      {step === 1 && <section className="mt-6">
        <Header icon={<DollarSign />} title="Two wallets, zero guesswork" detail="Dining Plan stays separate from groceries and off-campus food." />
        {plan && <label className="mt-5 block rounded-[18px] bg-accent-soft p-4"><span className="text-[12px] font-bold text-accent-ink">Current Dining Plan balance (optional)</span><span className="mt-1 block text-[11px] text-ink-soft">Useful if you’re joining mid-quarter. Update it anytime.</span><input type="number" min={0} value={currentBalance} onChange={(event) => setCurrentBalance(event.target.value)} placeholder={`Up to $${plan.quarterly_amount}`} className="mt-3 w-full rounded-[12px] border border-accent/20 bg-surface px-3 py-3 text-[15px] font-bold text-ink outline-none" /></label>}
        <div className="mt-4 grid grid-cols-2 gap-3"><MoneyField label="Personal food / month" value={monthlyBudget} onChange={setMonthlyBudget} /><MoneyField label="Grocery target" value={groceryTarget} onChange={setGroceryTarget} /></div>
        <p className="mt-3 rounded-[14px] bg-surface-2 px-4 py-3 text-[11px] leading-relaxed text-ink-soft">Groceries are charged when purchased. Eating them later changes nutrition, not spending—so they are never double-counted.</p>
      </section>}

      {step === 2 && <section className="mt-6">
        <Header icon={<CookingPot />} title="What can you realistically cook?" detail="Recommendations should fit your kitchen, not an imaginary one." />
        <div className="mt-5 grid grid-cols-3 gap-2">{([['none','No kitchen'],['shared','Shared'],['full','Full kitchen']] as [KitchenAccess,string][]).map(([id,label]) => <button key={id} onClick={() => setKitchen(id)} className={`rounded-[15px] border px-2 py-3 text-[12px] font-bold ${kitchen === id ? "border-accent bg-accent text-accent-contrast" : "border-line bg-surface text-ink-soft"}`}>{label}</button>)}</div>
        <label className="mt-5 block text-[12px] font-bold text-ink">Cooked meals per week: {cookedMeals}<input type="range" min={0} max={14} value={cookedMeals} onChange={(event) => setCookedMeals(Number(event.target.value))} className="mt-3 w-full accent-[var(--accent)]" /></label>
      </section>}

      {step === 3 && <section className="mt-6">
        <Header icon={<ShieldCheck />} title="Food rules we must respect" detail="Hard exclusions are applied before budget, macros, routing, or AI." />
        <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Eating styles</p><div className="mt-2 flex flex-wrap gap-2">{STYLES.map((option) => <Chip key={option.id} active={styles.includes(option.id)} onClick={() => toggle(styles, option.id, setStyles)}>{option.label}</Chip>)}</div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Allergens</p><div className="mt-2 flex flex-wrap gap-2">{ALLERGENS.map((allergen) => <Chip key={allergen} active={allergens.includes(allergen)} onClick={() => toggle(allergens, allergen, setAllergens)}>{allergen}</Chip>)}</div>
        <label className="mt-4 block text-[12px] font-bold text-ink">Other ingredients to never suggest<input value={exclusions} onChange={(event) => setExclusions(event.target.value)} placeholder="Pork, alcohol, mushrooms…" className="mt-2 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-3 text-[13px] text-ink outline-none focus:border-accent" /></label>
        <Toggle label="Cross-contact sensitive" detail="Block items unless their status is known." value={crossContact} onChange={setCrossContact} />
        {!crossContact && <Toggle label="Allow unknown items with a warning" detail="Never labels them verified-safe." value={allowUnknown} onChange={setAllowUnknown} />}
      </section>}

      <div className="flex-1" />
      {error && <p className="mt-4 rounded-[12px] bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p>}
      <div className="mt-6"><Button full size="lg" loading={saving} onClick={() => step < 3 ? setStep(step + 1) : void finish()}>{step < 3 ? <>Continue <ChevronRight className="size-4" /></> : "Build my Today view"}</Button>{step > 0 && step < 3 && <button onClick={() => setStep(step + 1)} className="mt-3 w-full text-center text-[12px] font-semibold text-ink-faint">Skip this step</button>}</div>
    </div>
  );
}

function Header({ icon, title, detail }: { icon: React.ReactElement; title: string; detail: string }) { return <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-accent text-accent-contrast">{icon}</span><div><h1 className="font-display text-[23px] font-extrabold leading-tight text-ink">{title}</h1><p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{detail}</p></div></div>; }
function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="rounded-[16px] border border-line bg-surface p-3 text-[11px] font-bold text-ink-soft">{label}<span className="mt-2 flex items-center gap-1 text-ink"><span>$</span><input type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[18px] font-extrabold outline-none" /></span></label>; }
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`rounded-full px-3 py-2 text-[12px] font-bold ${active ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"}`}>{children}</button>; }
function Toggle({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) { return <button onClick={() => onChange(!value)} className="mt-4 flex w-full items-center gap-3 text-left"><span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-ink">{label}</span><span className="block text-[11px] text-ink-soft">{detail}</span></span><span className={`relative h-6 w-11 rounded-full ${value ? "bg-accent" : "bg-line-strong"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`} /></span></button>; }
