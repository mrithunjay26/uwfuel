import { Flame } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function BrandMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-grid place-items-center rounded-[30%] bg-gradient-to-br from-hero-from to-hero-to text-white shadow-[0_8px_18px_-6px_rgba(108,88,234,0.7)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Flame style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.4} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[19px] font-extrabold tracking-tight text-ink", className)}>
      UW <span className="text-accent">Fuel</span>
    </span>
  );
}

export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <Wordmark />
    </span>
  );
}
