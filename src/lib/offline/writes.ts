import {
  push as fbPush,
  remove as fbRemove,
  set as fbSet,
  update as fbUpdate,
  type DatabaseReference,
} from "firebase/database";
import { ack, enqueue } from "./outbox";
import { isOnline } from "./online";

const ACK_TIMEOUT_MS = 8000;

export function pathOf(r: DatabaseReference): string {
  try {
    const { pathname } = new URL(r.toString());
    return decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return "";
  }
}

function settle(raw: Promise<unknown>, id: string): Promise<void> {
  const acked = raw.then(() => { ack(id); });

  if (!isOnline()) {
    acked.catch(() => {});
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(); }
    }, ACK_TIMEOUT_MS);
    acked.then(
      () => { if (!done) { done = true; clearTimeout(timer); resolve(); } },
      (err) => {
        if (!done) { done = true; clearTimeout(timer); ack(id); reject(err); }
      },
    );
  });
}

export function set(r: DatabaseReference, value: unknown): Promise<void> {
  const item = enqueue({ op: "set", path: pathOf(r), value });
  return settle(fbSet(r, value), item.id);
}

export function update(r: DatabaseReference, values: object): Promise<void> {
  const item = enqueue({ op: "update", path: pathOf(r), value: values });
  return settle(fbUpdate(r, values as Record<string, unknown>), item.id);
}

export function remove(r: DatabaseReference): Promise<void> {
  const item = enqueue({ op: "remove", path: pathOf(r) });
  return settle(fbRemove(r), item.id);
}

export async function push(r: DatabaseReference, value: unknown): Promise<{ key: string | null }> {
  const child = fbPush(r);
  const item = enqueue({ op: "set", path: pathOf(child), value });
  await settle(fbSet(child, value), item.id);
  return { key: child.key };
}
