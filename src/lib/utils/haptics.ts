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
    navigator.vibrate(PATTERNS[style]);
  } catch {
  }
}
