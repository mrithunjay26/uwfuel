"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  subscribeAccountConfig,
  getAccountConfigOnce,
  writeCohereKey,
  writeGroqKey,
  writeFirebaseConfig,
  writeDailyBudget,
  writeShowWorkoutTabs,
  writeRemindersOn,
  writeAccountFields,
  defaultAccountConfig,
  DEFAULT_DAILY_BUDGET,
  type AccountConfig,
} from "@/lib/firebase/accountConfig";
import { readLegacyLocalConfig, purgeAllLocalConfig } from "./storage";
import { useAuth } from "@/lib/auth/AuthContext";
import type { FirebaseClientConfig } from "./types";

interface ConfigContextValue {
  ready: boolean;
  cohereKey: string | null;
  hasCohere: boolean;
  groqKey: string | null;
  hasGroq: boolean;
  firebase: FirebaseClientConfig | null;
  hasFirebase: boolean;
  dailyBudget: number;
  showWorkoutTabs: boolean;
  remindersOn: boolean;
  setCohereKey: (key: string | null) => void;
  setGroqKey: (key: string | null) => void;
  setFirebase: (cfg: FirebaseClientConfig | null) => void;
  setDailyBudget: (value: number) => void;
  setShowWorkoutTabs: (show: boolean) => void;
  setRemindersOn: (on: boolean) => void;
  reset: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<AccountConfig>(defaultAccountConfig);

  const migratedRef = useRef<string | null>(null);
  const pendingRef = useRef<Parameters<typeof writeAccountFields>[1]>({});

  useEffect(() => {
    setReady(false);
    setCfg(defaultAccountConfig());

    if (!uid) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const unsub = subscribeAccountConfig(uid, (next) => {
      if (cancelled) return;
      setCfg(next);
      setReady(true);
    });

    const fallback = setTimeout(() => { if (!cancelled) setReady(true); }, 5000);

    if (Object.keys(pendingRef.current).length > 0) {
      const queued = pendingRef.current;
      pendingRef.current = {};
      writeAccountFields(uid, queued).catch(() => {});
    }

    if (migratedRef.current !== uid) {
      migratedRef.current = uid;
      (async () => {
        try {
          const local = readLegacyLocalConfig(uid);
          const hasLocal =
            Boolean(local.cohereKey) || Boolean(local.firebase) ||
            local.dailyBudget != null || local.showWorkoutTabs != null;
          if (hasLocal) {
            const dbCfg = await getAccountConfigOnce(uid);
            const dbEmpty = !dbCfg.cohereKey && !dbCfg.firebase;
            if (dbEmpty) {
              const fields: Parameters<typeof writeAccountFields>[1] = {};
              if (local.cohereKey) fields.cohere_key = local.cohereKey;
              if (local.firebase) fields.firebase_config = local.firebase;
              if (local.dailyBudget != null) fields.daily_budget = local.dailyBudget;
              if (local.showWorkoutTabs != null) fields.show_workout_tabs = local.showWorkoutTabs;
              await writeAccountFields(uid, fields);
            }
          }
        } catch {  }
        finally {
          purgeAllLocalConfig(uid);
        }
      })();
    }

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      unsub();
    };
  }, [uid]);

  const setCohereKey = useCallback((key: string | null) => {
    setCfg((c) => ({ ...c, cohereKey: key }));
    if (uid) writeCohereKey(uid, key).catch(() => {});
    else pendingRef.current.cohere_key = key;
  }, [uid]);

  const setGroqKey = useCallback((key: string | null) => {
    setCfg((c) => ({ ...c, groqKey: key }));
    if (uid) writeGroqKey(uid, key).catch(() => {});
    else pendingRef.current.groq_key = key;
  }, [uid]);

  const setFirebase = useCallback((firebase: FirebaseClientConfig | null) => {
    setCfg((c) => ({ ...c, firebase }));
    if (uid) writeFirebaseConfig(uid, firebase).catch(() => {});
    else pendingRef.current.firebase_config = firebase;
  }, [uid]);

  const setDailyBudget = useCallback((value: number) => {
    if (!(value > 0)) return;
    setCfg((c) => ({ ...c, dailyBudget: value }));
    if (uid) writeDailyBudget(uid, value).catch(() => {});
    else pendingRef.current.daily_budget = value;
  }, [uid]);

  const setShowWorkoutTabs = useCallback((show: boolean) => {
    setCfg((c) => ({ ...c, showWorkoutTabs: show }));
    if (uid) writeShowWorkoutTabs(uid, show).catch(() => {});
    else pendingRef.current.show_workout_tabs = show;
  }, [uid]);

  const setRemindersOn = useCallback((on: boolean) => {
    setCfg((c) => ({ ...c, remindersOn: on }));
    if (uid) writeRemindersOn(uid, on).catch(() => {});
    else pendingRef.current.reminders_on = on;
  }, [uid]);

  const reset = useCallback(() => {
    setCfg((c) => ({ ...c, cohereKey: null, groqKey: null, firebase: null }));
    if (uid) {
      writeCohereKey(uid, null).catch(() => {});
      writeGroqKey(uid, null).catch(() => {});
      writeFirebaseConfig(uid, null).catch(() => {});
    }
  }, [uid]);

  const value = useMemo<ConfigContextValue>(
    () => ({
      ready,
      cohereKey: cfg.cohereKey,
      hasCohere: Boolean(cfg.cohereKey),
      groqKey: cfg.groqKey,
      hasGroq: Boolean(cfg.groqKey),
      firebase: cfg.firebase,
      hasFirebase: Boolean(cfg.firebase),
      dailyBudget: cfg.dailyBudget || DEFAULT_DAILY_BUDGET,
      showWorkoutTabs: cfg.showWorkoutTabs,
      remindersOn: cfg.remindersOn,
      setCohereKey,
      setGroqKey,
      setFirebase,
      setDailyBudget,
      setShowWorkoutTabs,
      setRemindersOn,
      reset,
    }),
    [ready, cfg, setCohereKey, setGroqKey, setFirebase, setDailyBudget, setShowWorkoutTabs, setRemindersOn, reset],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within a ConfigProvider");
  return ctx;
}
