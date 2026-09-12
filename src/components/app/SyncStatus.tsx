"use client";

import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/lib/offline/useSync";

export function SyncStatus() {
  const { online, pending, syncing } = useOfflineSync();

  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? "" : "s"} saved here`
      : "Offline · your data is saved on this device"
    : syncing
      ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
      : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),8px)] z-[60] flex justify-center px-4"
    >
      <span
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-[var(--shadow-md)] backdrop-blur-xl ${
          online ? "bg-accent text-accent-contrast" : "bg-ink/90 text-surface"
        }`}
      >
        {!online ? (
          <CloudOff className="size-3.5" />
        ) : syncing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {label}
      </span>
    </div>
  );
}
