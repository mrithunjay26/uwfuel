import type { Customize } from "./types";

export interface HomeSectionDef {
  id: string;
  label: string;
  hint: string;
  fixed?: boolean;
}

export const HOME_SECTIONS: HomeSectionDef[] = [
  { id: "macros",    label: "Calories & macros",  hint: "The ring and protein/carb/fat bars", fixed: true },
  { id: "budget",    label: "Dining budget bar",  hint: "Spend progress in the header",       fixed: true },
  { id: "nextMoves", label: "Your next best moves", hint: "Suggested actions for right now",  fixed: true },
  { id: "wallets",   label: "Food wallets",       hint: "Dining Plan + personal food money",  fixed: true },
  { id: "checklist", label: "Setup checklist",    hint: "Getting-started progress",           fixed: true },
  { id: "today",     label: "My day & campus route", hint: "Shortcut to your day plan" },
  { id: "scan",      label: "Scan a meal",        hint: "Shortcut to the camera scanner" },
  { id: "myfoods",   label: "My foods",           hint: "Saved foods shortcut" },
  { id: "pantry",    label: "Dorm pantry",        hint: "Pantry & recipes shortcut" },
  { id: "goal",      label: "Goal countdown",     hint: "Weeks left to your target weight" },
  { id: "guide",     label: "Setup guide",        hint: "Help & AI key link" },
  { id: "journal",   label: "My Journal",         hint: "Today's logged food list",           fixed: true },
];

export const REORDERABLE_IDS = HOME_SECTIONS.filter((s) => !s.fixed).map((s) => s.id);

export function isHomeSectionVisible(customize: Customize, id: string): boolean {
  return !(customize.homeHidden ?? []).includes(id);
}

export function orderedHomeSections(customize: Customize): string[] {
  const saved = (customize.homeOrder ?? []).filter((id) => REORDERABLE_IDS.includes(id));
  const rest = REORDERABLE_IDS.filter((id) => !saved.includes(id));
  return [...saved, ...rest];
}

export function moveHomeSection(customize: Customize, id: string, delta: number): string[] {
  const order = orderedHomeSections(customize);
  const from = order.indexOf(id);
  if (from === -1) return order;
  const to = Math.min(order.length - 1, Math.max(0, from + delta));
  if (to === from) return order;
  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function toggleHomeSection(customize: Customize, id: string): string[] {
  const hidden = customize.homeHidden ?? [];
  return hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
}

export const START_PAGE_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  today: "/today",
  menu: "/menu",
  plan: "/plan",
  log: "/log",
  workout: "/workout",
  chat: "/chat",
};

export function startPagePath(startPage: string | undefined): string {
  return START_PAGE_PATHS[startPage ?? "dashboard"] ?? "/dashboard";
}
