import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

/** UW's Dub Grub online ordering site. */
export const DUB_GRUB_ROOT = "https://order.hfs.uw.edu/";

// HFS venues known to offer Dub Grub mobile ordering, keyword-matched against
// the item's location name. `storefront` (a brand-id deep link) is filled in
// from the ordering spike against order.hfs.uw.edu; until then we fall back to
// the site root and let the user search by the copied item name.
const ORDERABLE_VENUES: { match: string; storefront?: string }[] = [
  { match: "local point" },
  { match: "center table" },
  { match: "husky den" },
  { match: "by george" },
  { match: "district market" },
  { match: "the 8" },
  { match: "cultivate" },
  { match: "pagliacci" },
  { match: "mch" },
  { match: "madison" },
];

function venueFor(item: FlatMenuItem): { match: string; storefront?: string } | undefined {
  const name = (item.location_name || "").toLowerCase();
  return ORDERABLE_VENUES.find((v) => name.includes(v.match));
}

/** Whether to surface an "Order on Dub Grub" action for this item. */
export function isOrderable(item: FlatMenuItem): boolean {
  if (item.orderable === false) return false;
  if (item.orderable === true || typeof item.order_url === "string") return true;
  return Boolean(venueFor(item));
}

/**
 * Best available Dub Grub destination for an item:
 * exact item URL → location storefront → site root.
 */
export function orderUrlFor(item: FlatMenuItem): string {
  if (item.order_url) return item.order_url;
  return venueFor(item)?.storefront ?? DUB_GRUB_ROOT;
}

/** True when we only have the site root, so the UI should copy the item name to help search. */
export function needsSearchAssist(item: FlatMenuItem): boolean {
  return !item.order_url && !venueFor(item)?.storefront;
}
