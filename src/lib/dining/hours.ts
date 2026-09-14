import type { DiningLocation } from "@/lib/firebase/dining";
import { getLocationGroupName } from "@/lib/menu/flattenMenu";

const WEEKDAY_HOURS = {
  Monday: "7:30 AM - 3:00 PM",
  Tuesday: "7:30 AM - 3:00 PM",
  Wednesday: "7:30 AM - 3:00 PM",
  Thursday: "7:30 AM - 3:00 PM",
  Friday: "7:30 AM - 3:00 PM",
} as const;

export const DINING_HOURS_OVERRIDE: Record<string, Partial<Record<string, string>>> = {
  "Husky Den": { ...WEEKDAY_HOURS },
};

export function pacificWeekday(): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long" }).format(new Date());
}

export function locationHoursText(loc: DiningLocation, weekday: string): string | undefined {
  return DINING_HOURS_OVERRIDE[getLocationGroupName(loc)]?.[weekday]
    ?? loc.hours?.[weekday]
    ?? loc.closes_at
    ?? undefined;
}
