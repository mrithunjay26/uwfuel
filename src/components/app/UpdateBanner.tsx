"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";

// Baked into the bundle at build time. The live value is fetched from
// /api/version (the deployed server's baked value). When a deploy bumps the
// build, a stale (e.g. bookmarked / home-screen) client keeps its old baked
// value while the server returns the new one — that mismatch is how we know an
// update is waiting. (Using the route, not a static file, avoids false
// positives from a committed version.json that doesn't match the build.)
const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  const check = useCallback(async () => {
    if (BUILD_VERSION === "dev") return;
    try {
      const res = await fetch(`/api/version?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      const live = String(data.version ?? "");
      if (live && live !== "dev" && live !== "baseline" && live !== BUILD_VERSION) {
        setStale(true);
        setDismissed(false);
      }
    } catch {
      // offline or blocked — nothing to do
    }
  }, []);

  useEffect(() => {
    check();
    const id = window.setInterval(check, 60_000);
    const onFocus = () => check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const applyUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (r) => {
            try { r.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
            await r.unregister().catch(() => {});
          }),
        );
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // even if cleanup fails, force a fresh load below
    }
    // Hard reload with a cache-busting param so iOS doesn't serve the old shell.
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  }, []);

  if (!stale || dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(env(safe-area-inset-top),10px)]">
      <div className="animate-rise glass-strong pointer-events-auto flex w-full max-w-[460px] items-center gap-3 rounded-[18px] border border-accent/30 px-3.5 py-3 shadow-[var(--shadow-lg)]">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Update available</p>
          <p className="text-[11px] leading-snug text-ink-soft">
            A newer version of UW Fuel is ready. Refresh to get the latest.
          </p>
        </div>
        <button
          onClick={applyUpdate}
          disabled={updating}
          className="press flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[12px] font-bold text-accent-contrast disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${updating ? "animate-spin" : ""}`} />
          {updating ? "Updating" : "Update"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 text-ink-faint"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
