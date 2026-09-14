"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Portal } from "@/components/ui/Portal";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
  snapPoints?: number[];
  className?: string;
  footer?: ReactNode;
}

const CLOSE_THRESHOLD = 80;

export function BottomSheet({ open, onClose, children, label, snapPoints, className, footer }: BottomSheetProps) {
  const snaps = (snapPoints && snapPoints.length ? snapPoints : [0.62, 0.94])
    .map((n) => Math.max(0.2, Math.min(0.96, n)))
    .sort((a, b) => a - b);

  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const [translateY, setTranslateY] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; base: number } | null>(null);

  const maxH = Math.round(snaps[snaps.length - 1] * vh);
  const offsetFor = useCallback((fraction: number) => Math.max(0, maxH - Math.round(fraction * vh)), [maxH, vh]);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (open) setTranslateY(offsetFor(snaps[0]));
    else setTranslateY(null);
  }, [open, offsetFor, snaps]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    drag.current = { startY: e.clientY, base: translateY ?? offsetFor(snaps[0]) };
    setDragging(true);
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch {}
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const next = drag.current.base + (e.clientY - drag.current.startY);
    setTranslateY(Math.max(0, Math.min(maxH, next)));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const current = drag.current.base + (e.clientY - drag.current.startY);
    drag.current = null;
    setDragging(false);
    try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {}

    const smallestOffset = offsetFor(snaps[0]);
    if (current - smallestOffset > CLOSE_THRESHOLD) { onClose(); return; }
    let best = 0;
    let bestDist = Infinity;
    snaps.forEach((s) => {
      const dist = Math.abs(offsetFor(s) - current);
      if (dist < bestDist) { bestDist = dist; best = offsetFor(s); }
    });
    setTranslateY(best);
  };

  if (!open || translateY == null) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[80]">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`glass-strong absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col rounded-t-[26px] shadow-[var(--shadow-lg)] ${className ?? ""}`}
          style={{
            height: maxH,
            transform: `translateY(${translateY}px)`,
            transition: dragging ? "none" : "transform 0.26s cubic-bezier(0.2,0.7,0.3,1)",
          }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="flex shrink-0 cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing"
            style={{ touchAction: "none" }}
            aria-hidden="true"
          >
            <span className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
          <div className={`thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? "pb-4" : "pb-[max(env(safe-area-inset-bottom),20px)]"}`}>
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-line/60 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
