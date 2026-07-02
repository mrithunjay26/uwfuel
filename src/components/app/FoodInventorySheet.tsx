"use client";

import { useState } from "react";
import { Boxes, Check, Flame, Pencil, Plus, Trash2, X } from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useFoodInventory, type InventoryItem } from "@/lib/hooks/useFoodInventory";
import { saveInventoryFood, deleteInventoryFood, updateInventoryFood } from "@/lib/db/userDb";
import type { InventoryFood } from "@/lib/db/types";
import { haptic } from "@/lib/utils/haptics";
import { Portal } from "@/components/ui/Portal";

export function FoodInventorySheet({
  open, onClose, onLog, dateLabel,
}: {
  open: boolean;
  onClose: () => void;
  onLog: (food: InventoryFood) => void;
  dateLabel: string;
}) {
  const handle = useUserDb();
  const { items } = useFoodInventory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [serving, setServing] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  if (!open) return null;

  const resetForm = () => {
    setName(""); setCals(""); setProtein(""); setCarbs(""); setFat(""); setServing("");
    setAdding(false); setEditingId(null);
  };

  function startEdit(it: InventoryItem) {
    setEditingId(it.id);
    setName(it.name);
    setCals(String(Math.round(it.calories)));
    setProtein(String(Math.round(it.protein_grams)));
    setCarbs(String(Math.round(it.carbs_grams ?? 0)));
    setFat(String(Math.round(it.fat_grams ?? 0)));
    setServing(it.serving ?? "");
    setAdding(true);
  }

  async function saveFood() {
    if (!handle || !name.trim()) return;
    const food = {
      name: name.trim(),
      calories: Math.max(0, Math.round(Number(cals) || 0)),
      protein_grams: Math.max(0, Math.round(Number(protein) || 0)),
      carbs_grams: Math.max(0, Math.round(Number(carbs) || 0)),
      fat_grams: Math.max(0, Math.round(Number(fat) || 0)),
      serving: serving.trim(),
    };
    haptic("success");
    try {
      if (editingId) await updateInventoryFood(handle.db, handle.uid, editingId, food);
      else await saveInventoryFood(handle.db, handle.uid, food);
    } catch {}
    resetForm();
  }

  function logItem(it: InventoryItem) {
    onLog(it);
    haptic("medium");
    setLoggedId(it.id);
    setTimeout(() => setLoggedId(null), 1200);
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="animate-rise relative mt-auto flex max-h-[92dvh] flex-col rounded-t-[26px] border-t border-line bg-bg shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Boxes className="size-[18px] text-accent" />
            <div>
              <h2 className="font-display text-[17px] font-extrabold text-ink">My foods</h2>
              <p className="text-[11px] text-ink-soft">Reusable items · logs to {dateLabel}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-ink-soft">
            <X className="size-5" />
          </button>
        </div>

        <div className="thin-scrollbar flex flex-col gap-3 overflow-y-auto px-5 py-4">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="press flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-accent/40 py-2.5 text-[13px] font-bold text-accent-ink"
            >
              <Plus className="size-4" /> Add a food
            </button>
          ) : (
            <div className="glass-panel rounded-[16px] p-3.5">
              <input
                autoFocus value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g. Mass gainer shake)"
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[14px] font-bold text-ink outline-none focus:border-accent"
              />
              <div className="mt-2 grid grid-cols-4 gap-2">
                {([["Cals", cals, setCals], ["P", protein, setProtein], ["C", carbs, setCarbs], ["F", fat, setFat]] as const).map(
                  ([label, val, set]) => (
                    <label key={label} className="rounded-[10px] bg-surface-2 px-2 py-1.5 text-center">
                      <input
                        type="number" inputMode="numeric" value={val}
                        onChange={(e) => set(e.target.value)} placeholder="0"
                        className="w-full bg-transparent text-center text-[14px] font-extrabold text-ink outline-none"
                      />
                      <span className="block text-[9px] font-bold uppercase text-ink-faint">{label}</span>
                    </label>
                  ),
                )}
              </div>
              <input
                value={serving} onChange={(e) => setServing(e.target.value)}
                placeholder="Serving (optional, e.g. 1 scoop + 16oz milk)"
                className="mt-2 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink outline-none focus:border-accent"
              />
              <div className="mt-2.5 flex gap-2">
                <button onClick={saveFood} disabled={!name.trim()} className="press flex-1 rounded-[12px] bg-accent py-2 text-[13px] font-bold text-accent-contrast disabled:opacity-50">
                  {editingId ? "Save changes" : "Save food"}
                </button>
                <button onClick={resetForm} className="press rounded-[12px] bg-surface-2 px-4 py-2 text-[13px] font-bold text-ink-soft">Cancel</button>
              </div>
            </div>
          )}

          {items.length === 0 && !adding && (
            <div className="py-8 text-center">
              <span className="text-3xl">🥤</span>
              <p className="mt-2 text-[13px] font-semibold text-ink">No saved foods yet</p>
              <p className="text-[12px] text-ink-soft">Save the things you eat often — shakes, snacks, go-to meals.</p>
            </div>
          )}

          {items.map((it) => (
            <div key={it.id} className="glass-panel flex items-center gap-3 rounded-[14px] p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-ink">{it.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-soft">
                  <span className="flex items-center gap-0.5"><Flame className="size-3 text-flame" />{Math.round(it.calories)}</span>
                  <span>{Math.round(it.protein_grams)}g P</span>
                  {it.serving && <span className="truncate text-ink-faint">· {it.serving}</span>}
                </p>
              </div>
              <button
                onClick={() => logItem(it)}
                className="press flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-contrast"
              >
                {loggedId === it.id ? <><Check className="size-3.5" /> Logged</> : <><Plus className="size-3.5" /> Log</>}
              </button>
              <button
                onClick={() => startEdit(it)}
                aria-label="Edit"
                className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-accent"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => handle && deleteInventoryFood(handle.db, handle.uid, it.id).catch(() => {})}
                aria-label="Delete"
                className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="h-safe-bottom" />
        </div>
      </div>
    </div>
    </Portal>
  );
}
