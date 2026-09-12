"use client";

import type { SheetDragHandleProps } from "@/lib/hooks/useSheetDrag";

export function DragHandle({ handleProps, className }: { handleProps: SheetDragHandleProps; className?: string }) {
  return (
    <div
      {...handleProps}
      aria-hidden="true"
      className={`mx-auto flex w-full max-w-[140px] shrink-0 justify-center pb-2.5 pt-1 ${className ?? ""}`}
    >
      <span className="h-1.5 w-10 rounded-full bg-line-strong" />
    </div>
  );
}
