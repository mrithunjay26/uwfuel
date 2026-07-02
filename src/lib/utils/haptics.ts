export type Haptic = "light" | "medium" | "heavy" | "success" | "error";

const PATTERNS: Record<Haptic, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: [30, 10, 30],
  success: [10, 50, 10],
  error: [50, 30, 50, 30, 50],
};

export function haptic(style: Haptic = "light") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    const root = typeof document !== "undefined" ? document.documentElement : null;
    const level = root?.getAttribute("data-haptic") ?? "light";
    if (level === "off") return;
    const scale = level === "strong" ? 1.8 : level === "medium" ? 1.3 : 0.8;
    const duration = root?.getAttribute("data-haptic-duration") ?? "normal";
    const durationScale = duration === "long" ? 1.5 : duration === "short" ? 0.65 : 1;
    const pattern = PATTERNS[style];
    const scaled = (Array.isArray(pattern) ? pattern : [pattern]).map((value) => Math.max(1, Math.round(value * scale * durationScale)));
    navigator.vibrate(Array.isArray(pattern) ? scaled : scaled[0]);
  } catch {
  }
}
