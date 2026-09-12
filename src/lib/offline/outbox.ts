import { ref, set, update, remove, type Database } from "firebase/database";

const KEY = "uwfuel.outbox.v1";
const MAX_ITEMS = 300;
const EVENT = "uwfuel:outbox";

export type OutboxOp = "set" | "update" | "remove";

export interface OutboxItem {
  id: string;
  op: OutboxOp;
  path: string;
  value?: unknown;
  at: number;
  label?: string;
}

function ls(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): OutboxItem[] {
  const store = ls();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as OutboxItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAll(list: OutboxItem[]): void {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
  } catch {
    try { store.setItem(KEY, JSON.stringify(list.slice(-50))); } catch { }
  }
  notify();
}

function notify(): void {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { }
}

export function onOutboxChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

let seq = 0;
export function enqueue(item: Omit<OutboxItem, "id" | "at">): OutboxItem {
  const full: OutboxItem = { ...item, id: `${Date.now().toString(36)}-${seq++}`, at: Date.now() };
  const list = readAll();
  const deduped = item.op === "set" || item.op === "remove"
    ? list.filter((x) => !(x.path === item.path && (x.op === "set" || x.op === "remove")))
    : list;
  deduped.push(full);
  writeAll(deduped);
  return full;
}

export function ack(id: string): void {
  const list = readAll();
  const next = list.filter((x) => x.id !== id);
  if (next.length !== list.length) writeAll(next);
}

export function listOutbox(): OutboxItem[] {
  return readAll();
}

export function outboxCount(): number {
  return readAll().length;
}

export function clearOutbox(): void {
  writeAll([]);
}

let flushing = false;

export async function flushOutbox(db: Database): Promise<{ flushed: number; failed: number }> {
  if (flushing) return { flushed: 0, failed: 0 };
  const pending = readAll();
  if (pending.length === 0) return { flushed: 0, failed: 0 };

  flushing = true;
  let flushed = 0;
  let failed = 0;
  try {
    for (const item of pending) {
      if (!item.path) { ack(item.id); continue; }
      try {
        const r = ref(db, item.path);
        if (item.op === "set") await set(r, item.value ?? null);
        else if (item.op === "update") await update(r, (item.value ?? {}) as object);
        else await remove(r);
        ack(item.id);
        flushed++;
      } catch {
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { flushed, failed };
}
