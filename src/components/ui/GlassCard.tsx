"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "soft" | "panel" | "strong";
  animate?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const VARIANT: Record<NonNullable<GlassCardProps["variant"]>, string> = {
  soft: "glass-soft",
  panel: "glass-panel",
  strong: "glass-strong",
};

export function GlassCard({
  children,
  className,
  variant = "panel",
  animate = false,
  onClick,
  style,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        "rounded-[22px]",
        VARIANT[variant],
        animate && "animate-pop",
        onClick && "press cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}
