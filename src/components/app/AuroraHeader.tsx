"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface AuroraHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function AuroraHeader({
  title,
  subtitle,
  icon,
  right,
  children,
  className,
}: AuroraHeaderProps) {
  return (
    <header
      className={cn(
        "aurora-header px-5 pb-4 pt-[max(env(safe-area-inset-top),18px)]",
        className,
      )}
    >
      <div className="flex items-center justify-between pt-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="glass-soft grid size-10 shrink-0 place-items-center rounded-2xl text-accent">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-[22px] font-extrabold leading-tight text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[12px] font-medium text-ink-soft">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </header>
  );
}
