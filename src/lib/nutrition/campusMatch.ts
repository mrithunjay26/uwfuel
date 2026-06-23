import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

const STOP = new Set([
  "with", "and", "the", "of", "a", "an", "in", "on", "de", "style", "fresh",
  "served", "side", "small", "large", "regular", "cup", "bowl", "plate",
]);

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * Fuzzy-match a recognized food name against today's flattened UW menu so we
 * can swap in exact campus calories/price + a Dub Grub order link.
 * Returns the best item when token overlap is confident, else null.
 */
export function matchCampusItem(name: string, menu: FlatMenuItem[]): FlatMenuItem | null {
  const q = tokens(name);
  if (q.length === 0 || menu.length === 0) return null;

  let best: FlatMenuItem | null = null;
  let bestScore = 0;

  for (const item of menu) {
    const t = tokens(item.name);
    if (t.length === 0) continue;
    const overlap = q.filter((w) => t.includes(w)).length;
    if (overlap === 0) continue;
    let score = overlap / Math.max(q.length, t.length);
    if (item.available_now) score += 0.05; // gentle preference for what's served now
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 0.5 ? best : null;
}
