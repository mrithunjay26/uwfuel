"use client";

import { ChevronLeft } from "lucide-react";

export function OnboardingHeader({
  onBack,
  right,
}: {
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-7">
      {onBack ? (
        <button
          onClick={onBack}
          className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-soft transition active:scale-95"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : (
        <span className="size-10" />
      )}
      {right}
    </div>
  );
}
