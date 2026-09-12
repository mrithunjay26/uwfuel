import type { FlatMenuItem } from "@/lib/menu/flattenMenu";

export const DUB_GRUB_ROOT = "https://order.hfs.uw.edu/";

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

export function isOrderable(item: FlatMenuItem): boolean {
  if (item.orderable === false) return false;
  if (item.orderable === true || typeof item.order_url === "string") return true;
  return Boolean(venueFor(item));
}

export function orderUrlFor(item: FlatMenuItem): string {
  if (item.order_url) return item.order_url;
  return venueFor(item)?.storefront ?? DUB_GRUB_ROOT;
}

export function needsSearchAssist(item: FlatMenuItem): boolean {
  return !item.order_url && !venueFor(item)?.storefront;
}
