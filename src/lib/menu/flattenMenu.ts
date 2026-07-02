import type { DiningMenuSnapshot, DiningMenuLocation, DiningLocation } from "@/lib/firebase/dining";
import type { GoalPhase } from "@/lib/db/types";

export interface FlatMenuItem {
  item_id: string;
  unique_key: string;
  location_id: string;
  location_name: string;
  category_key: string;
  category_name: string;
  schedule_text: string;
  available_now: boolean;
  is_beverage: boolean;
  name: string;
  description: string;
  calories: number;
  protein_grams: number;
  price: number;
  allergens: string[];
  ingredients: string[];
  carbs_grams?: number;
  fat_grams?: number;
  image_url?: string;
  order_url?: string;
  orderable?: boolean;
}

export interface LocationGroup {
  name: string;
  stations: Array<{ id: string; name: string; isOpen: boolean | null; hours: string }>;
  isOpen: boolean;
  address: string;
}

function pacificNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
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
  let h = parseInt(parts.hour ?? "0", 10);
  if (h === 24) h = 0;
  return h * 60 + parseInt(parts.minute ?? "0", 10);
}

function pacificWeekday(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
  }).format(new Date());
}

function rangeToMinutes(t: string): number {
  const r = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
  if (!r) return 0;
  let h = parseInt(r[1], 10);
  const min = parseInt(r[2] || "0", 10);
  if (r[3] === "PM" && h !== 12) h += 12;
  if (r[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function openRangeNow(text: string | undefined | null): boolean | null {
  if (!text) return null;
  const clean = text.toUpperCase().replace(/\s+/g, " ").trim();
  if (/\bCLOSED\b/.test(clean)) return false;
  const m = clean.match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/,
  );
  if (!m) return null;
  const now = pacificNowMinutes();
  const open = rangeToMinutes(m[1]);
  const close = rangeToMinutes(m[2]);
  if (close <= open) {
    return now >= open || now < close;
  }
  return now >= open && now < close;
}

function isAvailableNow(scheduleText: string): boolean {
  return openRangeNow(scheduleText) ?? true;
}

export function locationOpenNow(loc: DiningLocation): boolean {
  const fromCloses = openRangeNow(loc.closes_at);
  if (fromCloses !== null) return fromCloses;
  const fromHours = openRangeNow(loc.hours?.[pacificWeekday()]);
  if (fromHours !== null) return fromHours;
  return (loc.current_status || "").toLowerCase().includes("open");
}

const BEVERAGE_KEYWORDS = [
  "coffee", "latte", "espresso", "cappuccino", "americano", "mocha",
  "tea", "juice", "milk", "smoothie", "shake", "soda", "water",
  "drink", "beverage", "lemonade", "kombucha",
];

function isBeverage(item: { name: string; category_name: string }): boolean {
  const text = `${item.name} ${item.category_name}`.toLowerCase();
  return BEVERAGE_KEYWORDS.some((k) => text.includes(k));
}

export function flattenLocationMenu(
  menuNode: DiningMenuLocation | null,
  locationId: string,
  locationName: string,
  locationOpen = true,
): FlatMenuItem[] {
  if (!menuNode?.categories) return [];
  const output: FlatMenuItem[] = [];

  Object.entries(menuNode.categories).forEach(([catKey, cat]) => {
    const categoryName = cat.category_name || catKey;
    const scheduleText = cat.schedule_text || "";
    const items = cat.items || {};

    Object.entries(items).forEach(([itemId, raw]) => {
      const item = raw as unknown as Record<string, unknown>;
      const flat: FlatMenuItem = {
        item_id: itemId,
        unique_key: `${locationId}::${catKey}::${itemId}`,
        location_id: locationId,
        location_name: locationName,
        category_key: catKey,
        category_name: categoryName,
        schedule_text: scheduleText,
        available_now: locationOpen && isAvailableNow(scheduleText),
        is_beverage: false,
        name: String(item.name ?? ""),
        description: String(item.description ?? ""),
        calories: Number(item.calories ?? 0),
        protein_grams: Number(item.protein_grams ?? 0),
        price: Number(item.price ?? 0),
        allergens: Array.isArray(item.allergens) ? (item.allergens as string[]) : [],
        ingredients: Array.isArray(item.ingredients) ? (item.ingredients as string[]) : [],
        carbs_grams: typeof item.carbs_grams === "number" && item.carbs_grams > 0 ? item.carbs_grams : undefined,
        fat_grams:   typeof item.fat_grams   === "number" && item.fat_grams   > 0 ? item.fat_grams   : undefined,
        image_url: typeof item.image_url === "string" ? item.image_url : undefined,
        order_url: typeof item.order_url === "string" ? item.order_url : undefined,
        orderable: typeof item.orderable === "boolean" ? item.orderable : undefined,
      };
      flat.is_beverage = isBeverage(flat);
      output.push(flat);
    });
  });

  return output;
}

export function flattenFullMenu(
  snapshot: DiningMenuSnapshot | null,
  locationNames: Record<string, string>,
  locationOpenById?: Record<string, boolean>,
): FlatMenuItem[] {
  if (!snapshot) return [];
  const items: FlatMenuItem[] = [];
  Object.entries(snapshot).forEach(([locId, locMenu]) => {
    const locName = locationNames[locId] || locId;
    const open = locationOpenById ? (locationOpenById[locId] ?? true) : true;
    items.push(...flattenLocationMenu(locMenu as DiningMenuLocation, locId, locName, open));
  });
  return items;
}

export function buildLocationOpenMap(
  locations: Record<string, DiningLocation>,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  Object.entries(locations).forEach(([id, loc]) => {
    map[id] = locationOpenNow(loc);
  });
  return map;
}

export function scoreMenuItem(
  item: FlatMenuItem,
  phase: GoalPhase,
  remainingBudget: number,
): number {
  const calories = item.calories;
  const protein = item.protein_grams;
  const price = item.price || 999;
  let score = 0;

  if (phase === "bulk") {
    score += calories * 0.42 + protein * 2.1 - price * 1.25;
  } else if (phase === "cut") {
    score += protein * 2.9 - calories * 0.22 - price * 1.1;
  } else {
    score += protein * 2.0 - Math.abs(calories - 650) * 0.12 - price;
  }

  if (item.available_now) score += 14;
  if (price <= remainingBudget) score += 8;
  return score;
}

const NON_MEAL_NAME_TERMS = [
  "cream cheese", "butter", "margarine", "sour cream", "mayonnaise", "mayo",
  "ketchup", "mustard", "dressing", "syrup", "jam", "jelly", "relish",
  "salsa", "gravy", "aioli", "hot sauce", "soy sauce", "seasoning", "topping",
  "add on", "side of",
];
const NON_MEAL_CATEGORY_TERMS = ["condiment", "topping", "sauce", "spread", "add-on", "add on"];
const MEAL_CATEGORY_TERMS = ["entree", "entrée", "bowl", "grill", "sandwich", "burger", "pizza", "pasta", "breakfast", "lunch", "dinner", "deli", "global"];

/** Keeps dashboard recommendations focused on complete, purchasable meals—not add-ons. */
export function isMealRecommendationCandidate(item: FlatMenuItem): boolean {
  if (!item.available_now || item.is_beverage || item.price < 1.5) return false;
  const name = item.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const category = item.category_name.toLowerCase();
  if (NON_MEAL_CATEGORY_TERMS.some((term) => category.includes(term))) return false;
  if (NON_MEAL_NAME_TERMS.some((term) => name === term || name.startsWith(`${term} `) || name.endsWith(` ${term}`))) return false;
  const calories = Math.max(0, item.calories);
  const protein = Math.max(0, item.protein_grams);
  return (calories >= 220 && protein >= 10) || (calories >= 350 && protein >= 6) || (calories >= 150 && protein >= 20);
}

export function scoreMealRecommendation(item: FlatMenuItem, dailyBudget: number): number {
  if (!isMealRecommendationCandidate(item)) return Number.NEGATIVE_INFINITY;
  const category = item.category_name.toLowerCase();
  const categoryBonus = MEAL_CATEGORY_TERMS.some((term) => category.includes(term)) ? 24 : 0;
  const budgetPenalty = dailyBudget > 0 && item.price > dailyBudget ? (item.price - dailyBudget) * 14 : 0;
  return item.protein_grams * 4
    + Math.min(item.calories, 850) * 0.035
    - Math.abs(item.calories - 600) * 0.02
    - item.price * 1.2
    - budgetPenalty
    + categoryBonus;
}

export type MenuFilter = "all" | "available" | "vegan" | "vegetarian" | "low-cal" | "hi-protein" | "halal";

const VEGAN_ALLERGENS = ["dairy", "milk", "egg", "eggs", "meat", "fish", "seafood", "poultry", "chicken", "beef", "pork"];
const VEGETARIAN_ALLERGENS = ["meat", "fish", "seafood", "poultry", "chicken", "beef", "pork"];
const HALAL_SKIP = ["pork", "bacon", "lard", "gelatin"];

export function filterMenuItems(
  items: FlatMenuItem[],
  filter: MenuFilter,
  search: string,
  hideBeverages = false,
): FlatMenuItem[] {
  let result = items;

  if (hideBeverages) result = result.filter((i) => !i.is_beverage);

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category_name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }

  switch (filter) {
    case "available":
      return result.filter((i) => i.available_now);
    case "vegan": {
      const text = (i: FlatMenuItem) => `${i.name} ${i.description} ${i.ingredients.join(" ")} ${i.allergens.join(" ")}`.toLowerCase();
      return result.filter((i) => !VEGAN_ALLERGENS.some((k) => text(i).includes(k)));
    }
    case "vegetarian": {
      const text = (i: FlatMenuItem) => `${i.name} ${i.description} ${i.allergens.join(" ")}`.toLowerCase();
      return result.filter((i) => !VEGETARIAN_ALLERGENS.some((k) => text(i).includes(k)));
    }
    case "low-cal":
      return result.filter((i) => i.calories > 0 && i.calories < 450);
    case "hi-protein":
      return result.filter((i) => i.protein_grams >= 20);
    case "halal": {
      const text = (i: FlatMenuItem) => `${i.name} ${i.description} ${i.ingredients.join(" ")}`.toLowerCase();
      return result.filter((i) => !HALAL_SKIP.some((k) => text(i).includes(k)));
    }
    default:
      return result;
  }
}

export function getLocationGroupName(loc: DiningLocation): string {
  if (loc.location_group) return loc.location_group;
  const name = (loc.name || "").toLowerCase();
  if (name.includes("center table") || name.includes("center_table")) return "Center Table";
  if (name.includes("local point") || name.includes("local_point")) return "Local Point";
  if (name.includes("husky den") || name.includes("husky_den")) return "Husky Den";
  if (name.includes("by george") || name.includes("by_george")) return "By George";
  if (name.includes("microsoft")) return "Microsoft Cafe";
  if (name.includes("alder")) return "Alder Hall";
  if (name.includes("elm")) return "Elm Hall";
  if (name.includes("willow")) return "Willow Hall";
  return loc.name || "Other";
}

export function buildLocationGroups(
  locations: Record<string, DiningLocation>,
): LocationGroup[] {
  const groups: Record<string, LocationGroup> = {};

  Object.entries(locations).forEach(([id, loc]) => {
    const groupName = getLocationGroupName(loc);
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        stations: [],
        isOpen: false,
        address: loc.address || "",
      };
    }
    const isOpen = locationOpenNow(loc);
    groups[groupName].stations.push({
      id,
      name: loc.name,
      isOpen,
      hours: loc.closes_at || "",
    });
    if (isOpen) groups[groupName].isOpen = true;
  });

  return Object.values(groups).sort((a, b) => {
    if (a.isOpen && !b.isOpen) return -1;
    if (!a.isOpen && b.isOpen) return 1;
    return a.name.localeCompare(b.name);
  });
}
