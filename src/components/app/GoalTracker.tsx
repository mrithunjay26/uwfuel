"use client";

import { useState } from "react";
import { CalendarClock, Lightbulb, Send, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useConfig } from "@/lib/config/ConfigContext";
import { callCohere } from "@/lib/ai/cohere";
import type { GoalAssessment, GoalStatus } from "@/lib/utils/goals";

interface GoalTrackerProps {
  assessment: GoalAssessment;
  months: number;
  phase: string;
  nutrition?: {
    avgCalories: number;
    targetCalories: number;
    avgProtein: number;
    proteinTarget: number;
  };
}

const STATUS_STYLES: Record<GoalStatus, { pill: string; bar: string }> = {
  achieved: { pill: "bg-success/15 text-success", bar: "bg-success" },
  ahead: { pill: "bg-success/15 text-success", bar: "bg-success" },
  on_track: { pill: "bg-success/15 text-success", bar: "bg-success" },
  behind: { pill: "bg-warning/15 text-warning", bar: "bg-warning" },
  off_track: { pill: "bg-danger/15 text-danger", bar: "bg-danger" },
  deadline_passed: { pill: "bg-danger/15 text-danger", bar: "bg-danger" },
  no_data: { pill: "bg-surface-3 text-ink-soft", bar: "bg-accent" },
  no_goal: { pill: "bg-surface-3 text-ink-soft", bar: "bg-accent" },
};

function rateLabel(rate: number | null): string {
  if (rate == null) return "n/a";
  const v = Math.abs(rate);
  if (v < 0.05) return "steady";
  return `${rate > 0 ? "+" : "-"}${v.toFixed(1)} lb/wk`;
}

export function GoalTracker({ assessment: a, months, phase, nutrition }: GoalTrackerProps) {
  const { cohereKey, hasCohere } = useConfig();
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const styles = STATUS_STYLES[a.status];
  const totalDaysLeft = Math.max(0, Math.ceil(a.weeksLeft * 7));
  const weeksLeft = Math.floor(totalDaysLeft / 7);
  const daysLeft = totalDaysLeft % 7;
  const targetLabel = a.targetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const DirIcon = a.direction === "gain" ? TrendingUp : a.direction === "lose" ? TrendingDown : Target;

  function goalContext(): string {
    const lines = [
      `Goal: ${a.direction} weight from ${a.startWeight.toFixed(0)} to ${a.goalWeight.toFixed(0)} lbs over ${months} months.`,
      `Current ${a.currentWeight.toFixed(1)} lbs, ${weeksLeft} weeks and ${daysLeft} days left, ${Math.abs(a.remainingLbs).toFixed(1)} lbs to go.`,
      `Recent pace ${rateLabel(a.actualRate)}; pace needed ${rateLabel(a.requiredRate)}. Training phase: ${phase}. Status: ${a.headline}.`,
    ];
    if (nutrition) {
      lines.push(
        `Average intake ${nutrition.avgCalories} kcal (target ${nutrition.targetCalories}), protein ${nutrition.avgProtein}g (target ${nutrition.proteinTarget}g).`,
      );
    }
    return lines.join("\n");
  }

  async function getInsights() {
    if (!cohereKey || loadingAi) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const prompt = `You are a concise, supportive fitness and nutrition coach for a college student.
${goalContext()}

Give exactly 3 specific, actionable bullet points on what to change to hit this goal on time. Adjust calories, protein, training, or consistency as relevant to the numbers above. Each bullet must be under 18 words and start with "- ". No preamble, no sign off.`;
      const reply = await callCohere(cohereKey, prompt, { temperature: 0.6 });
      setInsights(reply);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not load insights.");
    } finally {
      setLoadingAi(false);
    }
  }

  async function askGoal() {
    if (!cohereKey || asking || question.trim().length < 3) return;
    setAsking(true);
    setAiError(null);
    setAnswer(null);
    try {
      const prompt = `You are a supportive, practical fitness & nutrition coach for a college student. Here is their goal status:
${goalContext()}

The student asks: "${question.trim()}"

Answer specifically using their numbers above. Be encouraging and concrete (calories, protein, training, habits). Keep it under 120 words. Use short sentences or "- " bullets. No sign-off.`;
      const reply = await callCohere(cohereKey, prompt, { temperature: 0.6 });
      setAnswer(reply);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not get an answer.");
    } finally {
      setAsking(false);
    }
  }

  const insightItems = insights
    ? insights.split("\n").map((l) => l.replace(/^[-*•\d.\s]+/, "").trim()).filter(Boolean)
    : [];

  return (
    <section>
      <h2 className="mb-3 font-display text-[16px] font-extrabold text-ink">Goal</h2>
      <div className="glass-panel rounded-[20px] p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
              <DirIcon className="size-[18px]" />
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-ink">
                {a.direction === "maintain" ? "Maintain" : a.direction === "gain" ? "Gain to" : "Cut to"} {a.goalWeight} lbs
              </p>
              <p className="text-[11px] text-ink-soft">from {a.startWeight} lbs</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.pill}`}>{a.headline}</span>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[30px] font-extrabold leading-none text-ink">{weeksLeft}</span>
            <span className="text-[12px] font-semibold text-ink-soft">wk</span>
            <span className="font-display ml-1 text-[22px] font-extrabold leading-none text-ink">{daysLeft}</span>
            <span className="text-[12px] font-semibold text-ink-soft">days left</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-faint">
            <CalendarClock className="size-3.5" /> {targetLabel}
          </span>
        </div>

        <div className="mt-2.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-line-strong">
            <div className={`h-full rounded-full transition-all ${styles.bar}`} style={{ width: `${Math.round(a.progressPct * 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
            <span>{a.startWeight} lbs</span>
            <span>{Math.round(a.progressPct * 100)}% there</span>
            <span>{a.goalWeight} lbs</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Current" value={`${a.currentWeight.toFixed(1)}`} unit="lbs" />
          <Metric label="To go" value={`${Math.abs(a.remainingLbs).toFixed(1)}`} unit="lbs" />
          <Metric label="Your pace" value={rateLabel(a.actualRate)} unit={`need ${rateLabel(a.requiredRate)}`} />
        </div>

        <p className="mt-3 rounded-[12px] bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
          {a.detail}
        </p>

        {hasCohere && (
          <div className="mt-3">
            {insightItems.length === 0 ? (
              <button
                onClick={getInsights}
                disabled={loadingAi}
                className="press flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-accent py-2.5 text-[13px] font-bold text-accent-contrast disabled:opacity-60"
              >
                <Sparkles className="size-4" /> {loadingAi ? "Thinking…" : "Get AI insights"}
              </button>
            ) : (
              <div className="rounded-[14px] border border-accent/20 bg-accent-soft/50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-accent-ink">
                  <Lightbulb className="size-3.5" /> Things to work on
                </p>
                <ul className="flex flex-col gap-1.5">
                  {insightItems.map((item, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { setInsights(null); getInsights(); }}
                  disabled={loadingAi}
                  className="mt-2 text-[11px] font-semibold text-accent-ink disabled:opacity-60"
                >
                  {loadingAi ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            )}

            {/* Ask the AI a specific question about reaching this goal */}
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <Sparkles className="size-3" /> Ask about your goal
              </p>
              <form onSubmit={(e) => { e.preventDefault(); askGoal(); }} className="flex items-center gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. How do I break my plateau?"
                  className="w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={asking || question.trim().length < 3}
                  aria-label="Ask"
                  className="press grid size-9 shrink-0 place-items-center rounded-[12px] bg-accent text-accent-contrast disabled:opacity-50"
                >
                  <Send className="size-4" />
                </button>
              </form>
              {(asking || answer) && (
                <div className="mt-2 rounded-[12px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
                  {asking ? "Thinking…" : <FormattedAnswer content={answer ?? ""} />}
                </div>
              )}
            </div>
            {aiError && <p className="mt-2 text-[12px] text-danger">{aiError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

// Renders AI text with **bold** and "- " bullets, like the chat tab.
function FormattedAnswer({ content }: { content: string }) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => {
        const bullet = /^[-*•]\s+/.test(line);
        const text = bullet ? line.replace(/^[-*•]\s+/, "") : line;
        return bullet ? (
          <span key={i} className="flex gap-1.5">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
            <span>{boldParts(text)}</span>
          </span>
        ) : (
          <p key={i}>{boldParts(text)}</p>
        );
      })}
    </div>
  );
}

function boldParts(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[12px] bg-surface-2 px-2.5 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-display text-[15px] font-extrabold text-ink">{value}</p>
      <p className="text-[9px] text-ink-faint">{unit}</p>
    </div>
  );
}
