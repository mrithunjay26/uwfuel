"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Camera,
  ChevronRight,
  Code2,
  Database,
  Dumbbell,
  KeyRound,
  LogOut,
  Moon,
  Paintbrush,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ClassScheduleModal } from "@/components/app/ClassScheduleModal";
import { CustomizerSheet } from "@/components/app/CustomizerSheet";
import { FitNotesImportSheet } from "@/components/app/FitNotesImportSheet";
import { ConnectAIForm } from "@/components/onboarding/ConnectAIForm";
import { ConnectDatabaseForm } from "@/components/onboarding/ConnectDatabaseForm";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { useAuth } from "@/lib/auth/AuthContext";
import { useConfig } from "@/lib/config/ConfigContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import { useClassSchedule } from "@/lib/hooks/useClassSchedule";
import { haptic } from "@/lib/utils/haptics";

const REPO_URL = "https://github.com/mrithunjay26/uwfuel";

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    cohereKey, hasCohere, setCohereKey,
    groqKey, hasGroq, setGroqKey,
    firebase, hasFirebase, setFirebase,
    showWorkoutTabs, setShowWorkoutTabs,
  } = useConfig();
  const { theme, toggle } = useTheme();
  const { schedule: classSchedule, todayStops } = useClassSchedule();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [dbExpanded, setDbExpanded] = useState(false);
  const [groqExpanded, setGroqExpanded] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [fitnotesOpen, setFitnotesOpen] = useState(false);

  const name = user?.displayName || "Husky Student";
  const email = user?.email || "";
  const initials = (name || email || "U").slice(0, 1).toUpperCase();
  const maskedKey = cohereKey ? `co-••••${cohereKey.slice(-4)}` : null;
  const maskedGroq = groqKey ? `gsk_••••${groqKey.slice(-4)}` : null;
  const dbHost = firebase?.databaseURL?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";

  const totalStops = classSchedule
    ? Object.values(classSchedule).reduce((n, stops) => n + (stops?.length ?? 0), 0)
    : 0;

  async function handleLogout() {
    haptic("medium");
    await signOut().catch(() => {});
    router.replace("/login");
  }

  return (
    <div className="pb-8">
      <ClassScheduleModal
        open={scheduleOpen}
        initial={classSchedule}
        onClose={() => setScheduleOpen(false)}
      />

      <CustomizerSheet open={customizerOpen} onClose={() => setCustomizerOpen(false)} />
      <FitNotesImportSheet open={fitnotesOpen} onClose={() => setFitnotesOpen(false)} />

      <AuroraHeader
        title={name}
        subtitle={email}
        icon={<span className="font-display text-base font-extrabold">{initials}</span>}
      />

      <div className="flex flex-col gap-3 px-5 pt-5">

        <Link href="/setup" className="press glass-panel flex items-center gap-3 rounded-[20px] p-4">
          <span className="grid size-10 place-items-center rounded-[14px] bg-accent-soft text-accent"><WalletCards className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-display text-[15px] font-bold text-ink">Everyday setup &amp; food wallets</span><span className="block text-[11px] text-ink-soft">Dining Plan, personal budget, cooking access, and food rules</span></span>
          <ChevronRight className="size-4 text-ink-faint" />
        </Link>

        <section className="glass-panel rounded-[20px] p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`size-[18px] ${hasFirebase ? "text-success" : "text-accent"}`} />
            <h2 className="font-display text-[15px] font-bold text-ink">Data Storage</h2>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
              hasFirebase ? "bg-success/15 text-success" : "bg-surface-3 text-ink-soft"
            }`}>
              {hasFirebase ? "Personal DB" : "Shared DB"}
            </span>
          </div>

          {hasFirebase ? (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-[13px]">
                <Database className="size-4 text-success" />
                <span className="text-ink-soft">
                  Connected · <b className="font-semibold text-ink">{firebase?.projectId}</b>
                </span>
              </div>
              {dbHost && <p className="mt-1 truncate text-[11px] text-ink-faint">{dbHost}</p>}
              <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                Your meals &amp; goals live in <b className="font-semibold text-ink">your</b> Firebase project.
              </p>
              <button
                onClick={() => { setFirebase(null); }}
                className="mt-2 text-[12px] font-semibold text-danger"
              >
                Disconnect personal DB
              </button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                Using the shared UW Fuel database. Your data is isolated under your account.
                Optionally connect your own Firebase project for full data ownership.
              </p>
              <button
                onClick={() => setDbExpanded(!dbExpanded)}
                className="mt-2 flex items-center gap-1 text-[12px] font-bold text-accent-ink"
              >
                <Database className="size-3.5" />
                {dbExpanded ? "Hide" : "Connect my own Firebase"}
              </button>
              {dbExpanded && (
                <div className="mt-3">
                  <ConnectDatabaseForm
                    ctaLabel="Connect & use my project"
                    onConnected={(cfg) => {
                      setFirebase(cfg);
                      setDbExpanded(false);
                      haptic("success");
                    }}
                  />
                </div>
              )}
            </>
          )}
        </section>

        <section className="glass-panel rounded-[20px] p-1.5">
          <button
            onClick={() => { haptic("light"); setScheduleOpen(true); }}
            className="flex w-full items-center justify-between rounded-[15px] px-3 py-3 active:bg-surface-2"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
              <CalendarDays className="size-[18px] text-accent" />
              Class schedule
            </span>
            <div className="flex items-center gap-2">
              {totalStops > 0 && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                  {totalStops} stops
                </span>
              )}
              {todayStops.length > 0 && (
                <span className="text-[12px] text-ink-soft">{todayStops.length} today</span>
              )}
              <ChevronRight className="size-4 text-ink-faint" />
            </div>
          </button>

          {todayStops.length > 0 && (
            <div className="mb-1.5 px-3">
              <div className="flex flex-col gap-1.5 rounded-[12px] bg-surface-2 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Today&apos;s classes</p>
                {todayStops.map((stop) => (
                  <div key={stop.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="size-3.5 text-accent" />
                      <span className="text-[13px] font-semibold text-ink">{stop.building_label}</span>
                    </div>
                    <span className="text-[12px] text-ink-soft">{stop.start_time} to {stop.end_time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel rounded-[20px] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-[18px] text-accent" />
              <h2 className="font-display text-[15px] font-bold text-ink">AI key</h2>
            </div>
            <button
              onClick={() => router.push("/setup/ai")}
              className="text-[12px] font-bold text-accent-ink"
            >
              {hasCohere ? "Replace" : "Add"}
            </button>
          </div>
          {hasCohere ? (
            <>
              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <KeyRound className="size-4 text-accent" />
                <span className="text-ink-soft">
                  Cohere key saved · <b className="font-semibold text-ink">{maskedKey}</b>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[12px] text-ink-soft">Stored on this device only.</p>
                <button onClick={() => setCohereKey(null)} className="text-[12px] font-semibold text-danger">
                  Remove
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">
              No AI key yet. Add your Cohere key to enable the chatbot and meal planner.
            </p>
          )}
        </section>

        <section className="glass-panel rounded-[20px] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="size-[18px] text-accent" />
              <h2 className="font-display text-[15px] font-bold text-ink">Meal scanner key (Groq)</h2>
            </div>
            <button
              onClick={() => setGroqExpanded((v) => !v)}
              className="text-[12px] font-bold text-accent-ink"
            >
              {groqExpanded ? "Close" : hasGroq ? "Replace" : "Add"}
            </button>
          </div>

          {hasGroq && !groqExpanded ? (
            <>
              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <KeyRound className="size-4 text-accent" />
                <span className="text-ink-soft">
                  Groq key saved · <b className="font-semibold text-ink">{maskedGroq}</b>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[12px] text-ink-soft">Free backup for photo &amp; text scanning.</p>
                <button onClick={() => setGroqKey(null)} className="text-[12px] font-semibold text-danger">
                  Remove
                </button>
              </div>
            </>
          ) : !groqExpanded ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">
              Optional. A <b className="font-semibold text-ink">free</b> Groq key powers the meal
              scanner when your Cohere key isn&apos;t set or is busy — so scanning always works.
            </p>
          ) : (
            <div className="mt-3">
              <ConnectAIForm
                provider="groq"
                allowSkip={false}
                saveLabel={hasGroq ? "Update Groq key" : "Save Groq key"}
                onSaved={() => setGroqExpanded(false)}
              />
            </div>
          )}
        </section>

        <section className="glass-panel rounded-[20px] p-1.5">
          <button
            onClick={() => { haptic("light"); setCustomizerOpen(true); }}
            className="flex w-full items-center justify-between rounded-[15px] px-3 py-3 active:bg-surface-2"
          >
            <span className="flex items-center gap-2.5 text-left">
              <Paintbrush className="size-[18px] text-accent" />
              <span>
                <span className="block text-[14px] font-semibold text-ink">Customize</span>
                <span className="block text-[11px] text-ink-soft">Colors, background, nav, fonts &amp; more</span>
              </span>
            </span>
            <ChevronRight className="size-4 text-ink-faint" />
          </button>
          <button
            onClick={toggle}
            className="flex w-full items-center justify-between rounded-[15px] px-3 py-3 active:bg-surface-2"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
              {theme === "dark" ? <Moon className="size-[18px] text-accent" /> : <Sun className="size-[18px] text-accent" />}
              Appearance
            </span>
            <span className="text-[12px] font-medium capitalize text-ink-soft">{theme}</span>
          </button>
        </section>

        <section className="glass-panel rounded-[20px] p-4">
          <button
            onClick={() => { haptic("light"); setShowWorkoutTabs(!showWorkoutTabs); }}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2.5 text-left">
              <Dumbbell className="size-[18px] text-accent" />
              <span>
                <span className="block text-[14px] font-semibold text-ink">Workout tabs</span>
                <span className="block text-[11px] text-ink-soft">
                  Show Train &amp; workout log in the nav bar
                </span>
              </span>
            </span>
            <div className={`relative h-6 w-11 shrink-0 rounded-full transition ${showWorkoutTabs ? "bg-accent" : "bg-line-strong"}`}>
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: showWorkoutTabs ? "1.375rem" : "0.125rem" }}
              />
            </div>
          </button>
          <p className="mt-2 text-[11px] text-ink-faint">
            Your training data is always saved. Turning this off just hides the Train tab.
          </p>

          <button
            onClick={() => { haptic("light"); setFitnotesOpen(true); }}
            className="mt-3 flex w-full items-center justify-between border-t border-line pt-3"
          >
            <span className="flex items-center gap-2.5 text-left">
              <Upload className="size-[18px] text-accent" />
              <span>
                <span className="block text-[14px] font-semibold text-ink">Import from FitNotes</span>
                <span className="block text-[11px] text-ink-soft">Bring your workout history in from a CSV export</span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          </button>
        </section>

        <section className="glass-panel rounded-[20px] p-1.5">
          <InternalRow icon={BookOpen} label="Setup guide" href="/guide" accent />
          <InternalRow icon={ScrollText} label="Terms of Service" href="/terms" />
          <InternalRow icon={ShieldCheck} label="Privacy Policy" href="/privacy" />
        </section>

        <section className="glass-panel rounded-[20px] p-1.5">
          <LinkRow icon={Code2} label="Source on GitHub" href={REPO_URL} />
          <LinkRow icon={ScrollText} label="License · MIT" href={REPO_URL} />
        </section>

        <Button variant="secondary" full onClick={handleLogout} className="mt-1">
          <LogOut className="size-4" /> Log out
        </Button>
      </div>
    </div>
  );
}

function LinkRow({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="flex items-center justify-between rounded-[15px] px-3 py-3 active:bg-surface-2">
      <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
        <Icon className="size-[18px] text-ink-soft" /> {label}
      </span>
      <ChevronRight className="size-4 text-ink-faint" />
    </a>
  );
}

function InternalRow({ icon: Icon, label, href, accent }: { icon: LucideIcon; label: string; href: string; accent?: boolean }) {
  return (
    <Link href={href}
      className="flex items-center justify-between rounded-[15px] px-3 py-3 active:bg-surface-2">
      <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
        <Icon className={`size-[18px] ${accent ? "text-accent" : "text-ink-soft"}`} /> {label}
      </span>
      <ChevronRight className="size-4 text-ink-faint" />
    </Link>
  );
}
