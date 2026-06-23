"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { FoodInventory, InventoryFood } from "@/lib/db/types";

export interface InventoryItem extends InventoryFood {
  id: string;
}

export function useFoodInventory(): { items: InventoryItem[]; loading: boolean } {
  const handle = useUserDb();
  const [raw, setRaw] = useState<FoodInventory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setRaw(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.foodInventory(uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as FoodInventory) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const items = useMemo<InventoryItem[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, food]) => ({ id, ...food }))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [raw]);

  return { items, loading };
}
