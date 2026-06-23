"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  HelpCircle,
  Info,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function DocLayout({ toc, children }: { toc: { id: string; label: string }[]; children: ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[210px_1fr] md:gap-10 lg:gap-14">
      <aside className="hidden md:block">
        <nav className="sticky top-20">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">On this page</p>
          <ul className="flex flex-col gap-0.5 border-l border-line">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="block border-l-2 border-transparent px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:border-accent hover:text-ink">
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function MobileToc({ toc }: { toc: { id: string; label: string }[] }) {
  return (
    <nav className="glass-panel mb-8 rounded-[16px] p-3 md:hidden">
      <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Jump to</p>
      <div className="flex flex-col">
        {toc.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2 hover:text-ink">
            <ChevronRight className="size-3.5 text-accent" /> {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Part({
  n, id, title, time, optional, children,
}: {
  n: number | string;
  id: string;
  title: string;
  time?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 pt-4 first:pt-0">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent font-display text-[17px] font-extrabold text-accent-contrast">{n}</span>
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-extrabold leading-tight text-ink md:text-[27px]">{title}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {time && <TimeBadge time={time} />}
            {optional && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">Optional</span>}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function TimeBadge({ time }: { time: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold text-accent-ink">
      <Clock className="size-3" /> {time}
    </span>
  );
}

export function WalkStep({ n, title, last, children }: { n: number; title: string; last?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex gap-3.5">
      <div className="flex flex-col items-center">
        <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-accent bg-surface text-[13px] font-extrabold text-accent-ink">{n}</span>
        {!last && <span className="mt-1 w-0.5 flex-1 rounded-full bg-line" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className="text-[15px] font-bold text-ink">{title}</p>
        <div className="mt-2 flex flex-col gap-2.5 text-[14px] leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

export function ClickPath({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] bg-surface-2 px-3 py-2.5">
      <MousePointerClick className="mr-0.5 size-3.5 shrink-0 text-accent" />
      {steps.map((s, i) => (
        <Fragment key={i}>
          <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-[12px] font-bold text-ink">{s}</span>
          {i < steps.length - 1 && <ChevronRight className="size-3.5 text-ink-faint" />}
        </Fragment>
      ))}
    </div>
  );
}

export function WhatIs({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface-2/50">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left">
        <span className="flex items-center gap-2 text-[13px] font-bold text-ink"><HelpCircle className="size-4 text-accent" /> What is {term}?</span>
        {open ? <ChevronUp className="size-4 text-ink-faint" /> : <ChevronDown className="size-4 text-ink-faint" />}
      </button>
      {open && <div className="border-t border-line px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}

export function SuccessCheck({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-[14px] border border-success/40 bg-success/10 p-3.5">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      <div className="text-[13px] leading-relaxed">
        <p className="font-bold text-ink">You’ll know it worked when…</p>
        <div className="mt-0.5 text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

export function DocSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-[20px] font-extrabold text-ink md:text-[24px]">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[14px] leading-relaxed text-ink-soft md:text-[15px]">{children}</div>
    </section>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="glass-panel flex gap-3 rounded-[18px] p-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-extrabold text-accent-contrast">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-ink">{title}</p>
        <div className="mt-1.5 flex flex-col gap-2 text-[14px] leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

const CALLOUT_STYLES = {
  info: { icon: Info, cls: "border-accent/30 bg-accent-soft/50", ic: "text-accent" },
  warn: { icon: AlertTriangle, cls: "border-warning/40 bg-warning/10", ic: "text-warning" },
  security: { icon: ShieldCheck, cls: "border-success/40 bg-success/10", ic: "text-success" },
  tip: { icon: Check, cls: "border-carbs/40 bg-carbs-soft/60", ic: "text-carbs" },
} as const;

export function Callout({ type = "info", title, children }: { type?: keyof typeof CALLOUT_STYLES; title?: string; children: ReactNode }) {
  const { icon: Icon, cls, ic } = CALLOUT_STYLES[type];
  return (
    <div className={cn("flex gap-2.5 rounded-[14px] border p-3.5", cls)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", ic)} />
      <div className="text-[13px] leading-relaxed text-ink">
        {title && <p className="mb-0.5 font-bold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-line bg-surface-2">
      {label && <div className="border-b border-line px-3.5 py-1.5 text-[11px] font-semibold text-ink-faint">{label}</div>}
      <button onClick={copy} className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-lg bg-surface text-ink-soft shadow-[var(--shadow-sm)]" aria-label="Copy">
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
      <pre className="thin-scrollbar overflow-x-auto px-3.5 py-3 text-[12px] leading-relaxed text-ink"><code>{code}</code></pre>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold text-ink">{children}</span>;
}
