"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  Check,
  ChevronRight,
  Code2,
  Dumbbell,
  Flame,
  KeyRound,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { AuroraField } from "@/components/app/AuroraField";
import { BrandMark, Wordmark } from "@/components/brand/Logo";
import { Ring } from "@/components/ui/Ring";
import { ThemeToggle } from "@/components/system/ThemeToggle";

const REPO_URL = "https://github.com/mrithunjay26/uwfuel";
const AUTHOR = "Mrithunjay Tanish Shanmuganand";

export function Landing() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden">
      <AuroraField />

      <header className="sticky top-0 z-30">
        <div className="glass-nav mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-[20px] px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <Wordmark />
          </div>
          <nav className="flex items-center gap-1.5 md:gap-2.5">
            <Link href="/guide" className="hidden rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink sm:block">Guide</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink sm:block">GitHub</a>
            <ThemeToggle className="size-8" />
            <Link href="/login" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink">Log in</Link>
            <Link href="/signup" className="press rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-accent-contrast">Get started</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8">
        <Hero />
        <Stats />
        <HowItWorks />
        <BudgetDemo />
        <Features />
        <DataOwnership />
        <ForStudents />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent-ink">
          <span className="size-1.5 rounded-full bg-accent" /> Free &amp; open source · for UW students
        </span>
        <h1 className="mt-4 font-display text-[34px] font-extrabold leading-[1.05] text-ink md:text-[52px]">
          Eat well, train hard,
          <br />
          <span className="bg-gradient-to-r from-accent to-fab bg-clip-text text-transparent">stay on budget.</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft md:text-[17px]">
          UW Fuel turns live campus dining data into AI meal plans that fit your goals
          <b className="font-semibold text-ink"> and your budget</b>, plus a full workout logger,
          progress charts, and class aware routing. Powered by an AI key <b className="font-semibold text-ink">you</b> control.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="press inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-accent-contrast shadow-[var(--shadow-md)]">
            Start free <ArrowRight className="size-4" />
          </Link>
          <Link href="/guide" className="press inline-flex items-center gap-2 rounded-full bg-surface-2 px-6 py-3 text-[15px] font-bold text-ink">
            How it works
          </Link>
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-faint">
          <span className="flex items-center gap-1"><Check className="size-3.5 text-carbs" /> No subscription</span>
          <span className="flex items-center gap-1"><Check className="size-3.5 text-carbs" /> Your data, your project</span>
          <span className="flex items-center gap-1"><Check className="size-3.5 text-carbs" /> Open source</span>
        </p>
      </div>

      <GoalRingDemo />
    </section>
  );
}

function GoalRingDemo() {
  const [dir, setDir] = useState<"lose" | "maintain" | "gain">("gain");
  const [rate, setRate] = useState(1.5);
  const maintenance = 2350;
  const delta = dir === "gain" ? rate : dir === "lose" ? -rate : 0;
  const target = Math.round(maintenance + delta * 500);
  const ringVal = Math.min(1, target / 3600);

  return (
    <div className="glass-panel rounded-[28px] p-6 md:p-7">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Try it · goal driven calories</p>
      <div className="mt-4 flex items-center gap-6">
        <Ring size={120} stroke={12} value={ringVal} color="var(--color-accent)" track="var(--color-surface-3)">
          <div className="leading-none">
            <div className="font-display text-[26px] font-extrabold text-ink">{target.toLocaleString()}</div>
            <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-ink-soft">
              <Flame className="size-3 text-flame" /> kcal / day
            </div>
          </div>
        </Ring>
        <div className="flex-1">
          <div className="flex gap-1.5">
            {(["lose", "maintain", "gain"] as const).map((d) => (
              <button key={d} onClick={() => setDir(d)} className={`flex-1 rounded-[10px] py-1.5 text-[11px] font-bold capitalize transition ${dir === d ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"}`}>{d}</button>
            ))}
          </div>
          {dir !== "maintain" && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-semibold text-ink-soft">
                <span>Pace</span><span>{rate.toFixed(1)} lb/week</span>
              </div>
              <input type="range" min={0.5} max={3} step={0.5} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="mt-1 w-full accent-[var(--color-accent)]" />
            </div>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
            UW Fuel sizes your daily calories from your <b className="font-semibold text-ink">real goal &amp; timeline</b>, not a generic number.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stats() {
  const stats = [
    { v: "1,300+", l: "Exercises in the library" },
    { v: "Live", l: "UW HFS dining menus" },
    { v: "$/day", l: "Budget enforced on every plan" },
    { v: "100%", l: "Open source" },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 pb-6 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.l} className="glass-panel rounded-[18px] p-4 text-center">
          <p className="font-display text-[24px] font-extrabold text-ink md:text-[28px]">{s.v}</p>
          <p className="mt-1 text-[12px] font-medium text-ink-soft">{s.l}</p>
        </div>
      ))}
    </section>
  );
}

function HowItWorks() {
  const tabs = [
    { id: "dining", label: "Dining", icon: UtensilsCrossed },
    { id: "plan", label: "Plan", icon: CalendarCheck2 },
    { id: "train", label: "Train", icon: Dumbbell },
    { id: "progress", label: "Progress", icon: BarChart3 },
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("plan");

  return (
    <section className="py-12 md:py-16">
      <div className="text-center">
        <h2 className="font-display text-[26px] font-extrabold text-ink md:text-[36px]">One app, your whole routine</h2>
        <p className="mx-auto mt-2 max-w-lg text-[14px] text-ink-soft md:text-[16px]">Browse the dining menu, generate a plan that fits your budget, log your lifts, and watch the trends.</p>
      </div>

      <div className="mx-auto mt-7 flex max-w-md justify-center gap-1.5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2 text-[12px] font-bold transition md:text-[13px] ${tab === t.id ? "bg-accent text-accent-contrast" : "glass-panel text-ink-soft"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-5 max-w-md">
        <div className="glass-panel rounded-[24px] p-5">
          {tab === "dining" && <MockDining />}
          {tab === "plan" && <MockPlan />}
          {tab === "train" && <MockTrain />}
          {tab === "progress" && <MockProgress />}
        </div>
      </div>
    </section>
  );
}

function MockDining() {
  const items = [
    ["Teriyaki Chicken Bowl", "By George · open", 720, 9.49],
    ["Tofu Banh Mi", "Local Point · open", 540, 7.25],
    ["Greek Yogurt Parfait", "Center Table · open", 240, 4.25],
  ] as const;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Today’s menu · real prices</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map(([n, loc, cal, price]) => (
          <div key={n} className="rounded-[14px] bg-surface-2 p-3">
            <p className="line-clamp-2 text-[12px] font-bold text-ink">{n}</p>
            <p className="mt-1 text-[10px] text-ink-soft">{loc}</p>
            <p className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-ink-soft"><Flame className="size-3 text-flame" />{cal} · ${price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPlan() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">AI plan · under $15</p>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">$13.74 total</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {[["Lunch", "BBQ Chicken Wrap", "By George", 1050, 6.49], ["Dinner", "Turkey Pesto Bowl", "Local Point", 760, 7.25]].map(([meal, item, loc, cal, price]) => (
          <div key={meal as string} className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2.5">
            <div><p className="text-[10px] font-bold uppercase text-accent-ink">{meal}</p><p className="text-[12px] font-semibold text-ink">{item}</p><p className="text-[10px] text-ink-soft">{loc}</p></div>
            <div className="text-right text-[11px] text-ink-soft"><p className="font-bold text-ink">{cal} cal</p><p>${(price as number).toFixed(2)}</p></div>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-faint"><MapPin className="size-3 text-accent" /> Walking route from your class included</p>
    </div>
  );
}

function MockTrain() {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Workout log · Push day</p>
      <div className="mt-3 flex flex-col gap-2">
        {[["Bench Press", "135×8 · 145×6 · 155×5"], ["Incline DB Press", "50×10 · 50×9"], ["Cable Fly", "30×12 · 30×12"]].map(([n, sets]) => (
          <div key={n} className="rounded-[12px] bg-surface-2 px-3 py-2"><p className="text-[12px] font-bold text-ink">{n}</p><p className="text-[11px] text-ink-soft">{sets}</p></div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-faint"><Dumbbell className="size-3 text-accent" /> PRs flagged automatically · records &amp; charts per exercise</p>
    </div>
  );
}

function MockProgress() {
  const bars = [40, 62, 55, 78, 70, 88, 95];
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Progress · 7 day calories</p>
      <div className="mt-4 flex h-24 items-end gap-2">
        {bars.map((h, i) => (<div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-accent to-fab" style={{ height: `${h}%` }} />))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[["Streak", "12d"], ["Avg protein", "148g"], ["Weight", "+3.1 lb"]].map(([l, v]) => (
          <div key={l} className="rounded-[10px] bg-surface-2 py-2"><p className="text-[14px] font-extrabold text-ink">{v}</p><p className="text-[10px] text-ink-soft">{l}</p></div>
        ))}
      </div>
    </div>
  );
}

const DEMO_MEALS = [
  { name: "Greek Yogurt Parfait", loc: "Center Table", cal: 240, pro: 18, price: 4.25 },
  { name: "Turkey Pesto Wrap", loc: "By George", cal: 560, pro: 38, price: 6.49 },
  { name: "Teriyaki Chicken Bowl", loc: "Local Point", cal: 720, pro: 48, price: 9.49 },
  { name: "Tofu Banh Mi", loc: "Local Point", cal: 540, pro: 22, price: 7.25 },
  { name: "Protein Smoothie", loc: "Husky Den", cal: 320, pro: 30, price: 5.49 },
  { name: "Salmon Rice Bowl", loc: "Center Table", cal: 690, pro: 41, price: 10.99 },
];

function BudgetDemo() {
  const [budget, setBudget] = useState(15);
  const plan = useMemo(() => {
    const ranked = [...DEMO_MEALS].sort((a, b) => b.pro / b.price - a.pro / a.price);
    let total = 0, cal = 0, pro = 0;
    const out: typeof DEMO_MEALS = [];
    for (const m of ranked) {
      if (total + m.price <= budget) { out.push(m); total += m.price; cal += m.cal; pro += m.pro; }
    }
    return { out, total, cal, pro };
  }, [budget]);

  return (
    <section className="py-12 md:py-16">
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-display text-[26px] font-extrabold text-ink md:text-[34px]">Budget first, always</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft md:text-[16px]">
            Set your daily cap and the planner only ever suggests <b className="font-semibold text-ink">real menu items that actually fit</b>.
            It will never inflate a plan past your budget. Drag to see it adapt.
          </p>
          <div className="mt-6 glass-panel rounded-[18px] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-ink">Daily budget</span>
              <span className="font-display text-[22px] font-extrabold text-accent-ink">${budget}</span>
            </div>
            <input type="range" min={8} max={35} step={1} value={budget} onChange={(e) => setBudget(parseInt(e.target.value, 10))} className="mt-2 w-full accent-[var(--color-accent)]" />
          </div>
        </div>

        <div className="glass-panel rounded-[22px] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Plan that fits</p>
            <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success">${plan.total.toFixed(2)} / ${budget}</span>
          </div>
          <div className="mt-3 flex min-h-[120px] flex-col gap-2">
            {plan.out.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-soft">Raise the budget to fit a meal.</p>
            ) : plan.out.map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2.5">
                <div><p className="text-[12px] font-bold text-ink">{m.name}</p><p className="text-[10px] text-ink-soft">{m.loc}</p></div>
                <div className="text-right text-[11px] text-ink-soft"><p className="font-bold text-ink">${m.price.toFixed(2)}</p><p>{m.cal} cal · {m.pro}g</p></div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-2 text-[12px] font-semibold text-ink-soft">
            <span>{plan.cal} kcal · {plan.pro}g protein</span><span>{plan.out.length} meals</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const feats = [
    [UtensilsCrossed, "Live campus dining", "Real UW HFS menus, prices, macros and whether a spot is open right now, checked against Pacific time."],
    [CalendarCheck2, "AI meal planner", "Budget-aware plans from real items, with walking routes from your classes."],
    [Dumbbell, "Workout logger", "Per set weight × reps, auto PRs, a calendar, rep max records & volume charts."],
    [BarChart3, "Progress & charts", "Calories, macros, weight and spend trends, plus an editable food journal."],
    [MapPin, "Class aware routing", "Pin your buildings; get nearby picks and routes timed to your schedule."],
    [KeyRound, "Bring your own AI", "Uses your Cohere key from your device. You control usage and cost."],
  ] as const;
  return (
    <section className="py-12 md:py-16">
      <h2 className="text-center font-display text-[26px] font-extrabold text-ink md:text-[36px]">Everything, in your pocket</h2>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {feats.map(([Icon, title, body]) => (
          <div key={title} className="glass-panel rounded-[20px] p-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent"><Icon className="size-5" /></span>
            <p className="mt-3 font-display text-[16px] font-bold text-ink">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataOwnership() {
  const points = [
    [Lock, "Credentials stay in your account", "Your AI key & database settings live in the database scoped to you, never in browser storage."],
    [ShieldCheck, "Your data, your project", "Use the shared project (isolated to your account) or connect your own Firebase for full ownership."],
    [KeyRound, "You hold the keys", "AI runs from your device with your own key. We never see your credentials."],
  ] as const;
  return (
    <section className="py-12 md:py-16">
      <div className="glass-panel rounded-[28px] p-6 md:p-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-[12px] font-bold text-success"><ShieldCheck className="size-3.5" /> Privacy first by design</span>
          <h2 className="mt-3 font-display text-[24px] font-extrabold text-ink md:text-[32px]">Built so you can trust it</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {points.map(([Icon, t, b]) => (
            <div key={t} className="text-center md:text-left">
              <span className="mx-auto grid size-10 place-items-center rounded-2xl bg-surface-2 text-accent md:mx-0"><Icon className="size-5" /></span>
              <p className="mt-3 font-display text-[15px] font-bold text-ink">{t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/privacy" className="press inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-[13px] font-bold text-ink">Privacy Policy</Link>
          <Link href="/terms" className="press inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-[13px] font-bold text-ink">Terms of Service</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-[13px] font-bold text-ink"><Code2 className="size-4" /> Read the source</a>
        </div>
      </div>
    </section>
  );
}

function ForStudents() {
  return (
    <section className="py-12 md:py-16">
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div className="order-2 md:order-1 glass-panel rounded-[24px] p-6">
          <div className="flex flex-col gap-3">
            {[
              "“I never know what's open or what fits my macros.”",
              "“Dining dollars disappear before the month ends.”",
              "“I want to lift but tracking is a hassle.”",
            ].map((q) => (
              <div key={q} className="flex items-start gap-3 rounded-[14px] bg-surface-2 p-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast"><Check className="size-4" strokeWidth={3} /></span>
                <p className="text-[13px] italic leading-relaxed text-ink-soft">{q}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent-ink"><Sparkles className="size-3.5" /> Made for the Ave &amp; the HUB</span>
          <h2 className="mt-4 font-display text-[26px] font-extrabold leading-tight text-ink md:text-[36px]">For the way UW students actually eat &amp; train</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft md:text-[17px]">
            Between classes, dining dollars, and the IMA, eating well on a student budget is genuinely hard.
            UW Fuel was built by a UW student to make the smart choice the easy one, with real menus, real prices,
            and plans that respect your wallet and your goals.
          </p>
          <Link href="/signup" className="press mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-accent-contrast">
            Make it yours <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-12 md:py-20">
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-hero-from to-hero-to p-8 text-center text-white shadow-[var(--shadow-hero)] md:p-14">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-52 rounded-full bg-white/10" />
        <h2 className="relative font-display text-[28px] font-extrabold md:text-[42px]">Fuel up. It’s free.</h2>
        <p className="relative mx-auto mt-3 max-w-md text-[15px] text-white/80 md:text-[17px]">Set up in about five minutes with the step by step guide. Bring your AI key and go.</p>
        <div className="relative mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="press rounded-full bg-white px-7 py-3 text-[15px] font-bold text-accent-ink">Create your account</Link>
          <Link href="/guide" className="press rounded-full bg-white/15 px-7 py-3 text-[15px] font-bold text-white backdrop-blur-md">Read the setup guide</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-[max(env(safe-area-inset-bottom),28px)] md:px-8">
      <div className="flex flex-col items-center gap-4 border-t border-line pt-7 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <div>
            <p className="font-display text-[14px] font-extrabold text-ink">UW Fuel</p>
            <p className="text-[11px] text-ink-faint">An open source project by {AUTHOR}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-semibold text-ink-soft">
          <Link href="/guide" className="hover:text-ink">Setup guide</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
        </div>
      </div>
      <p className="mt-5 text-center text-[11px] text-ink-faint">
        Not affiliated with the University of Washington or UW HFS. Dining data is public information.
      </p>
    </footer>
  );
}
