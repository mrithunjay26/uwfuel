"use client";

import { Heart, ThumbsDown, ThumbsUp } from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { setMealRating, logTasteEvent } from "@/lib/db/userDb";
import { haptic } from "@/lib/utils/haptics";
import type { MealRatingValue } from "@/lib/db/types";

const TONES: Record<MealRatingValue, string> = {
  bad: "bg-danger/15 text-danger",
  good: "bg-ink/10 text-ink",
  loved: "bg-accent text-accent-contrast",
};

export function MealRatePills({
  name,
  locationId,
  locationName,
  rating,
  className,
}: {
  name: string;
  locationId?: string;
  locationName?: string;
  rating?: MealRatingValue;
  className?: string;
}) {
  const handle = useUserDb();

  const rate = (value: MealRatingValue) => {
    if (!handle) return;
    haptic("light");
    void setMealRating(handle.db, handle.uid, { name, location_id: locationId, location_name: locationName }, value).catch(() => {});
    void logTasteEvent(handle.db, handle.uid, { name, location_id: locationId, kind: "eaten" }).catch(() => {});
  };

  const pill = (value: MealRatingValue, icon: React.ReactNode, label: string) => (
    <button
      onClick={(e) => { e.stopPropagation(); rate(value); }}
      aria-label={`${label} ${name}`}
      title={label}
      className={`press grid size-6 place-items-center rounded-full transition ${rating === value ? TONES[value] : "bg-surface-2 text-ink-faint"}`}
    >
      {icon}
    </button>
  );

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {pill("bad", <ThumbsDown className="size-3" />, "Bad")}
      {pill("good", <ThumbsUp className="size-3" />, "Good")}
      {pill("loved", <Heart className="size-3" />, "Loved")}
    </div>
  );
}
