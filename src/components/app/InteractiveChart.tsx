"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  clampWindow,
  fullWindow,
  isZoomed,
  nearestIndex,
  panWindow,
  zoomWindow,
  fracForIndex,
  type ChartWindow,
} from "@/lib/charts/chartWindow";

export interface ChartPoint {
  dateKey: string;
  value: number;
}

interface InteractiveChartProps {
  points: ChartPoint[];
  color?: string;
  height?: number;
  type?: "line" | "bar";
  target?: number;
  selectedKey?: string | null;
  onSelect?: (dateKey: string) => void;
  formatValue?: (value: number) => string;
  formatDate?: (dateKey: string) => string;
}

const W = 320;
const PAD_X = 8;
const PAD_Y = 10;

function defaultDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function InteractiveChart({
  points,
  color = "var(--color-accent)",
  height = 120,
  type = "line",
  target,
  selectedKey,
  onSelect,
  formatValue = (v) => String(Math.round(v)),
  formatDate = defaultDate,
}: InteractiveChartProps) {
  const total = points.length;
  const [win, setWin] = useState<ChartWindow>(() => fullWindow(total));
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{ startX: number; win: ChartWindow; moved: boolean; pinchDist: number; focal: number } | null>(null);

  useEffect(() => { setWin((w) => clampWindow(w, total)); }, [total]);

  const rectWidth = () => containerRef.current?.getBoundingClientRect().width ?? W;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (total < 2) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const focal = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
      const factor = e.deltaY > 0 ? 1.18 : 0.85;
      setWin((w) => zoomWindow(w, factor, Math.max(0, Math.min(1, focal)), total));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [total]);

  const view = useMemo(() => {
    const c = clampWindow(win, total);
    const slice = points.slice(c.start, c.start + c.visible);
    const vals = slice.map((p) => p.value);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const range = max - min || 1;
    const innerW = W - PAD_X * 2;
    const innerH = height - PAD_Y * 2;
    const xy = slice.map((p, i) => ({
      x: PAD_X + (slice.length <= 1 ? innerW / 2 : (i / (slice.length - 1)) * innerW),
      y: PAD_Y + innerH - ((p.value - min) / range) * innerH,
      p,
      globalIndex: c.start + i,
    }));
    return { c, slice, xy, min, max, innerW, innerH };
  }, [win, points, total, height]);

  const selectedFrac = useMemo(() => {
    if (!selectedKey) return null;
    const gi = points.findIndex((p) => p.dateKey === selectedKey);
    if (gi < 0) return null;
    return fracForIndex(clampWindow(win, total), gi);
  }, [selectedKey, points, win, total]);

  function onPointerDown(e: React.PointerEvent) {
    if (total < 2) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { startX: e.clientX, win: clampWindow(win, total), moved: false, pinchDist: 0, focal: 0 };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = containerRef.current?.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - (rect?.left ?? 0);
      gesture.current = {
        startX: 0,
        win: clampWindow(win, total),
        moved: true,
        pinchDist: Math.hypot(a.x - b.x, a.y - b.y),
        focal: rect?.width ? Math.max(0, Math.min(1, midX / rect.width)) : 0.5,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const width = rectWidth();

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinchDist > 0) {
        const factor = g.pinchDist / dist;
        setWin(zoomWindow(g.win, factor, g.focal, total));
      }
      return;
    }

    const dx = e.clientX - g.startX;
    if (Math.abs(dx) > 4) g.moved = true;
    const deltaPoints = Math.round((dx / width) * g.win.visible);
    setWin(panWindow(g.win, deltaPoints, total));
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    const wasMoved = g?.moved ?? true;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (!wasMoved && onSelect) {
        const width = rectWidth();
        const rect = containerRef.current?.getBoundingClientRect();
        const frac = rect && width ? (e.clientX - rect.left) / width : 0.5;
        const idx = nearestIndex(clampWindow(win, total), Math.max(0, Math.min(1, frac)), total);
        if (points[idx]) onSelect(points[idx].dateKey);
      }
      gesture.current = null;
    }
  }

  if (total === 0) {
    return <div style={{ height }} className="grid place-items-center text-[12px] text-ink-faint">No data yet</div>;
  }

  const linePath = view.xy.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  const targetY = target != null && view.max !== view.min
    ? PAD_Y + view.innerH - ((target - view.min) / (view.max - view.min || 1)) * view.innerH
    : null;

  return (
    <div className="relative select-none">
      {isZoomed(win, total) && (
        <button
          onClick={() => setWin(fullWindow(total))}
          className="press absolute right-1 top-1 z-10 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[10px] font-bold text-ink-soft shadow-[var(--shadow-sm)] backdrop-blur"
        >
          <RotateCcw className="size-3" /> Reset
        </button>
      )}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ height, touchAction: "none", cursor: total > 2 ? "ew-resize" : "default" }}
      >
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
          {targetY != null && (
            <line x1={0} y1={targetY} x2={W} y2={targetY} stroke="var(--color-danger)" strokeWidth={0.75} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}

          {selectedFrac != null && (
            <line
              x1={PAD_X + selectedFrac * view.innerW}
              y1={0}
              x2={PAD_X + selectedFrac * view.innerW}
              y2={height}
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {type === "bar" ? (
            view.xy.map((pt) => {
              const bw = view.slice.length > 0 ? (view.innerW / view.slice.length) * 0.6 : 4;
              const selected = pt.p.dateKey === selectedKey;
              return (
                <rect
                  key={pt.p.dateKey}
                  x={pt.x - bw / 2}
                  y={pt.y}
                  width={bw}
                  height={Math.max(0, height - PAD_Y - pt.y)}
                  fill={color}
                  fillOpacity={selected ? 1 : 0.55}
                  rx={1}
                />
              );
            })
          ) : (
            <>
              <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {view.xy.map((pt) => {
                const selected = pt.p.dateKey === selectedKey;
                return (
                  <circle
                    key={pt.p.dateKey}
                    cx={pt.x}
                    cy={pt.y}
                    r={selected ? 4 : view.slice.length > 24 ? 0 : 2}
                    fill={selected ? "var(--color-accent)" : color}
                    stroke={selected ? "var(--color-surface)" : "none"}
                    strokeWidth={selected ? 1.5 : 0}
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
        <span>{view.slice[0] ? formatDate(view.slice[0].dateKey) : ""}</span>
        {selectedKey ? (
          <span className="font-semibold text-ink">
            {formatDate(selectedKey)} · {formatValue(points.find((p) => p.dateKey === selectedKey)?.value ?? 0)}
          </span>
        ) : (
          <span>{total > 3 ? "Drag to pan · scroll or pinch to zoom · tap a day" : ""}</span>
        )}
        <span>{view.slice[view.slice.length - 1] ? formatDate(view.slice[view.slice.length - 1].dateKey) : ""}</span>
      </div>
    </div>
  );
}
