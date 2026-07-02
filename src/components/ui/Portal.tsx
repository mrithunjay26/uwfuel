"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body so overlays (bottom sheets, modals) sit
 * above everything — including the fixed navbar — and aren't trapped inside a
 * scrolled / animated / transformed page container. Client-only (portals after mount).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
