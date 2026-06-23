"use client";

import Image from "next/image";
import { Plus, Flame, Leaf, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

interface MealCardProps {
  item: FlatMenuItem;
  index?: number;
  onLog?: (item: FlatMenuItem) => void;
  onOpen?: (item: FlatMenuItem) => void;
  isLogging?: boolean;
  className?: string;
}

export function MealCard({ item, index = 0, onLog, onOpen, isLogging, className }: MealCardProps) {
  void index;
  const hasNutrition = item.calories > 0 || item.protein_grams > 0;

  return (
    <div
      onClick={onOpen ? () => onOpen(item) : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(item); } : undefined}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[20px] glass-panel p-3.5",
        onOpen && "press cursor-pointer",
        className,
      )}
    >
      {item.available_now !== undefined && (
        <span
          className={cn(
            "absolute right-3 top-3 z-10 size-2 rounded-full",
            item.available_now ? "bg-success" : "bg-ink-faint",
          )}
          title={item.available_now ? "Available now" : "Not currently served"}
        />
      )}

      {item.image_url && (
        <div className="relative -mx-3.5 -mt-3.5 mb-2.5 h-24 overflow-hidden rounded-t-[20px]">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <span className="relative mb-1.5 w-fit rounded-full bg-surface/70 px-2 py-0.5 text-[10px] font-semibold text-ink-soft backdrop-blur-sm">
        {item.category_name || item.location_name}
      </span>

      <p className="relative line-clamp-2 flex-1 text-[13px] font-bold leading-snug text-ink">
        {item.name}
      </p>

      {item.category_name && item.location_name && (
        <p className="relative mt-0.5 line-clamp-1 text-[10px] font-medium text-ink-soft">
          {item.location_name}
        </p>
      )}

      {hasNutrition && (
        <div className="relative mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink-soft">
          {item.calories > 0 && (
            <span className="flex items-center gap-0.5">
              <Flame className="size-3 text-flame" />
              {Math.round(item.calories)}
            </span>
          )}
          {item.protein_grams > 0 && (
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-protein" />
              {Math.round(item.protein_grams)}g
            </span>
          )}
          {item.price > 0 && (
            <span className="ml-auto text-ink">${item.price.toFixed(2)}</span>
          )}
        </div>
      )}

      {onLog && (
        <button
          onClick={(e) => { e.stopPropagation(); onLog(item); }}
          disabled={isLogging}
          aria-label={`Log ${item.name}`}
          className={cn(
            "press relative mt-3 flex w-full items-center justify-center gap-1.5 rounded-[12px] py-2 text-[12px] font-bold transition",
            "bg-accent text-accent-contrast shadow-[var(--shadow-sm)] disabled:opacity-60",
          )}
        >
          {isLogging ? (
            <><Check className="size-3.5" strokeWidth={2.5} /> Logging…</>
          ) : (
            <><Plus className="size-3.5" strokeWidth={2.5} /> Log meal</>
          )}
        </button>
      )}

      {item.allergens.length === 0 && !item.is_beverage && (
        <Leaf className="absolute bottom-3 right-3 size-3 text-carbs opacity-50" />
      )}
    </div>
  );
}
