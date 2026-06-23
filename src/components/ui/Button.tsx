"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { haptic } from "@/lib/utils/haptics";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-[0_10px_22px_-6px_rgba(108,88,234,0.55)] hover:bg-accent-strong",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  soft: "bg-accent-soft text-accent-ink hover:brightness-[0.98]",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2",
  danger: "bg-danger/12 text-danger hover:bg-danger/18",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-xl",
  md: "h-12 px-5 text-sm rounded-[14px]",
  lg: "h-14 px-6 text-[15px] rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background-color,filter] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        SIZES[size],
        VARIANTS[variant],
        full && "w-full",
        className,
      )}
      disabled={disabled || loading}
      onClick={(e) => {
        haptic("light");
        onClick?.(e);
      }}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
