"use client";

import {
  onValue as fbOnValue,
  type DataSnapshot,
  type Query,
  type Unsubscribe,
} from "firebase/database";
import { cacheRead, cacheRemove, cacheWrite } from "./cache";

function pathOfQuery(q: Query): string {
  try {
    const target = (q as unknown as { ref?: { toString(): string } }).ref ?? q;
    const { pathname } = new URL(target.toString());
    return decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return "";
  }
}

function cachedSnapshot(value: unknown): DataSnapshot {
  return {
    exists: () => value !== null && value !== undefined,
    val: () => value,
  } as unknown as DataSnapshot;
}

export function onValue(
  query: Query,
  callback: (snapshot: DataSnapshot) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const path = pathOfQuery(query);
  const key = path ? `db:${path}` : null;

  if (key) {
    const cached = cacheRead<unknown>(key);
    if (cached !== null && cached !== undefined) {
      try { callback(cachedSnapshot(cached)); } catch { }
    }
  }

  return fbOnValue(
    query,
    (snap) => {
      if (key) {
        const v = snap.exists() ? snap.val() : null;
        if (v === null || v === undefined) cacheRemove(key);
        else cacheWrite(key, v);
      }
      callback(snap);
    },
    (err) => { onError?.(err); },
  );
}
