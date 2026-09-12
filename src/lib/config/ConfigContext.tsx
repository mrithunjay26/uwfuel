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
  writeCohereKey,
  writeFirebaseConfig,
  writeDailyBudget,
  writeShowWorkoutTabs,
  writeRemindersOn,
  writeAccountFields,
  defaultAccountConfig,
  DEFAULT_DAILY_BUDGET,
  type AccountConfig,
} from "@/lib/firebase/accountConfig";
import { purgeAllLocalConfig } from "./storage";
import { useAuth } from "@/lib/auth/AuthContext";
import { isSealed, openSecrets, sealSecrets } from "./secrets";
import type { FirebaseClientConfig } from "./types";

interface Secrets {
  cohereKey: string | null;
  firebase: FirebaseClientConfig | null;
}

interface ConfigContextValue {
  ready: boolean;
  cohereKey: string | null;
  hasCohere: boolean;
  firebase: FirebaseClientConfig | null;
  hasFirebase: boolean;
  dailyBudget: number;
  showWorkoutTabs: boolean;
  remindersOn: boolean;
  secretsLocked: boolean;
  setCohereKey: (key: string | null) => Promise<void>;
  setFirebase: (cfg: FirebaseClientConfig | null) => Promise<void>;
  setDailyBudget: (value: number) => void;
  setShowWorkoutTabs: (show: boolean) => void;
  setRemindersOn: (on: boolean) => void;
  reset: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

const NO_SECRETS: Secrets = { cohereKey: null, firebase: null };

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<AccountConfig>(defaultAccountConfig);
  const [secrets, setSecrets] = useState<Secrets>(NO_SECRETS);
  const [secretsLocked, setSecretsLocked] = useState(false);
  const migratedRef = useRef<string | null>(null);

  useEffect(() => {
    setReady(false);
    setCfg(defaultAccountConfig());
    setSecrets(NO_SECRETS);
    setSecretsLocked(false);

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
    purgeAllLocalConfig(uid);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      unsub();
    };
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    const sealedFields: Record<string, string | null> = {};
    if (isSealed(cfg.cohereKey)) sealedFields.cohere = cfg.cohereKey;
    if (isSealed(cfg.firebaseSealed)) sealedFields.firebase = cfg.firebaseSealed;

    if (Object.keys(sealedFields).length === 0) {
      setSecrets({ cohereKey: cfg.cohereKey, firebase: cfg.firebase });
      setSecretsLocked(false);
      return;
    }

    openSecrets(sealedFields)
      .then((out) => {
        if (cancelled) return;
        let firebase = cfg.firebase;
        if (out.firebase) {
          try {
            firebase = JSON.parse(out.firebase) as FirebaseClientConfig;
          } catch {
            firebase = cfg.firebase;
          }
        }
        setSecrets({
          cohereKey: isSealed(cfg.cohereKey) ? out.cohere ?? null : cfg.cohereKey,
          firebase,
        });
        setSecretsLocked(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSecrets({ cohereKey: null, firebase: cfg.firebase });
        setSecretsLocked(true);
      });

    return () => { cancelled = true; };
  }, [cfg]);

  useEffect(() => {
    if (!uid || migratedRef.current === uid) return;
    const plainCohere = cfg.cohereKey && !isSealed(cfg.cohereKey) ? cfg.cohereKey : null;
    const plainFirebase = cfg.firebase ? JSON.stringify(cfg.firebase) : null;
    if (!plainCohere && !plainFirebase) return;

    migratedRef.current = uid;
    sealSecrets({ cohere: plainCohere, firebase: plainFirebase })
      .then((out) =>
        writeAccountFields(uid, {
          ...(plainCohere ? { cohere_key: out.cohere } : {}),
          ...(plainFirebase ? { firebase_config: out.firebase } : {}),
        }),
      )
      .catch(() => { migratedRef.current = null; });
  }, [uid, cfg]);

  const sealOne = useCallback(async (value: string | null) => {
    if (!value) return null;
    const out = await sealSecrets({ value });
    return out.value ?? null;
  }, []);

  const setCohereKey = useCallback(async (key: string | null) => {
    if (!uid) throw new Error("Log in first, then add your key.");
    const sealed = await sealOne(key);
    await writeCohereKey(uid, sealed);
    setSecrets((s) => ({ ...s, cohereKey: key }));
  }, [uid, sealOne]);

  const setFirebase = useCallback(async (firebase: FirebaseClientConfig | null) => {
    if (!uid) throw new Error("Log in first, then connect your database.");
    const sealed = await sealOne(firebase ? JSON.stringify(firebase) : null);
    await writeFirebaseConfig(uid, sealed);
    setSecrets((s) => ({ ...s, firebase }));
  }, [uid, sealOne]);

  const setDailyBudget = useCallback((value: number) => {
    if (!(value > 0)) return;
    setCfg((c) => ({ ...c, dailyBudget: value }));
    if (uid) writeDailyBudget(uid, value).catch(() => {});
  }, [uid]);

  const setShowWorkoutTabs = useCallback((show: boolean) => {
    setCfg((c) => ({ ...c, showWorkoutTabs: show }));
    if (uid) writeShowWorkoutTabs(uid, show).catch(() => {});
  }, [uid]);

  const setRemindersOn = useCallback((on: boolean) => {
    setCfg((c) => ({ ...c, remindersOn: on }));
    if (uid) writeRemindersOn(uid, on).catch(() => {});
  }, [uid]);

  const reset = useCallback(async () => {
    setSecrets(NO_SECRETS);
    if (!uid) return;
    await writeAccountFields(uid, { cohere_key: null, firebase_config: null });
  }, [uid]);

  const value = useMemo<ConfigContextValue>(
    () => ({
      ready,
      cohereKey: secrets.cohereKey,
      hasCohere: Boolean(secrets.cohereKey),
      firebase: secrets.firebase,
      hasFirebase: Boolean(secrets.firebase),
      dailyBudget: cfg.dailyBudget || DEFAULT_DAILY_BUDGET,
      showWorkoutTabs: cfg.showWorkoutTabs,
      remindersOn: cfg.remindersOn,
      secretsLocked,
      setCohereKey,
      setFirebase,
      setDailyBudget,
      setShowWorkoutTabs,
      setRemindersOn,
      reset,
    }),
    [ready, cfg, secrets, secretsLocked, setCohereKey, setFirebase, setDailyBudget, setShowWorkoutTabs, setRemindersOn, reset],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within a ConfigProvider");
  return ctx;
}
