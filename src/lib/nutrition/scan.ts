// Shared types + thin client wrappers for the meal-scanner API routes.
// These run in the browser; the routes (src/app/api/nutrition/*) hold all keys.

/** Gates the scanner entry points; the server routes also 503 when unconfigured. */
export const SCAN_ENABLED = process.env.NEXT_PUBLIC_SCAN_ENABLED === "true";

export type ScanSource = "vision" | "barcode" | "nlp" | "search";

export interface ScannedFood {
  name: string;
  grams?: number;            // estimated total grams of the portion (for grounding/scaling)
  calories: number;
  protein: number;           // grams
  carbs: number;             // grams
  fat: number;               // grams
  servingDescription?: string;
  confidence?: number;       // 0..1
  brand?: string;
  source: ScanSource;
  grounded?: boolean;        // true when numbers were backed by USDA FDC
}

export interface ScanImageResult {
  items: ScannedFood[];
  ingredients: string[];
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

/** User-provided keys + optional context forwarded to the server route. */
export interface ScanKeys {
  cohereKey?: string | null;
  groqKey?: string | null;
  note?: string;
}

function keyBody(keys?: ScanKeys) {
  return {
    cohereKey: keys?.cohereKey ?? undefined,
    groqKey: keys?.groqKey ?? undefined,
    note: keys?.note ?? undefined,
  };
}

/** Analyze a captured photo (JPEG data URL or raw base64). */
export function scanImage(imageB64: string, keys?: ScanKeys, signal?: AbortSignal): Promise<ScanImageResult> {
  return postJson<ScanImageResult>("/api/nutrition/image", { imageB64, ...keyBody(keys) }, signal);
}

/** Parse a free-text description of a meal ("two eggs and toast"). */
export function scanText(text: string, keys?: ScanKeys, signal?: AbortSignal): Promise<ScanImageResult> {
  return postJson<ScanImageResult>("/api/nutrition/nlp", { text, ...keyBody(keys) }, signal);
}

/** Look up a packaged product by barcode/GTIN via Open Food Facts. */
export function scanBarcode(code: string, signal?: AbortSignal): Promise<{ item: ScannedFood | null }> {
  return postJson<{ item: ScannedFood | null }>("/api/nutrition/barcode", { code }, signal);
}

/** Manual food search (USDA FoodData Central + Open Food Facts). */
export async function searchFoods(q: string, signal?: AbortSignal): Promise<ScannedFood[]> {
  const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Search failed (${res.status})`);
  return (data as { items?: ScannedFood[] }).items ?? [];
}

/** Scale a food's macros by a serving multiplier for display/logging. */
export function scaleFood(food: ScannedFood, servings: number): ScannedFood {
  const m = Math.max(0, servings);
  return {
    ...food,
    grams: food.grams != null ? Math.round(food.grams * m) : undefined,
    calories: Math.round(food.calories * m),
    protein: Math.round(food.protein * m),
    carbs: Math.round(food.carbs * m),
    fat: Math.round(food.fat * m),
  };
}
