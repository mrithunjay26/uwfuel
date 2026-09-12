export const SCAN_ENABLED = process.env.NEXT_PUBLIC_SCAN_ENABLED === "true";

export type ScanSource = "vision" | "barcode" | "nlp" | "search";

export interface ScannedFood {
  name: string;
  grams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingDescription?: string;
  confidence?: number;
  brand?: string;
  source: ScanSource;
  grounded?: boolean;
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

export interface ScanKeys {
  cohereKey?: string | null;
  note?: string;
}

function keyBody(keys?: ScanKeys) {
  return {
    cohereKey: keys?.cohereKey ?? undefined,
    note: keys?.note ?? undefined,
  };
}

export function scanImage(imageB64: string, keys?: ScanKeys, signal?: AbortSignal): Promise<ScanImageResult> {
  return postJson<ScanImageResult>("/api/nutrition/image", { imageB64, ...keyBody(keys) }, signal);
}

export function scanText(text: string, keys?: ScanKeys, signal?: AbortSignal): Promise<ScanImageResult> {
  return postJson<ScanImageResult>("/api/nutrition/nlp", { text, ...keyBody(keys) }, signal);
}

export function scanBarcode(code: string, signal?: AbortSignal): Promise<{ item: ScannedFood | null }> {
  return postJson<{ item: ScannedFood | null }>("/api/nutrition/barcode", { code }, signal);
}

export async function searchFoods(q: string, signal?: AbortSignal): Promise<ScannedFood[]> {
  const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Search failed (${res.status})`);
  return (data as { items?: ScannedFood[] }).items ?? [];
}

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
