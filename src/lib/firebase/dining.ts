import { get, ref } from "firebase/database";
import { getDiningDb } from "@/lib/firebase/diningApp";

export interface DiningMetadata {
  last_scrape_at: string;
  last_date_key: string;
  location_count: number;
}

export interface DiningLocation {
  name: string;
  address: string;
  phone: string;
  current_status: string;
  closes_at: string;
  latitude: number | null;
  longitude: number | null;
  hours: Record<string, string>;
  location_group: string;
  updated_at: string;
}

export interface DiningMenuItem {
  name: string;
  description: string;
  price: number;
  calories: number;
  ingredients: string[];
  allergens: string[];
  protein_grams: number;
  // Optional Dub Grub deep-link, populated by the scraper once item URLs are
  // confirmed. When absent we fall back to the location storefront (see
  // src/lib/dining/ordering.ts).
  order_url?: string;
  orderable?: boolean;
}

export interface DiningMenuCategory {
  category_name: string;
  schedule_text: string;
  items: Record<string, DiningMenuItem>;
}

export interface DiningMenuLocation {
  categories: Record<string, DiningMenuCategory>;
  updated_at: string;
}

export type DiningMenuSnapshot = Record<string, DiningMenuLocation>;

export type DiningLocationsSnapshot = Record<string, DiningLocation>;

export function todayPacificKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function resolveMenuDate(): Promise<{
  dateKey: string;
  isFallback: boolean;
}> {
  const today = todayPacificKey();
  const db = getDiningDb();

  try {
    const snap = await get(ref(db, `uw_dining/menus/${today}`));
    if (snap.exists()) return { dateKey: today, isFallback: false };
  } catch {}

  try {
    const meta = await getDiningMetadata();
    if (meta?.last_date_key && meta.last_date_key !== today) {
      return { dateKey: meta.last_date_key, isFallback: true };
    }
  } catch {}

  return { dateKey: today, isFallback: true };
}

export async function getDiningMetadata(): Promise<DiningMetadata | null> {
  const snap = await get(ref(getDiningDb(), "uw_dining/metadata"));
  return snap.exists() ? (snap.val() as DiningMetadata) : null;
}

export async function getDiningLocations(): Promise<DiningLocationsSnapshot> {
  const snap = await get(ref(getDiningDb(), "uw_dining/locations"));
  return snap.exists() ? (snap.val() as DiningLocationsSnapshot) : {};
}

export async function getDiningMenu(
  dateKey: string,
  locationId?: string,
): Promise<DiningMenuSnapshot | DiningMenuLocation | null> {
  const path = locationId
    ? `uw_dining/menus/${dateKey}/${locationId}`
    : `uw_dining/menus/${dateKey}`;
  const snap = await get(ref(getDiningDb(), path));
  if (!snap.exists()) return null;
  return snap.val() as DiningMenuSnapshot | DiningMenuLocation;
}

export function isLocationOpenNow(hoursText: string | undefined): boolean | null {
  if (!hoursText) return null;
  const clean = hoursText.replace(/\s+/g, " ").trim().toUpperCase();
  if (/\bCLOSED\b/.test(clean)) return false;
  const rangeMatch = clean.match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/,
  );
  if (!rangeMatch) return null;

  const toMinutes = (t: string): number => {
    const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2] || "0", 10);
    const ampm = m[3];
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + min;
  };

  const openMin = toMinutes(rangeMatch[1]);
  const closeMin = toMinutes(rangeMatch[2]);

  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const nowMinutes =
    parseInt(nowParts.hour ?? "0", 10) * 60 + parseInt(nowParts.minute ?? "0", 10);

  if (closeMin <= openMin) {
    return nowMinutes >= openMin || nowMinutes < closeMin;
  }
  return nowMinutes >= openMin && nowMinutes < closeMin;
}
