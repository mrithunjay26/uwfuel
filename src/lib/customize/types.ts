export type BgStyle = "aurora" | "solid" | "gradient" | "mesh" | "preset" | "image";
export type GlowLevel = "off" | "low" | "medium" | "high";
export type NavSize = "compact" | "default" | "large";
export type FabShape = "circle" | "squircle" | "square";
export type FontChoice = "default" | "system" | "serif" | "mono";
export type CornerStyle = "default" | "round" | "soft" | "sharp";
export type PanelStyle = "default" | "solid" | "bordered" | "minimal";
export type ShapeMotif =
  | "none" | "blobs" | "leaves" | "dumbbells" | "koalas" | "huskies"
  | "hearts" | "stars" | "coffee" | "paws" | "music" | "books"
  | "waves" | "mountains" | "rainy" | "flowers";

export interface Customize {
  accent: string;        // hex, e.g. "#6c5cf2"
  bgStyle: BgStyle;
  bgPreset: string;      // id from BG_PRESETS (used when bgStyle === "preset")
  bgImageUrl: string;    // image URL (used when bgStyle === "image")
  bgImageDim: number;    // 0–80 — contrast scrim over the photo, as %
  glow: GlowLevel;
  blur: number;          // glass blur in px (0–34)
  shapeMotif: ShapeMotif; // themed decorations behind the app
  autoNight: boolean;    // data-adaptive warm/dim tone after dark
  highContrast: boolean; // boost text + panel contrast for accessibility
  corners: CornerStyle;  // global corner roundness for surfaces & inputs
  panel: PanelStyle;     // glass / solid / bordered surface treatment
  reduceMotion: boolean; // calm mode — disable animations & transitions
  navSize: NavSize;
  navLabels: boolean;
  fabShape: FabShape;
  font: FontChoice;
}

export const DEFAULT_ACCENT = "#6c5cf2";

export const DEFAULT_CUSTOMIZE: Customize = {
  accent: DEFAULT_ACCENT,
  bgStyle: "aurora",
  bgPreset: "ocean",
  bgImageUrl: "",
  bgImageDim: 35,
  glow: "medium",
  blur: 18,
  shapeMotif: "none",
  autoNight: false,
  highContrast: false,
  corners: "default",
  panel: "default",
  reduceMotion: false,
  navSize: "default",
  navLabels: true,
  fabShape: "squircle",
  font: "default",
};

/** Calming, theme-adaptive gradient presets (translucent over --bg-base). */
export interface BgPreset { id: string; name: string; swatch: string; gradient: string; }
export const BG_PRESETS: BgPreset[] = [
  { id: "ocean", name: "Calm Ocean", swatch: "linear-gradient(135deg,#60a5fa,#22d3ee)",
    gradient: "linear-gradient(160deg, rgba(96,165,250,0.28), transparent 60%), radial-gradient(90% 60% at 100% 100%, rgba(34,211,238,0.20), transparent 60%)" },
  { id: "sage", name: "Sage Meadow", swatch: "linear-gradient(135deg,#86efac,#a7f3d0)",
    gradient: "linear-gradient(160deg, rgba(134,239,172,0.32), transparent 60%), radial-gradient(85% 55% at 90% 100%, rgba(110,231,183,0.22), transparent 60%)" },
  { id: "lavender", name: "Lavender Haze", swatch: "linear-gradient(135deg,#c4b5fd,#f0abfc)",
    gradient: "linear-gradient(160deg, rgba(196,181,253,0.32), transparent 60%), radial-gradient(85% 55% at 100% 0%, rgba(240,171,252,0.22), transparent 55%)" },
  { id: "sunset", name: "Sunset Warmth", swatch: "linear-gradient(135deg,#fdba74,#fb7185)",
    gradient: "linear-gradient(160deg, rgba(253,186,116,0.32), transparent 60%), radial-gradient(85% 55% at 100% 100%, rgba(251,113,133,0.24), transparent 60%)" },
  { id: "mint", name: "Mint Breeze", swatch: "linear-gradient(135deg,#5eead4,#a7f3d0)",
    gradient: "linear-gradient(160deg, rgba(94,234,212,0.30), transparent 60%), radial-gradient(85% 55% at 10% 100%, rgba(167,243,208,0.22), transparent 60%)" },
  { id: "rose", name: "Rose Quartz", swatch: "linear-gradient(135deg,#fbcfe8,#fda4af)",
    gradient: "linear-gradient(160deg, rgba(251,207,232,0.36), transparent 60%), radial-gradient(85% 55% at 100% 0%, rgba(253,164,175,0.24), transparent 55%)" },
  { id: "forest", name: "Deep Forest", swatch: "linear-gradient(135deg,#34d399,#10b981)",
    gradient: "linear-gradient(160deg, rgba(52,211,153,0.28), transparent 60%), radial-gradient(90% 60% at 50% 105%, rgba(16,185,129,0.20), transparent 58%)" },
  { id: "twilight", name: "Twilight", swatch: "linear-gradient(135deg,#818cf8,#6366f1)",
    gradient: "linear-gradient(160deg, rgba(129,140,248,0.30), transparent 60%), radial-gradient(85% 55% at 100% 100%, rgba(99,102,241,0.24), transparent 60%)" },
  { id: "peach", name: "Soft Peach", swatch: "linear-gradient(135deg,#fed7aa,#fecaca)",
    gradient: "linear-gradient(160deg, rgba(254,215,170,0.36), transparent 60%), radial-gradient(85% 55% at 0% 100%, rgba(254,202,202,0.26), transparent 60%)" },
];

/** Themed background decorations. Emoji glyphs scatter behind the app. */
export const SHAPE_MOTIFS: { id: ShapeMotif; label: string; emoji: string; glyphs: string[] }[] = [
  { id: "none",      label: "None",    emoji: "⊘",  glyphs: [] },
  { id: "blobs",     label: "Blobs",   emoji: "🔮", glyphs: [] },
  { id: "leaves",    label: "Leaves",  emoji: "🍃", glyphs: ["🍃", "🌿", "🍂"] },
  { id: "dumbbells", label: "Gym",     emoji: "🏋️", glyphs: ["🏋️", "💪", "🏋️‍♀️", "🤸"] },
  { id: "koalas",    label: "Koalas",  emoji: "🐨", glyphs: ["🐨", "🌿", "🐨", "🍃"] },
  { id: "huskies",   label: "Huskies", emoji: "🐶", glyphs: ["🐶", "🐾", "🐺", "🐾"] },
  { id: "hearts",    label: "Hearts",  emoji: "💜", glyphs: ["💜", "💗", "🤍", "💖"] },
  { id: "stars",     label: "Stars",   emoji: "⭐", glyphs: ["⭐", "✨", "🌟", "💫"] },
  { id: "coffee",    label: "Coffee",  emoji: "☕", glyphs: ["☕", "🫖", "🧋"] },
  { id: "paws",      label: "Paws",    emoji: "🐾", glyphs: ["🐾"] },
  { id: "music",     label: "Music",   emoji: "🎵", glyphs: ["🎵", "🎶", "🎧"] },
  { id: "books",     label: "Study",   emoji: "📚", glyphs: ["📚", "📖", "✏️", "🎓"] },
  { id: "waves",     label: "Ocean",   emoji: "🌊", glyphs: ["🌊", "💧", "🐚"] },
  { id: "mountains", label: "Peaks",   emoji: "🏔️", glyphs: ["🏔️", "⛰️", "🌲"] },
  { id: "rainy",     label: "Rainy",   emoji: "🌧️", glyphs: ["🌧️", "💧", "☁️"] },
  { id: "flowers",   label: "Bloom",   emoji: "🌸", glyphs: ["🌸", "🌺", "🌷", "🌼"] },
];

const SHAPE_MOTIF_IDS = SHAPE_MOTIFS.map((m) => m.id);

export function getBgPreset(id: string): BgPreset {
  return BG_PRESETS.find((p) => p.id === id) ?? BG_PRESETS[0];
}

/** Accept only http(s) or data image URLs, and reject characters that would break url(). */
export function isValidImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v || /["'()\\]/.test(v) || /[\n\r]/.test(v)) return false;
  return /^https:\/\/\S+$/i.test(v) || /^http:\/\/\S+$/i.test(v) || /^data:image\/[a-z+]+;base64,[\w+/=]+$/i.test(v);
}

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: "Husky Purple", hex: "#6c5cf2" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Ocean", hex: "#2563eb" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Emerald", hex: "#059669" },
  { name: "Lime", hex: "#65a30d" },
  { name: "Amber", hex: "#d97706" },
  { name: "Sunset", hex: "#ea580c" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Pink", hex: "#db2777" },
  { name: "Fuchsia", hex: "#c026d3" },
  { name: "Slate", hex: "#475569" },
];

/* ── color helpers ─────────────────────────────────────────────── */

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const int = parseInt(h, 16);
  if (Number.isNaN(int) || h.length !== 6) return [108, 92, 242];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function mix(hex: string, target: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(target);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isValidHex(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim()) || /^#?[0-9a-fA-F]{3}$/.test(value.trim());
}

export function normalizeHex(value: string): string {
  let h = value.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) h = `#${h.slice(1).split("").map((c) => c + c).join("")}`;
  return h.toLowerCase();
}

const GLOW_ALPHA: Record<GlowLevel, [number, number]> = {
  off: [0, 0],
  low: [0.07, 0.04],
  medium: [0.13, 0.08],
  high: [0.22, 0.14],
};

export interface ComputedCustomize {
  vars: Record<string, string>;
  attrs: Record<string, string>;
}

// Every CSS var the customizer may set. Anything here that isn't produced for
// the current settings gets removed, so the tuned default theme shows through.
export const MANAGED_VARS = [
  "--accent", "--accent-strong", "--accent-ink", "--accent-soft", "--accent-contrast",
  "--fab", "--fab-ink", "--hero-from", "--hero-to", "--hero-ink",
  "--shadow-fab", "--shadow-hero", "--glow-1", "--glow-2", "--glass-blur",
  "--custom-bg-a", "--custom-bg-b", "--bg-gradient", "--bg-url", "--bg-dim",
] as const;

/**
 * Turn settings into a flat CSS-variable + data-attribute map (theme-independent).
 * Accent/glow/blur tokens are only emitted when the user has actually changed
 * them from the defaults, so an un-customized app keeps its hand-tuned theme.
 */
export function computeCustomize(c: Customize): ComputedCustomize {
  const a = isValidHex(c.accent) ? normalizeHex(c.accent) : DEFAULT_ACCENT;
  const contrast = luminance(a) > 0.62 ? "#14161d" : "#ffffff";
  const [g1, g2] = GLOW_ALPHA[c.glow] ?? GLOW_ALPHA.medium;

  const vars: Record<string, string> = {
    // Always available — only referenced by non-default backgrounds / shapes.
    "--custom-bg-a": rgba(a, 0.16),
    "--custom-bg-b": rgba(mix(a, "#000000", 0.3), 0.1),
  };

  if (a !== DEFAULT_ACCENT) {
    Object.assign(vars, {
      "--accent": a,
      "--accent-strong": mix(a, "#000000", 0.15),
      "--accent-ink": a,
      "--accent-soft": rgba(a, 0.16),
      "--accent-contrast": contrast,
      "--fab": a,
      "--fab-ink": contrast,
      "--hero-from": a,
      "--hero-to": mix(a, "#000000", 0.24),
      "--hero-ink": contrast,
      "--shadow-fab": `0 8px 22px ${rgba(a, 0.3)}`,
      "--shadow-hero": `0 16px 38px ${rgba(a, 0.28)}`,
    });
  }

  if (a !== DEFAULT_ACCENT || c.glow !== "medium") {
    vars["--glow-1"] = rgba(a, g1);
    vars["--glow-2"] = rgba(mix(a, "#000000", 0.2), g2);
  }

  if (c.blur !== DEFAULT_CUSTOMIZE.blur) {
    vars["--glass-blur"] = `${clamp(c.blur, 0, 40)}px`;
  }

  if (c.bgStyle === "preset") {
    vars["--bg-gradient"] = getBgPreset(c.bgPreset).gradient;
  }

  if (c.bgStyle === "image" && isValidImageUrl(c.bgImageUrl)) {
    vars["--bg-url"] = `url("${c.bgImageUrl.trim()}")`;
    vars["--bg-dim"] = `rgba(var(--scrim-rgb), ${(clamp(c.bgImageDim, 0, 80) / 100).toFixed(2)})`;
  }

  // A photo background with no valid URL falls back to the plain base canvas.
  const effectiveBg = c.bgStyle === "image" && !isValidImageUrl(c.bgImageUrl) ? "solid" : c.bgStyle;

  const attrs: Record<string, string> = {
    "data-bg": effectiveBg,
    "data-shapes": c.shapeMotif === "blobs" ? "on" : "off",
    "data-contrast": c.highContrast ? "high" : "off",
    "data-corners": c.corners,
    "data-panel": c.panel,
    "data-motion": c.reduceMotion ? "calm" : "full",
    "data-font": c.font,
  };

  return { vars, attrs };
}

export function parseCustomize(raw: unknown): Customize {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CUSTOMIZE };
  const v = raw as Partial<Customize> & { shapes?: boolean };
  // Migrate the old boolean `shapes` flag → motif.
  const motif = SHAPE_MOTIF_IDS.includes(v.shapeMotif as ShapeMotif)
    ? (v.shapeMotif as ShapeMotif)
    : typeof v.shapes === "boolean"
      ? (v.shapes ? "blobs" : "none")
      : DEFAULT_CUSTOMIZE.shapeMotif;
  return {
    accent: isValidHex(String(v.accent ?? "")) ? normalizeHex(String(v.accent)) : DEFAULT_CUSTOMIZE.accent,
    bgStyle: (["aurora", "solid", "gradient", "mesh", "preset", "image"] as BgStyle[]).includes(v.bgStyle as BgStyle) ? (v.bgStyle as BgStyle) : DEFAULT_CUSTOMIZE.bgStyle,
    bgPreset: BG_PRESETS.some((p) => p.id === v.bgPreset) ? String(v.bgPreset) : DEFAULT_CUSTOMIZE.bgPreset,
    bgImageUrl: typeof v.bgImageUrl === "string" && isValidImageUrl(v.bgImageUrl) ? v.bgImageUrl.trim() : DEFAULT_CUSTOMIZE.bgImageUrl,
    bgImageDim: typeof v.bgImageDim === "number" ? clamp(v.bgImageDim, 0, 80) : DEFAULT_CUSTOMIZE.bgImageDim,
    glow: (["off", "low", "medium", "high"] as GlowLevel[]).includes(v.glow as GlowLevel) ? (v.glow as GlowLevel) : DEFAULT_CUSTOMIZE.glow,
    blur: typeof v.blur === "number" ? clamp(v.blur, 0, 40) : DEFAULT_CUSTOMIZE.blur,
    shapeMotif: motif,
    autoNight: typeof v.autoNight === "boolean" ? v.autoNight : DEFAULT_CUSTOMIZE.autoNight,
    highContrast: typeof v.highContrast === "boolean" ? v.highContrast : DEFAULT_CUSTOMIZE.highContrast,
    corners: (["default", "round", "soft", "sharp"] as CornerStyle[]).includes(v.corners as CornerStyle) ? (v.corners as CornerStyle) : DEFAULT_CUSTOMIZE.corners,
    panel: (["default", "solid", "bordered", "minimal"] as PanelStyle[]).includes(v.panel as PanelStyle) ? (v.panel as PanelStyle) : DEFAULT_CUSTOMIZE.panel,
    reduceMotion: typeof v.reduceMotion === "boolean" ? v.reduceMotion : DEFAULT_CUSTOMIZE.reduceMotion,
    navSize: (["compact", "default", "large"] as NavSize[]).includes(v.navSize as NavSize) ? (v.navSize as NavSize) : DEFAULT_CUSTOMIZE.navSize,
    navLabels: typeof v.navLabels === "boolean" ? v.navLabels : DEFAULT_CUSTOMIZE.navLabels,
    fabShape: (["circle", "squircle", "square"] as FabShape[]).includes(v.fabShape as FabShape) ? (v.fabShape as FabShape) : DEFAULT_CUSTOMIZE.fabShape,
    font: (["default", "system", "serif", "mono"] as FontChoice[]).includes(v.font as FontChoice) ? (v.font as FontChoice) : DEFAULT_CUSTOMIZE.font,
  };
}
