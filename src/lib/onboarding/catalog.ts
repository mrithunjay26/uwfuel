import type { DiningPlanSelection, HousingContext } from "@/lib/db/types";

export const SETUP_VERSION = 2;
export const DINING_CATALOG_YEAR = "2026-27";

export interface DiningPlanOption extends DiningPlanSelection {
  label: string;
}

const shared = [
  ["1", 1303, 17, "Combination of on- and off-campus meals"],
  ["2", 1479, 19, "Combination of on- and off-campus meals"],
  ["3", 1656, 22, "Combination of on- and off-campus meals"],
  ["4", 1833, 24, "About two meals per day on campus"],
  ["5", 2189, 29, "About two to three meals per day on campus"],
  ["6", 2915, 38, "About three meals per day on campus"],
] as const;

export const RESIDENCE_DINING_PLANS: DiningPlanOption[] = shared.map(([level, quarterly_amount, daily_guide, intended_usage]) => ({
  label: `Level ${level}`,
  catalog_year: DINING_CATALOG_YEAR,
  program: "residence",
  level,
  quarterly_amount,
  daily_guide,
  intended_usage,
}));

export const APARTMENT_DINING_PLANS: DiningPlanOption[] = [
  { label: "Returning Resident", catalog_year: DINING_CATALOG_YEAR, program: "apartment", level: "RR", quarterly_amount: 1183, daily_guide: 14, intended_usage: "Low-cost apartment plan" },
  ...shared.map(([level, quarterly_amount, daily_guide, intended_usage]) => ({ label: `Level ${level}`, catalog_year: DINING_CATALOG_YEAR, program: "apartment" as const, level, quarterly_amount, daily_guide, intended_usage })),
  { label: "Apartment $200", catalog_year: DINING_CATALOG_YEAR, program: "apartment", level: "APT1", quarterly_amount: 200, daily_guide: null, intended_usage: "Occasional campus dining" },
  { label: "Apartment $400", catalog_year: DINING_CATALOG_YEAR, program: "apartment", level: "APT2", quarterly_amount: 400, daily_guide: null, intended_usage: "Occasional campus dining" },
  { label: "Apartment $600", catalog_year: DINING_CATALOG_YEAR, program: "apartment", level: "APT3", quarterly_amount: 600, daily_guide: null, intended_usage: "Regular supplemental campus dining" },
];

export function plansForHousing(housing: HousingContext): DiningPlanOption[] {
  if (housing === "residence_hall") return RESIDENCE_DINING_PLANS;
  if (housing === "campus_apartment") return APARTMENT_DINING_PLANS;
  return [];
}

export function currentQuarterDefaults(now = new Date()): { key: string; start: string; end: string } {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 9) return { key: `autumn-${year}`, start: `${year}-09-23`, end: `${year}-12-12` };
  if (month <= 3) return { key: `winter-${year}`, start: `${year}-01-05`, end: `${year}-03-20` };
  if (month <= 6) return { key: `spring-${year}`, start: `${year}-03-30`, end: `${year}-06-12` };
  return { key: `summer-${year}`, start: `${year}-06-22`, end: `${year}-08-21` };
}
