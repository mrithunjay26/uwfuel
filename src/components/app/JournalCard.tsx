"use client";

import { Bookmark, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/nutrition";
import type { FoodLogItem } from "@/lib/hooks/useFoodLog";

interface JournalCardProps {
  entry: FoodLogItem;
  index?: number;
  onDelete?: (id: string) => void;
  onSave?: (entry: FoodLogItem) => void;
  onOpen?: (entry: FoodLogItem) => void;
  className?: string;
}

export function JournalCard({ entry, index = 0, onDelete, onSave, onOpen, className }: JournalCardProps) {
  void index;
  const time = formatLogTime(entry.logged_at);
  const [saved, setSaved] = useState(false);

  return (
    <div
      onClick={onOpen ? () => onOpen(entry) : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(entry); } : undefined}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[18px] glass-panel p-3.5",
        onOpen && "press cursor-pointer",
        className,
      )}
    >
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(entry); setSaved(true); setTimeout(() => setSaved(false), 1200); }}
            aria-label={`Save ${entry.name} to My foods`}
            title="Save to My foods"
            className={cn(
              "grid size-7 place-items-center rounded-full bg-surface/85 backdrop-blur-sm",
              saved ? "text-accent" : "text-ink-soft",
            )}
          >
            {saved ? <Check className="size-3.5" strokeWidth={2.5} /> : <Bookmark className="size-3.5" strokeWidth={2} />}
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
            aria-label={`Remove ${entry.name}`}
            className="grid size-7 place-items-center rounded-full bg-surface/85 text-danger backdrop-blur-sm"
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {entry.location_name ? (
        <span className="relative mb-1 w-fit rounded-full bg-surface/70 px-2 py-0.5 text-[10px] font-semibold text-ink-soft backdrop-blur-sm">
          {entry.location_name}
        </span>
      ) : entry.is_custom ? (
        <span className="relative mb-1 w-fit rounded-full bg-surface/70 px-2 py-0.5 text-[10px] font-semibold text-ink-soft backdrop-blur-sm">
          Custom
        </span>
      ) : null}

      <p className="relative line-clamp-2 text-[13px] font-bold leading-snug text-ink">{entry.name}</p>

      <div className="relative mt-2.5 flex items-center gap-2.5 text-[11px] font-semibold text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="text-[12px]">🔥</span>
          {Math.round(entry.calories)}
        </span>
        {entry.protein_grams > 0 && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-protein" />
            {Math.round(entry.protein_grams)}g
          </span>
        )}
        {entry.price > 0 && (
          <span className="ml-auto">{formatMoney(entry.price)}</span>
        )}
      </div>

      {time && (
        <p className="relative mt-0.5 text-[10px] text-ink-faint">{time}</p>
      )}
    </div>
  );
}

function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}
