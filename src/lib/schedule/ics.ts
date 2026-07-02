import type { ClassSchedule, ClassStop, Weekday } from "@/lib/db/types";

const DAY_CODES: Record<string, Weekday> = { MO: "monday", TU: "tuesday", WE: "wednesday", TH: "thursday", FR: "friday", SA: "saturday", SU: "sunday" };

function unfold(text: string) { return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); }
function valueOf(lines: string[], key: string) {
  const line = lines.find((item) => item.startsWith(`${key}:`) || item.startsWith(`${key};`));
  return line?.slice(line.indexOf(":") + 1).replace(/\\,/g, ",").replace(/\\n/g, " ").trim() ?? "";
}
function timeOf(raw: string) {
  const match = raw.match(/T(\d{2})(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}
function weekdayFromDate(raw: string): Weekday | null {
  const match = raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as Weekday[])[date.getDay()];
}

export function parseIcsSchedule(text: string): ClassSchedule {
  const lines = unfold(text);
  const events: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT" && current) { events.push(current); current = null; }
    else current?.push(line);
  }
  const schedule: ClassSchedule = {};
  events.forEach((event, index) => {
    const startRaw = valueOf(event, "DTSTART");
    const endRaw = valueOf(event, "DTEND");
    const rule = valueOf(event, "RRULE");
    const byDay = rule.match(/BYDAY=([^;]+)/)?.[1]?.split(",").map((code) => DAY_CODES[code]).filter(Boolean) ?? [];
    const days = byDay.length ? byDay : [weekdayFromDate(startRaw)].filter(Boolean) as Weekday[];
    const stop: ClassStop = {
      id: valueOf(event, "UID") || `ics-${index}`,
      title: valueOf(event, "SUMMARY") || "Class",
      building_label: valueOf(event, "LOCATION") || "Location TBD",
      start_time: timeOf(startRaw),
      end_time: timeOf(endRaw),
      lat: null,
      lng: null,
      source: "ics",
    };
    if (!stop.start_time || !stop.end_time) return;
    days.forEach((day) => { (schedule[day] ||= []).push({ ...stop, id: `${stop.id}-${day}` }); });
  });
  Object.values(schedule).forEach((stops) => stops?.sort((a, b) => a.start_time.localeCompare(b.start_time)));
  return schedule;
}

export function mergeClassSchedules(existing: ClassSchedule | null, imported: ClassSchedule): ClassSchedule {
  const merged: ClassSchedule = { ...(existing ?? {}) };
  (Object.keys(imported) as Weekday[]).forEach((day) => {
    const byId = new Map((merged[day] ?? []).map((stop) => [stop.id, stop]));
    (imported[day] ?? []).forEach((stop) => byId.set(stop.id, stop));
    merged[day] = [...byId.values()].sort((a, b) => a.start_time.localeCompare(b.start_time));
  });
  return merged;
}
