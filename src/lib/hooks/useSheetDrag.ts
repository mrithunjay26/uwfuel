"use client";

import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { shouldDismissSheet } from "@/lib/hooks/dragDecision";

interface SheetDragOptions {
  threshold?: number;
  velocity?: number;
}

export interface SheetDragHandleProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  style: CSSProperties;
}

export interface SheetDrag {
  handleProps: SheetDragHandleProps;
  sheetStyle: CSSProperties;
  dragging: boolean;
  offset: number;
}

export function useSheetDrag(onClose: () => void, options?: SheetDragOptions): SheetDrag {
  const threshold = options?.threshold ?? 110;
  const flingVelocity = options?.velocity ?? 0.55;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const active = useRef(false);
  const startY = useRef(0);
  const startT = useRef(0);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    active.current = true;
    startY.current = e.clientY;
    startT.current = performance.now();
    setDragging(true);
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch {}
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!active.current) return;
    setOffset(Math.max(0, e.clientY - startY.current));
  }, []);

  const finish = useCallback((e: ReactPointerEvent) => {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {}
    const dy = Math.max(0, e.clientY - startY.current);
    const dt = performance.now() - startT.current;
    if (shouldDismissSheet(dy, dt, { threshold, flingVelocity })) onClose();
    setOffset(0);
  }, [onClose, threshold, flingVelocity]);

  const sheetStyle: CSSProperties = {
    transform: offset > 0 ? `translateY(${offset}px)` : undefined,
    transition: dragging ? "none" : "transform 0.24s cubic-bezier(0.2,0.7,0.3,1)",
  };

  return {
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      style: { touchAction: "none", cursor: dragging ? "grabbing" : "grab" },
    },
    sheetStyle,
    dragging,
    offset,
  };
}
