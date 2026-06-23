"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "uwfuel.installDismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android">("android");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try { if (localStorage.getItem(DISMISS_KEY)) return; } catch {  }

    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    if (!isIOS && !isAndroid) return;

    setPlatform(isIOS ? "ios" : "android");
    setVisible(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {  }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 mx-auto max-w-[480px] px-3"
      style={{ bottom: "calc(86px + env(safe-area-inset-bottom))" }}
    >
      <div className="glass-strong animate-rise flex items-start gap-3 rounded-[18px] p-3.5 shadow-[var(--shadow-lg)]">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-contrast">
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Install UW Fuel</p>
          {platform === "ios" ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] leading-relaxed text-ink-soft">
              Tap <Share className="inline size-3.5 text-accent" /> Share, then
              <span className="inline-flex items-center gap-0.5 font-semibold text-ink"><Plus className="size-3" />Add to Home Screen</span>
              to use it like a real app.
            </p>
          ) : deferred ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">Add it to your home screen for a full-screen app experience.</p>
          ) : (
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">Tap your browser menu ⋮ → <span className="font-semibold text-ink">Install app</span> / Add to Home screen.</p>
          )}
          {platform === "android" && deferred && (
            <button onClick={install} className="press mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-contrast">
              <Download className="size-3.5" /> Install
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
