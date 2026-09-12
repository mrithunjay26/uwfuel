"use client";

import { useEffect, useRef, useState } from "react";
import { onValue, ref, type Database } from "firebase/database";
import { cacheRead, cacheRemove, cacheWrite } from "./cache";

export interface CachedValue<T> {
  value: T | null;
  loading: boolean;
  stale: boolean;
}

export function useCachedDbValue<T>(
  db: Database | null,
  path: string | null,
  cacheKey: string | null,
): CachedValue<T> {
  const initial = cacheKey ? cacheRead<T>(cacheKey) : null;
  const [value, setValue] = useState<T | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [stale, setStale] = useState(initial !== null);
  const keyRef = useRef(cacheKey);

  useEffect(() => {
    if (!db || !path) {
      setValue(null);
      setLoading(false);
      setStale(false);
      return;
    }

    if (keyRef.current !== cacheKey) {
      keyRef.current = cacheKey;
      const cached = cacheKey ? cacheRead<T>(cacheKey) : null;
      setValue(cached);
      setStale(cached !== null);
      setLoading(cached === null);
    }

    const unsub = onValue(
      ref(db, path),
      (snap) => {
        const next = snap.exists() ? (snap.val() as T) : null;
        setValue(next);
        setStale(false);
        setLoading(false);
        if (cacheKey) {
          if (next === null) cacheRemove(cacheKey);
          else cacheWrite(cacheKey, next);
        }
      },
      () => {
        setLoading(false);
      },
    );
    return () => unsub();
  }, [db, path, cacheKey]);

  return { value, loading, stale };
}
