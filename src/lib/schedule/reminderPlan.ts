import type { DayEvent, DayEventKind } from "@/lib/schedule/dayPlan";

export interface ReminderItem {
  id: string;
  fireAt: number;
  title: string;
  body: string;
  url: string;
}

const LEAD_MINUTES = 30;

const NOTIFIABLE: Record<string, { label: string; url: string }> = {
  meal: { label: "Meal", url: "/today" },
  workout: { label: "Workout", url: "/today" },
  gym: { label: "Gym", url: "/today" },
  club: { label: "Club", url: "/today" },
  activity: { label: "Activity", url: "/today" },
};

export function isNotifiableKind(kind: DayEventKind): boolean {
  return kind in NOTIFIABLE;
}

function startOfDayMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function remindersFromDayEvents(
  dateKey: string,
  events: DayEvent[],
  nowMs: number,
): ReminderItem[] {
  const base = startOfDayMs(dateKey);
  if (Number.isNaN(base)) return [];

  const seen = new Set<string>();
  const out: ReminderItem[] = [];

  for (const event of events) {
    const meta = NOTIFIABLE[event.kind];
    if (!meta) continue;

    const id = `${dateKey}:${event.id}:pre${LEAD_MINUTES}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const fireAt = base + (event.start - LEAD_MINUTES) * 60_000;
    if (fireAt <= nowMs) continue;

    const where = event.place?.label ? ` · ${event.place.label}` : "";
    out.push({
      id,
      fireAt,
      title: `${event.title} in ${LEAD_MINUTES} min`,
      body: `${meta.label}${where}`,
      url: meta.url,
    });
  }

  return out.sort((a, b) => a.fireAt - b.fireAt);
}
