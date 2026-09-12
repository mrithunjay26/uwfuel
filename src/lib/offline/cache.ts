const PREFIX = "uwfuel.c1.";

interface Wrapped<T> {
  t: number;
  d: T;
}

function ls(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function cacheRead<T>(key: string): T | null {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<T>;
    return w && "d" in w ? w.d : null;
  } catch {
    return null;
  }
}

export function cacheReadFresh<T>(key: string, maxAgeMs: number): T | null {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<T>;
    if (!w || typeof w.t !== "number") return null;
    if (Date.now() - w.t > maxAgeMs) return null;
    return w.d;
  } catch {
    return null;
  }
}

export function cacheAge(key: string): number | null {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<unknown>;
    return typeof w?.t === "number" ? Date.now() - w.t : null;
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, value: T): void {
  const store = ls();
  if (!store) return;
  const payload = JSON.stringify({ t: Date.now(), d: value } satisfies Wrapped<T>);
  try {
    store.setItem(PREFIX + key, payload);
  } catch {
    pruneOldest(10);
    try {
      store.setItem(PREFIX + key, payload);
    } catch {
    }
  }
}

export function cacheRemove(key: string): void {
  const store = ls();
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch { }
}

function ownKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

function pruneOldest(count: number): void {
  const store = ls();
  if (!store) return;
  try {
    const entries = ownKeys(store).map((k) => {
      let t = 0;
      try { t = (JSON.parse(store.getItem(k) || "{}") as Wrapped<unknown>)?.t ?? 0; } catch { }
      return { k, t };
    });
    entries.sort((a, b) => a.t - b.t);
    entries.slice(0, count).forEach((e) => store.removeItem(e.k));
  } catch { }
}

export function cacheClearAll(): void {
  const store = ls();
  if (!store) return;
  try {
    ownKeys(store).forEach((k) => store.removeItem(k));
  } catch { }
}

export function cacheInfo(): { entries: number; kb: number } {
  const store = ls();
  if (!store) return { entries: 0, kb: 0 };
  try {
    const keys = ownKeys(store);
    const bytes = keys.reduce((n, k) => n + (store.getItem(k)?.length ?? 0), 0);
    return { entries: keys.length, kb: Math.round(bytes / 1024) };
  } catch {
    return { entries: 0, kb: 0 };
  }
}
