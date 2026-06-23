"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { subscribeCustomize, writeCustomize } from "@/lib/firebase/accountConfig";
import {
  DEFAULT_CUSTOMIZE,
  MANAGED_VARS,
  computeCustomize,
  parseCustomize,
  type Customize,
} from "./types";

const STORAGE_KEY = "uwfuel.customize";
const CSS_KEY = "uwfuel.customize.css";

interface CustomizeContextValue {
  customize: Customize;
  setCustomize: (patch: Partial<Customize>) => void;
  reset: () => void;
}

const CustomizeContext = createContext<CustomizeContextValue | null>(null);

function applyToDocument(c: Customize) {
  const { vars, attrs } = computeCustomize(c);
  const root = document.documentElement;
  // Set produced vars; clear any managed var we're not producing so the base
  // theme shows through (important when resetting or toggling back to default).
  for (const name of MANAGED_VARS) {
    if (name in vars) root.style.setProperty(name, vars[name]);
    else root.style.removeProperty(name);
  }
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
  try {
    localStorage.setItem(CSS_KEY, JSON.stringify({ vars, attrs }));
  } catch {}
}

function persistLocal(c: Customize) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
}

function sameCustomize(a: Customize, b: Customize): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function CustomizeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [customize, setState] = useState<Customize>(DEFAULT_CUSTOMIZE);
  const stateRef = useRef<Customize>(DEFAULT_CUSTOMIZE);
  stateRef.current = customize;

  // 1. Instant local apply on mount (works offline / before auth resolves).
  useEffect(() => {
    let initial = DEFAULT_CUSTOMIZE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) initial = parseCustomize(JSON.parse(raw));
    } catch {}
    setState(initial);
    applyToDocument(initial);
  }, []);

  // 2. Sync with the account once signed in: remote wins if present, otherwise
  //    seed the account with whatever this device currently has.
  useEffect(() => {
    if (!uid) return;
    let seeded = false;
    const unsub = subscribeCustomize(uid, (raw) => {
      if (raw) {
        const remote = parseCustomize(raw);
        if (!sameCustomize(remote, stateRef.current)) {
          setState(remote);
          applyToDocument(remote);
          persistLocal(remote);
        }
      } else if (!seeded) {
        seeded = true;
        writeCustomize(uid, stateRef.current).catch(() => {});
      }
    });
    return () => unsub();
  }, [uid]);

  // 3. Data-adaptive: warm/dim the canvas after dark (Pacific time) when enabled.
  useEffect(() => {
    const root = document.documentElement;
    if (!customize.autoNight) {
      root.removeAttribute("data-night");
      return;
    }
    const apply = () => {
      const raw = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "numeric",
          hour12: false,
        }).format(new Date()),
      );
      const hour = raw === 24 ? 0 : raw;
      const night = hour >= 19 || hour < 6;
      if (night) root.setAttribute("data-night", "on");
      else root.removeAttribute("data-night");
    };
    apply();
    const id = window.setInterval(apply, 5 * 60 * 1000);
    return () => {
      window.clearInterval(id);
      root.removeAttribute("data-night");
    };
  }, [customize.autoNight]);

  const setCustomize = useCallback((patch: Partial<Customize>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      applyToDocument(next);
      persistLocal(next);
      if (uid) writeCustomize(uid, next).catch(() => {});
      return next;
    });
  }, [uid]);

  const reset = useCallback(() => {
    setState(DEFAULT_CUSTOMIZE);
    applyToDocument(DEFAULT_CUSTOMIZE);
    persistLocal(DEFAULT_CUSTOMIZE);
    if (uid) writeCustomize(uid, DEFAULT_CUSTOMIZE).catch(() => {});
  }, [uid]);

  const value = useMemo<CustomizeContextValue>(
    () => ({ customize, setCustomize, reset }),
    [customize, setCustomize, reset],
  );

  return <CustomizeContext.Provider value={value}>{children}</CustomizeContext.Provider>;
}

export function useCustomize() {
  const ctx = useContext(CustomizeContext);
  if (!ctx) throw new Error("useCustomize must be used within a CustomizeProvider");
  return ctx;
}

// Runs before paint (after the theme bootstrap) using the precomputed CSS map,
// so custom accents/backgrounds don't flash the defaults first.
export const customizeBootstrapScript = `(function(){try{var raw=localStorage.getItem('${CSS_KEY}');if(!raw)return;var c=JSON.parse(raw);var r=document.documentElement;if(c.vars)for(var k in c.vars)r.style.setProperty(k,c.vars[k]);if(c.attrs)for(var a in c.attrs)r.setAttribute(a,c.attrs[a]);}catch(e){}})();`;
