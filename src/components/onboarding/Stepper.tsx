import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STEP_LABELS_2 = ["Account", "AI key"];
const STEP_LABELS_3 = ["Account", "Database", "AI key"];

export function Stepper({ step, total = 3 }: { step: number; total?: 2 | 3 }) {
  const labels = total === 2 ? STEP_LABELS_2 : STEP_LABELS_3;
  return (
    <div className="flex items-center justify-center gap-1.5">
      {labels.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full border-2 text-[10px] font-bold transition",
                  done
                    ? "border-accent bg-accent text-accent-contrast"
                    : active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line-strong bg-surface text-ink-faint",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[12px] transition",
                  active ? "font-bold text-ink" : "font-medium text-ink-faint",
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <span className={cn("h-0.5 w-5 rounded-full", done ? "bg-accent" : "bg-line-strong")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
