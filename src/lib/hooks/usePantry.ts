"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { KitchenProfile, Pantry, PantryItem } from "@/lib/db/types";

export interface PantryEntry extends PantryItem {
  id: string;
}

export function usePantry(): { items: PantryEntry[]; loading: boolean } {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Pantry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { setRaw(null); setLoading(false); return; }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.pantry(uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as Pantry) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const items = useMemo<PantryEntry[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => (b.added_at || "").localeCompare(a.added_at || ""));
  }, [raw]);

  return { items, loading };
}

export function useKitchen(): { kitchen: KitchenProfile | null; loading: boolean } {
  const handle = useUserDb();
  const [kitchen, setKitchen] = useState<KitchenProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { setKitchen(null); setLoading(false); return; }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.kitchen(uid)), (snap) => {
      setKitchen(snap.exists() ? (snap.val() as KitchenProfile) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  return { kitchen, loading };
}
