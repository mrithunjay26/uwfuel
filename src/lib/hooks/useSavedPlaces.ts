"use client";

import { useEffect, useMemo, useState } from "react";
import { ref } from "firebase/database";
import { onValue } from "@/lib/offline/db";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { SavedPlace } from "@/lib/db/types";

export interface SavedPlaceEntry extends SavedPlace {
  id: string;
}

export function useSavedPlaces(): { places: SavedPlaceEntry[]; loading: boolean } {
  const handle = useUserDb();
  const [raw, setRaw] = useState<Record<string, SavedPlace> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { setRaw(null); setLoading(false); return; }
    const unsub = onValue(ref(handle.db, PATHS.savedPlaces(handle.uid)), (snap) => {
      setRaw(snap.exists() ? (snap.val() as Record<string, SavedPlace>) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  const places = useMemo<SavedPlaceEntry[]>(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [raw]);

  return { places, loading };
}
