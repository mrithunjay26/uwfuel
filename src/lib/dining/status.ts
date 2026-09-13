export type DiningState = "open" | "closing_soon" | "closed" | "unknown";

export interface DiningStatus {
  state: DiningState;
  label: string;
  closesAt: number | null;
  opensAt: number | null;
}

const CLOSING_SOON_MIN = 45;

function toMinutes(t: string): number {
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || "0", 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function fmt(minute: number): string {
  const total = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const mm = total % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${period}`;
}

function parseRange(hoursText: string | undefined): { open: number; close: number } | null {
  if (!hoursText) return null;
  const clean = hoursText.replace(/\s+/g, " ").trim().toUpperCase();
  if (/\bCLOSED\b/.test(clean)) return null;
  const m = clean.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/);
  if (!m) return null;
  return { open: toMinutes(m[1]), close: toMinutes(m[2]) };
}

export function isExplicitlyClosed(hoursText: string | undefined): boolean {
  return Boolean(hoursText && /\bclosed\b/i.test(hoursText));
}

export function isOpenAt(hoursText: string | undefined, minute: number): boolean | null {
  if (isExplicitlyClosed(hoursText)) return false;
  const range = parseRange(hoursText);
  if (!range) return null;
  if (range.close <= range.open) return minute >= range.open || minute < range.close;
  return minute >= range.open && minute < range.close;
}

export function diningStatus(hoursText: string | undefined, nowMinute: number): DiningStatus {
  if (isExplicitlyClosed(hoursText)) {
    return { state: "closed", label: "Closed today", closesAt: null, opensAt: null };
  }
  const range = parseRange(hoursText);
  if (!range) return { state: "unknown", label: "Hours unknown", closesAt: null, opensAt: null };

  const open = isOpenAt(hoursText, nowMinute);
  if (open) {
    const untilClose = (range.close - nowMinute + 1440) % 1440;
    if (untilClose <= CLOSING_SOON_MIN) {
      return { state: "closing_soon", label: `Closing ${fmt(range.close)}`, closesAt: range.close, opensAt: null };
    }
    return { state: "open", label: `Open until ${fmt(range.close)}`, closesAt: range.close, opensAt: null };
  }
  return { state: "closed", label: `Opens ${fmt(range.open)}`, closesAt: null, opensAt: range.open };
}
