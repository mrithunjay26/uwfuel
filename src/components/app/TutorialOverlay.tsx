"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { useTutorial } from "@/lib/tutorial/TutorialContext";
import { TOUR_STEPS } from "@/lib/tutorial/steps";

const PADDING = 8;

export function TutorialOverlay() {
  const { active, index, total, next, back, stop } = useTutorial();
  const pathname = usePathname();
  const router = useRouter();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = TOUR_STEPS[index];

  useEffect(() => {
    if (!active || !step) return;
    setReady(false);
    setRect(null);

    if (step.route && pathname !== step.route) {
      router.push(step.route);
      return;
    }
    if (!step.target) {
      setReady(true);
      return;
    }

    let raf = 0;
    const started = Date.now();
    const find = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        try { el.scrollIntoView({ block: "center", behavior: "auto" }); } catch {}
        setRect(el.getBoundingClientRect());
        setReady(true);
        return;
      }
      if (Date.now() - started > 1800) { setReady(true); return; }
      raf = requestAnimationFrame(find);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [active, index, step, pathname, router]);

  useLayoutEffect(() => {
    if (!active || !step?.target) return;
    const remeasure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [active, step]);

  if (!active || !step) return null;

  const hasSpot = ready && rect != null;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;

  const spot = hasSpot
    ? {
        top: Math.max(0, rect!.top - PADDING),
        left: Math.max(0, rect!.left - PADDING),
        width: rect!.width + PADDING * 2,
        height: rect!.height + PADDING * 2,
      }
    : null;

  const below = spot ? spot.top + spot.height + 14 : 0;
  const placeBelow = spot ? spot.top + spot.height / 2 < vh * 0.5 : true;
  const cardTop = spot ? (placeBelow ? below : undefined) : undefined;
  const cardBottom = spot && !placeBelow ? vh - spot.top + 14 : undefined;
  const cardLeft = spot ? Math.min(Math.max(12, spot.left), Math.max(12, vw - 332)) : undefined;

  const isLast = index === total - 1;

  const card = (
    <div
      className="animate-rise pointer-events-auto absolute w-[min(320px,calc(100vw-24px))] rounded-[18px] border border-line bg-bg p-4 shadow-[var(--shadow-lg)]"
      style={
        spot
          ? { top: cardTop, bottom: cardBottom, left: cardLeft }
          : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[15px] font-extrabold text-ink">{step.title}</p>
        <button onClick={() => stop(true)} aria-label="Skip tour" className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft">
          <X className="size-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>

      <div className="mt-3 flex items-center gap-1">
        {TOUR_STEPS.map((s, i) => (
          <span key={s.id} className={`h-1 rounded-full transition-all ${i === index ? "w-4 bg-accent" : "w-1 bg-line-strong"}`} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => stop(true)} className="text-[12px] font-semibold text-ink-faint">
          Skip
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button onClick={back} className="press flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-bold text-ink-soft">
              <ArrowLeft className="size-3.5" /> Back
            </button>
          )}
          <button onClick={next} className="press flex items-center gap-1 rounded-full bg-accent px-4 py-1.5 text-[12px] font-bold text-accent-contrast">
            {isLast ? "Done" : "Next"} {!isLast && <ArrowRight className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[100]">
        {spot ? (
          <div
            className="pointer-events-auto absolute rounded-[14px]"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)",
              outline: "2px solid var(--color-accent)",
              transition: "all 0.2s ease",
            }}
          />
        ) : (
          <div className="pointer-events-auto absolute inset-0 bg-black/66" />
        )}
        {card}
      </div>
    </Portal>
  );
}
