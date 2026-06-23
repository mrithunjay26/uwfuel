"use client";

import { useEffect, useState } from "react";
import { Check, Contrast, Image as ImageIcon, Moon, MoonStar, Paintbrush, RotateCcw, Sun, X } from "lucide-react";
import { useCustomize } from "@/lib/customize/CustomizeContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import {
  ACCENT_PRESETS,
  BG_PRESETS,
  SHAPE_MOTIFS,
  isValidHex,
  isValidImageUrl,
  normalizeHex,
  type BgStyle,
  type CornerStyle,
  type FabShape,
  type FontChoice,
  type GlowLevel,
  type NavSize,
  type PanelStyle,
} from "@/lib/customize/types";
import { haptic } from "@/lib/utils/haptics";

export function CustomizerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { customize, setCustomize, reset } = useCustomize();
  const { theme, toggle } = useTheme();
  const [hexInput, setHexInput] = useState(customize.accent);
  const [urlInput, setUrlInput] = useState(customize.bgImageUrl);

  useEffect(() => { setHexInput(customize.accent); }, [customize.accent]);
  useEffect(() => { setUrlInput(customize.bgImageUrl); }, [customize.bgImageUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="animate-rise relative mt-auto flex max-h-[92dvh] flex-col rounded-t-[26px] border-t border-line bg-bg shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Paintbrush className="size-[18px] text-accent" />
            <h2 className="font-display text-[17px] font-extrabold text-ink">Customize</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { haptic("medium"); reset(); }}
              className="press flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-bold text-ink-soft"
            >
              <RotateCcw className="size-3.5" /> Reset
            </button>
            <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-ink-soft">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="thin-scrollbar flex flex-col gap-6 overflow-y-auto px-5 py-5">

          {/* Appearance */}
          <Group title="Appearance" hint="Light or dark base.">
            <div className="flex gap-2">
              {([["light", Sun], ["dark", Moon]] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  onClick={() => { if (theme !== mode) toggle(); haptic("light"); }}
                  className={`press flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3 text-[13px] font-bold capitalize transition ${
                    theme === mode ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                  }`}
                >
                  <Icon className="size-4" /> {mode}
                </button>
              ))}
            </div>
          </Group>

          {/* Accessibility */}
          <Group title="Accessibility & comfort" hint="Readability and eye-strain helpers.">
            <Toggle
              label="High contrast"
              hint="Stronger text, solid panels, bolder borders."
              icon={<Contrast className="size-4 text-accent" />}
              on={customize.highContrast}
              onToggle={() => setCustomize({ highContrast: !customize.highContrast })}
            />
            <Toggle
              className="mt-3"
              label="Adaptive night tone"
              hint="Warms and dims the canvas automatically after dark."
              icon={<MoonStar className="size-4 text-accent" />}
              on={customize.autoNight}
              onToggle={() => setCustomize({ autoNight: !customize.autoNight })}
            />
          </Group>

          {/* Accent */}
          <Group title="Accent color" hint="Drives buttons, highlights, gradients and glow.">
            <div className="grid grid-cols-6 gap-2.5">
              {ACCENT_PRESETS.map((p) => {
                const selected = customize.accent === p.hex;
                return (
                  <button
                    key={p.hex}
                    onClick={() => { setCustomize({ accent: p.hex }); haptic("light"); }}
                    aria-label={p.name}
                    title={p.name}
                    className="press grid aspect-square place-items-center rounded-full"
                    style={{ background: p.hex, boxShadow: selected ? `0 0 0 2px var(--bg), 0 0 0 4px ${p.hex}` : undefined }}
                  >
                    {selected && <Check className="size-4 text-white" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="size-9 shrink-0 rounded-[10px] border border-line" style={{ background: customize.accent }} />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setHexInput(v);
                  if (isValidHex(v)) setCustomize({ accent: normalizeHex(v) });
                }}
                placeholder="#6c5cf2"
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-accent"
              />
              <input
                type="color"
                value={isValidHex(customize.accent) ? normalizeHex(customize.accent) : "#6c5cf2"}
                onChange={(e) => setCustomize({ accent: e.target.value })}
                aria-label="Pick accent color"
                className="size-9 shrink-0 cursor-pointer rounded-[10px] border border-line bg-transparent p-0.5"
              />
            </div>
          </Group>

          {/* Background */}
          <Group title="Background" hint="Set the mood behind everything.">
            <Chips<BgStyle>
              value={customize.bgStyle}
              onChange={(v) => setCustomize({ bgStyle: v })}
              options={[
                { v: "aurora", label: "Aurora" },
                { v: "gradient", label: "Gradient" },
                { v: "mesh", label: "Mesh" },
                { v: "preset", label: "Palettes" },
                { v: "image", label: "Photo" },
                { v: "solid", label: "Solid" },
              ]}
            />

            {customize.bgStyle === "preset" && (
              <div className="mt-3">
                <Label>Calming palettes</Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {BG_PRESETS.map((p) => {
                    const selected = customize.bgPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setCustomize({ bgPreset: p.id }); haptic("light"); }}
                        title={p.name}
                        className="press relative h-14 overflow-hidden rounded-[12px] border border-line"
                        style={{ background: p.swatch, boxShadow: selected ? "0 0 0 2px var(--bg), 0 0 0 4px var(--accent)" : undefined }}
                      >
                        {selected && (
                          <span className="absolute inset-0 grid place-items-center">
                            <Check className="size-5 text-white drop-shadow" strokeWidth={3} />
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/30 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {customize.bgStyle === "image" && (
              <div className="mt-3">
                <Label>Image URL</Label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 shrink-0 text-ink-faint" />
                  <input
                    type="url"
                    inputMode="url"
                    value={urlInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUrlInput(val);
                      if (isValidImageUrl(val)) setCustomize({ bgImageUrl: val.trim() });
                    }}
                    placeholder="https://images.unsplash.com/…"
                    className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                  />
                </div>
                {urlInput.trim() !== "" && !isValidImageUrl(urlInput) && (
                  <p className="mt-1.5 text-[11px] font-semibold text-danger">
                    Enter a direct https image link (jpg, png, webp…).
                  </p>
                )}
                <div className="mt-2.5">
                  <Label>Readability scrim · {customize.bgImageDim}%</Label>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={customize.bgImageDim}
                  onChange={(e) => setCustomize({ bgImageDim: Number(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
                <p className="mt-1 text-[11px] text-ink-soft">
                  Tints the photo toward your theme so text stays legible.
                </p>
              </div>
            )}

            {(customize.bgStyle === "aurora" || customize.bgStyle === "mesh") && (
              <div className="mt-3">
                <Label>Glow intensity</Label>
                <Chips<GlowLevel>
                  value={customize.glow}
                  onChange={(v) => setCustomize({ glow: v })}
                  options={[
                    { v: "off", label: "Off" },
                    { v: "low", label: "Low" },
                    { v: "medium", label: "Medium" },
                    { v: "high", label: "High" },
                  ]}
                />
              </div>
            )}
          </Group>

          {/* Background shapes */}
          <Group title="Background shapes" hint="Show your interests — UW spirit, hobbies, or calm.">
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_MOTIFS.map((m) => {
                const selected = customize.shapeMotif === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setCustomize({ shapeMotif: m.id }); haptic("light"); }}
                    className={`press flex flex-col items-center gap-1 rounded-[12px] py-2.5 transition ${
                      selected ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    <span className="text-[20px] leading-none">{m.emoji}</span>
                    <span className="text-[10px] font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </Group>

          {/* Glass */}
          <Group title="Glass blur" hint={`Frosted panel intensity · ${customize.blur}px`}>
            <input
              type="range"
              min={0}
              max={34}
              step={1}
              value={customize.blur}
              onChange={(e) => setCustomize({ blur: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </Group>

          {/* Surfaces & shape */}
          <Group title="Surfaces" hint="Corner shape and how panels are filled — applies app-wide.">
            <Label>Corner roundness</Label>
            <Chips<CornerStyle>
              value={customize.corners}
              onChange={(v) => setCustomize({ corners: v })}
              options={[
                { v: "default", label: "Default" },
                { v: "round", label: "Round" },
                { v: "soft", label: "Soft" },
                { v: "sharp", label: "Sharp" },
              ]}
            />
            <div className="mt-3">
              <Label>Panel style</Label>
              <Chips<PanelStyle>
                value={customize.panel}
                onChange={(v) => setCustomize({ panel: v })}
                options={[
                  { v: "default", label: "Frosted" },
                  { v: "solid", label: "Solid" },
                  { v: "bordered", label: "Bordered" },
                  { v: "minimal", label: "Minimal" },
                ]}
              />
            </div>
            <Toggle
              className="mt-3"
              label="Calm mode"
              hint="Turn off animations and transitions across the app."
              on={customize.reduceMotion}
              onToggle={() => setCustomize({ reduceMotion: !customize.reduceMotion })}
            />
          </Group>

          {/* Navigation */}
          <Group title="Navigation bar" hint="Size and shape of the bottom tab bar.">
            <Label>Tab size</Label>
            <Chips<NavSize>
              value={customize.navSize}
              onChange={(v) => setCustomize({ navSize: v })}
              options={[
                { v: "compact", label: "Compact" },
                { v: "default", label: "Default" },
                { v: "large", label: "Large" },
              ]}
            />
            <div className="mt-3">
              <Label>Center button shape</Label>
              <Chips<FabShape>
                value={customize.fabShape}
                onChange={(v) => setCustomize({ fabShape: v })}
                options={[
                  { v: "circle", label: "Circle" },
                  { v: "squircle", label: "Squircle" },
                  { v: "square", label: "Square" },
                ]}
              />
            </div>
            <Toggle
              className="mt-3"
              label="Show tab labels"
              hint="Text under each nav icon."
              on={customize.navLabels}
              onToggle={() => setCustomize({ navLabels: !customize.navLabels })}
            />
          </Group>

          {/* Typography */}
          <Group title="Typography" hint="Font family across the app.">
            <Chips<FontChoice>
              value={customize.font}
              onChange={(v) => setCustomize({ font: v })}
              options={[
                { v: "default", label: "Default" },
                { v: "system", label: "System" },
                { v: "serif", label: "Serif" },
                { v: "mono", label: "Mono" },
              ]}
            />
          </Group>

          <p className="rounded-[14px] bg-surface-2 px-4 py-3 text-[11px] leading-relaxed text-ink-soft">
            Note: the home-screen <b className="text-ink">app icon</b> is fixed by iOS/Android once you add the
            app to your home screen and can&apos;t be changed from inside the app — re-add it to pick up a new icon.
            Everything else applies instantly and syncs to your account across devices.
          </p>

          <div className="h-safe-bottom" />
        </div>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-[14px] font-extrabold text-ink">{title}</h3>
      {hint && <p className="mb-2.5 mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
      <div className={hint ? "" : "mt-2.5"}>{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{children}</p>;
}

function Chips<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => { onChange(o.v); haptic("light"); }}
          className={`press rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
            value === o.v ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label, hint, on, onToggle, className, icon,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onToggle: () => void;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button onClick={() => { onToggle(); haptic("light"); }} className={`flex w-full items-center justify-between gap-3 ${className ?? ""}`}>
      <span className="flex items-center gap-2.5 text-left">
        {icon && <span className="shrink-0">{icon}</span>}
        <span>
          <span className="block text-[13px] font-semibold text-ink">{label}</span>
          {hint && <span className="block text-[11px] text-ink-soft">{hint}</span>}
        </span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-line-strong"}`}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: on ? "1.375rem" : "0.125rem" }} />
      </span>
    </button>
  );
}
