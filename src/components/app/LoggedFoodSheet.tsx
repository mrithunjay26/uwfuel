"use client";

import { useEffect, useState } from "react";
import { Check, Clock, MapPin, Pencil, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/utils/nutrition";
import type { FoodLogItem } from "@/lib/hooks/useFoodLog";
import type { FoodLogEntry } from "@/lib/db/types";

interface LoggedFoodSheetProps {
  entry: FoodLogItem | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSave?: (id: string, patch: Partial<Omit<FoodLogEntry, "logged_at">>) => void;
}

export function LoggedFoodSheet({ entry, onClose, onDelete, onSave }: LoggedFoodSheetProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  useEffect(() => {
    if (entry) {
      setEditing(false);
      setDraft({
        name: entry.name,
        calories: String(Math.round(entry.calories)),
        protein: String(Math.round(entry.protein_grams)),
        carbs: String(Math.round(entry.carbs_grams ?? 0)),
        fat: String(Math.round(entry.fat_grams ?? 0)),
      });
    }
  }, [entry]);

  if (!entry) return null;

  function saveEdit() {
    if (!entry) return;
    onSave?.(entry.id, {
      name: draft.name.trim() || entry.name,
      calories: Math.max(0, Math.round(Number(draft.calories) || 0)),
      protein_grams: Math.max(0, Math.round(Number(draft.protein) || 0)),
      carbs_grams: Math.max(0, Math.round(Number(draft.carbs) || 0)),
      fat_grams: Math.max(0, Math.round(Number(draft.fat) || 0)),
    });
    setEditing(false);
    onClose();
  }

  const carbs = entry.carbs_grams ?? 0;
  const fat = entry.fat_grams ?? 0;
  const cells = [
    { label: "Calories", value: Math.round(entry.calories).toString(), unit: "", color: "text-flame" },
    { label: "Protein", value: Math.round(entry.protein_grams).toString(), unit: "g", color: "text-protein" },
    { label: "Carbs", value: Math.round(carbs).toString(), unit: "g", color: "text-carbs" },
    { label: "Fat", value: Math.round(fat).toString(), unit: "g", color: "text-fat" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={entry.name}
        className="glass-strong animate-rise fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] flex-col rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4"
        style={{ maxHeight: "88dvh" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />

        <div className="thin-scrollbar flex-1 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                {editing ? "Editing" : entry.is_custom ? "Custom food" : "Logged"}
              </span>
              {editing ? (
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-surface-2 px-2.5 py-1.5 font-display text-[18px] font-extrabold text-ink outline-none focus:border-accent"
                />
              ) : (
                <h2 className="mt-1.5 font-display text-[20px] font-extrabold leading-tight text-ink">{entry.name}</h2>
              )}
            </div>
            <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-soft">
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            {entry.location_name && (
              <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-soft">
                <MapPin className="size-3 text-accent" /> {entry.location_name}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-soft">
              <Clock className="size-3 text-accent" /> {formatLogTime(entry.logged_at)}
            </span>
            {entry.price > 0 && (
              <span className="ml-auto font-display text-[18px] font-extrabold text-ink">{formatMoney(entry.price)}</span>
            )}
          </div>

          {editing ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {([["calories", "Calories", "text-flame"], ["protein", "Protein", "text-protein"], ["carbs", "Carbs", "text-carbs"], ["fat", "Fat", "text-fat"]] as const).map(
                ([key, label, color]) => (
                  <label key={key} className="glass-panel rounded-[14px] px-2 py-2.5 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className={`w-full bg-transparent text-center font-display text-[18px] font-extrabold outline-none ${color}`}
                    />
                    <span className="mt-0.5 block text-[10px] font-semibold text-ink-soft">{label}</span>
                  </label>
                ),
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {cells.map((m) => (
                <div key={m.label} className="glass-panel rounded-[14px] px-2 py-3 text-center">
                  <p className={`font-display text-[18px] font-extrabold ${m.color}`}>
                    {m.value}<span className="text-[11px] font-bold text-ink-faint">{m.unit}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-ink-soft">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {entry.description && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Description</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{entry.description}</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                className="press flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-accent py-3 text-[14px] font-bold text-accent-contrast"
              >
                <Check className="size-4" /> Save changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="press rounded-[14px] bg-surface-2 px-4 py-3 text-[14px] font-bold text-ink-soft"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {onSave && (
                <button
                  onClick={() => setEditing(true)}
                  className="press flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-surface-2 py-3 text-[14px] font-bold text-ink"
                >
                  <Pencil className="size-4" /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onDelete(entry.id); onClose(); }}
                  className="press flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-danger/10 py-3 text-[14px] font-bold text-danger"
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}
