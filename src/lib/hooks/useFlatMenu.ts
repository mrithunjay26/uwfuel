"use client";

import { useEffect, useState } from "react";
import {
  getDiningLocations,
  getDiningMenu,
  resolveMenuDate,
  type DiningMenuSnapshot,
} from "@/lib/firebase/dining";
import {
  flattenFullMenu,
  buildLocationOpenMap,
  type FlatMenuItem,
} from "@/lib/menu/flattenMenu";

/**
 * Loads today's flattened UW menu once. Used for campus-matching scanned foods.
 * `enabled` defers the fetch until it's actually needed (e.g. scanner opened).
 */
export function useFlatMenu(enabled = true): { items: FlatMenuItem[]; loading: boolean } {
  const [items, setItems] = useState<FlatMenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || items.length > 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [locs, { dateKey }] = await Promise.all([getDiningLocations(), resolveMenuDate()]);
        const menu = (await getDiningMenu(dateKey)) as DiningMenuSnapshot | null;
        if (cancelled) return;
        const names = Object.fromEntries(Object.entries(locs ?? {}).map(([id, l]) => [id, l.name]));
        const openMap = buildLocationOpenMap(locs ?? {});
        const next = flattenFullMenu(menu, names, openMap);
        setItems(next);
        try { localStorage.setItem("uwfuel.public-menu-cache", JSON.stringify({ savedAt: new Date().toISOString(), items: next })); } catch {}
      } catch {
        if (!cancelled) {
          try {
            const cached = JSON.parse(localStorage.getItem("uwfuel.public-menu-cache") || "null") as { items?: FlatMenuItem[] } | null;
            setItems(Array.isArray(cached?.items) ? cached.items : []);
          } catch { setItems([]); }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, items.length]);

  return { items, loading };
}
