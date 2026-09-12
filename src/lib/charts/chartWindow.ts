export interface ChartWindow {
  start: number;
  visible: number;
}

export const MIN_VISIBLE = 3;

export function fullWindow(total: number): ChartWindow {
  return { start: 0, visible: Math.max(MIN_VISIBLE, total) };
}

export function clampWindow(w: ChartWindow, total: number): ChartWindow {
  if (total <= 0) return { start: 0, visible: 0 };
  const visible = Math.max(MIN_VISIBLE, Math.min(total, Math.round(w.visible)));
  const maxStart = Math.max(0, total - visible);
  const start = Math.max(0, Math.min(maxStart, Math.round(w.start)));
  return { start, visible };
}

export function panWindow(w: ChartWindow, deltaPoints: number, total: number): ChartWindow {
  return clampWindow({ start: w.start - deltaPoints, visible: w.visible }, total);
}

export function zoomWindow(w: ChartWindow, factor: number, focalFrac: number, total: number): ChartWindow {
  const current = clampWindow(w, total);
  const focalIndex = current.start + focalFrac * (current.visible - 1);
  const nextVisible = Math.max(MIN_VISIBLE, Math.min(total, Math.round(current.visible * factor)));
  const nextStart = Math.round(focalIndex - focalFrac * (nextVisible - 1));
  return clampWindow({ start: nextStart, visible: nextVisible }, total);
}

export function isZoomed(w: ChartWindow, total: number): boolean {
  const c = clampWindow(w, total);
  return c.visible < total;
}

export function nearestIndex(w: ChartWindow, frac: number, total: number): number {
  const c = clampWindow(w, total);
  if (c.visible <= 0) return 0;
  const idx = c.start + Math.round(frac * (c.visible - 1));
  return Math.max(0, Math.min(total - 1, idx));
}

export function fracForIndex(w: ChartWindow, index: number): number | null {
  const end = w.start + w.visible - 1;
  if (index < w.start || index > end) return null;
  if (w.visible <= 1) return 0;
  return (index - w.start) / (w.visible - 1);
}
