"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { ChatSession, ChatSessionData } from "@/lib/db/types";

interface UseChatSessionsResult {
  sessions: ChatSession[];
  loading: boolean;
}

export function useChatSessions(): UseChatSessionsResult {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, ChatSessionData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.chatSessions(uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as Record<string, ChatSessionData>) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const sessions = useMemo<ChatSession[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, data]) => ({
        id,
        title: data.title || "Conversation",
        created_at: data.created_at || "",
        updated_at: data.updated_at || data.created_at || "",
        messages: data.messages
          ? Object.values(data.messages).sort((a, b) =>
              (a.created_at || "").localeCompare(b.created_at || ""),
            )
          : [],
      }))
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  }, [raw]);

  return { sessions, loading };
}
