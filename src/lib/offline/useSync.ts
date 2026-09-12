"use client";

import { useEffect, useState } from "react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { flushOutbox, onOutboxChange, outboxCount } from "./outbox";
import { useOnlineStatus } from "./online";

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
}

export function useOfflineSync(): SyncState {
  const online = useOnlineStatus();
  const handle = useUserDb();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const sync = () => setPending(outboxCount());
    sync();
    return onOutboxChange(sync);
  }, []);

  useEffect(() => {
    if (!handle || !online) return;
    let cancelled = false;
    const run = async () => {
      if (outboxCount() === 0) return;
      setSyncing(true);
      try {
        await flushOutbox(handle.db);
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setPending(outboxCount());
        }
      }
    };
    const t = setTimeout(run, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [handle, online]);

  return { online, pending, syncing };
}
