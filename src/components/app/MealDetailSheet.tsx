"use client";

import Image from "next/image";
import { Check, Clock, Leaf, MapPin, Plus, ShoppingBag, X } from "lucide-react";
import { estimateMacros, estimateProteinGrams } from "@/lib/utils/nutrition";
import { isOrderable, orderUrlFor, needsSearchAssist } from "@/lib/dining/ordering";
import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

interface MealDetailSheetProps {
  item: FlatMenuItem | null;
  onClose: () => void;
  onLog?: (item: FlatMenuItem) => void;
  isLogging?: boolean;
}

export function MealDetailSheet({ item, onClose, onLog, isLogging }: MealDetailSheetProps) {
  if (!item) return null;

  const protein = item.protein_grams > 0
    ? item.protein_grams
    : estimateProteinGrams(item.name, item.description, item.calories);
  const macros = estimateMacros(item.calories, protein);
  const carbs = (item.carbs_grams ?? 0) > 0 ? (item.carbs_grams as number) : macros.carbs;
  const fat = (item.fat_grams ?? 0) > 0 ? (item.fat_grams as number) : macros.fat;
  const carbsEstimated = !((item.carbs_grams ?? 0) > 0);
  const fatEstimated = !((item.fat_grams ?? 0) > 0);

  const macroCells = [
    { label: "Calories", value: item.calories > 0 ? Math.round(item.calories).toString() : "N/A", unit: "", color: "text-flame" },
    { label: "Protein", value: Math.round(protein).toString(), unit: "g", color: "text-protein" },
    { label: "Carbs", value: Math.round(carbs).toString(), unit: carbsEstimated ? "g*" : "g", color: "text-carbs" },
    { label: "Fat", value: Math.round(fat).toString(), unit: fatEstimated ? "g*" : "g", color: "text-fat" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="glass-strong animate-rise fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] flex-col rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />

        <div className="thin-scrollbar flex-1 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                {item.category_name}
              </span>
              <h2 className="mt-1.5 font-display text-[20px] font-extrabold leading-tight text-ink">{item.name}</h2>
            </div>
            <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-soft">
              <X className="size-4" />
            </button>
          </div>

          {item.image_url && (
            <div className="relative mt-3 h-40 w-full overflow-hidden rounded-[18px] bg-surface-2">
              <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-soft">
              <MapPin className="size-3 text-accent" /> {item.location_name}
            </span>
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${item.available_now ? "bg-success/15 text-success" : "bg-surface-3 text-ink-faint"}`}>
              <span className={`size-1.5 rounded-full ${item.available_now ? "bg-success" : "bg-ink-faint"}`} />
              {item.available_now ? "Available now" : "Not served now"}
            </span>
            {item.price > 0 && (
              <span className="ml-auto font-display text-[18px] font-extrabold text-ink">${item.price.toFixed(2)}</span>
            )}
          </div>

          {item.schedule_text && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
              <Clock className="size-3" /> {item.schedule_text}
            </p>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {macroCells.map((m) => (
              <div key={m.label} className="glass-panel rounded-[14px] px-2 py-3 text-center">
                <p className={`font-display text-[18px] font-extrabold ${m.color}`}>
                  {m.value}<span className="text-[11px] font-bold text-ink-faint">{m.unit}</span>
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-ink-soft">{m.label}</p>
              </div>
            ))}
          </div>
          {(carbsEstimated || fatEstimated) && (
            <p className="mt-1.5 text-[10px] text-ink-faint">* carbs / fat estimated from calories &amp; protein</p>
          )}

          {item.description && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Description</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{item.description}</p>
            </div>
          )}

          {item.ingredients.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Ingredients</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{item.ingredients.join(", ")}</p>
            </div>
          )}

          {item.allergens.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Allergens</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.allergens.map((a) => (
                  <span key={a} className="rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-semibold text-danger">{a}</span>
                ))}
              </div>
            </div>
          ) : !item.is_beverage ? (
            <p className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-carbs">
              <Leaf className="size-3.5" /> No listed allergens
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {onLog && (
            <button
              onClick={() => onLog(item)}
              disabled={isLogging}
              className="press flex w-full items-center justify-center gap-2 rounded-[16px] bg-accent py-3.5 text-[15px] font-bold text-accent-contrast shadow-[var(--shadow-md)] disabled:opacity-60"
            >
              {isLogging ? <><Check className="size-4" /> Logging…</> : <><Plus className="size-4" strokeWidth={2.5} /> Log this meal</>}
            </button>
          )}
          {isOrderable(item) && (
            <button
              onClick={() => {
                if (needsSearchAssist(item)) {
                  navigator.clipboard?.writeText(item.name).catch(() => {});
                }
                window.open(orderUrlFor(item), "_blank", "noopener,noreferrer");
              }}
              className="press flex w-full items-center justify-center gap-2 rounded-[16px] border border-accent/35 bg-accent-soft py-3 text-[14px] font-bold text-accent-ink"
            >
              <ShoppingBag className="size-4" /> Order on Dub Grub
            </button>
          )}
        </div>
        {isOrderable(item) && needsSearchAssist(item) && (
          <p className="mt-1.5 text-center text-[11px] text-ink-faint">
            Opens Dub Grub &amp; copies “{item.name}” so you can search it.
          </p>
        )}
      </div>
    </>
  );
}
