import type { ScannedFood } from "@/lib/nutrition/scan";
import type { RawFood } from "./_vision";

// Server-only nutrition data sources: Open Food Facts (barcodes, keyless) and
// USDA FoodData Central (generic foods + grounding, free key).

const memo = new Map<string, { at: number; value: unknown }>();
const TTL = 10 * 60 * 1000;

function cacheGet<T>(key: string): T | undefined {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  return undefined;
}
function cacheSet(key: string, value: unknown) {
  if (memo.size > 500) memo.clear();
  memo.set(key, { at: Date.now(), value });
}

async function fetchJson(url: string, init?: RequestInit, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0);

/* ── Open Food Facts (barcode) ─────────────────────────────────────── */

export async function offBarcode(code: string): Promise<ScannedFood | null> {
  const gtin = code.replace(/\D/g, "");
  if (!gtin) return null;
  const key = `off:${gtin}`;
  const cached = cacheGet<ScannedFood | null>(key);
  if (cached !== undefined) return cached;

  const url = `https://world.openfoodfacts.org/api/v2/product/${gtin}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`;
  let data: { status?: number; product?: Record<string, unknown> };
  try {
    data = (await fetchJson(url)) as typeof data;
  } catch {
    return null;
  }
  if (!data || data.status !== 1 || !data.product) {
    cacheSet(key, null);
    return null;
  }
  const p = data.product;
  const n = (p.nutriments ?? {}) as Record<string, number>;
  const perServing = n["energy-kcal_serving"] != null;
  const grams = num(p.serving_quantity as number) || (perServing ? undefined : 100);
  const pick = (base: string) => (perServing ? n[`${base}_serving`] : n[`${base}_100g`]);

  const food: ScannedFood = {
    name: String(p.product_name || "Packaged food").slice(0, 80),
    brand: p.brands ? String(p.brands).split(",")[0].trim().slice(0, 40) : undefined,
    grams,
    calories: Math.round(num(pick("energy-kcal"))),
    protein: Math.round(num(pick("proteins"))),
    carbs: Math.round(num(pick("carbohydrates"))),
    fat: Math.round(num(pick("fat"))),
    servingDescription: p.serving_size ? String(p.serving_size).slice(0, 60) : perServing ? "per serving" : "per 100 g",
    source: "barcode",
    grounded: true,
  };
  cacheSet(key, food);
  return food;
}

/** Open Food Facts text search → ScannedFood candidates (manual lookup). */
export async function offSearch(query: string): Promise<ScannedFood[]> {
  const key = `offsearch:${query.toLowerCase()}`;
  const cached = cacheGet<ScannedFood[]>(key);
  if (cached) return cached;
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=6` +
    `&fields=product_name,brands,serving_size,serving_quantity,nutriments`;
  let products: Record<string, unknown>[] = [];
  try {
    const data = (await fetchJson(url)) as { products?: Record<string, unknown>[] };
    products = data.products ?? [];
  } catch {
    return [];
  }
  const out = products
    .map((p) => {
      const n = (p.nutriments ?? {}) as Record<string, number>;
      const perServing = n["energy-kcal_serving"] != null;
      const pick = (base: string) => (perServing ? n[`${base}_serving`] : n[`${base}_100g`]);
      return {
        name: String(p.product_name || "").slice(0, 80),
        brand: p.brands ? String(p.brands).split(",")[0].trim().slice(0, 40) : undefined,
        grams: num(p.serving_quantity as number) || (perServing ? undefined : 100),
        calories: Math.round(num(pick("energy-kcal"))),
        protein: Math.round(num(pick("proteins"))),
        carbs: Math.round(num(pick("carbohydrates"))),
        fat: Math.round(num(pick("fat"))),
        servingDescription: p.serving_size ? String(p.serving_size).slice(0, 60) : perServing ? "per serving" : "per 100 g",
        source: "search" as const,
        grounded: true,
      };
    })
    .filter((f) => f.name && f.calories > 0);
  cacheSet(key, out);
  return out;
}

/* ── USDA FoodData Central ─────────────────────────────────────────── */

interface FdcNutrients { kcal: number; protein: number; carbs: number; fat: number; }

function readFdcNutrients(food: Record<string, unknown>): FdcNutrients {
  const arr = (food.foodNutrients ?? []) as Record<string, unknown>[];
  let kcal = 0, protein = 0, carbs = 0, fat = 0;
  for (const fn of arr) {
    const name = String(fn.nutrientName ?? fn.name ?? "").toLowerCase();
    const unit = String(fn.unitName ?? "").toLowerCase();
    const value = num(fn.value ?? fn.amount);
    if (name.startsWith("energy") && (unit === "kcal" || unit === "")) kcal = kcal || value;
    else if (name.startsWith("protein")) protein = value;
    else if (name.startsWith("carbohydrate")) carbs = value;
    else if (name.startsWith("total lipid")) fat = value;
  }
  return { kcal, protein, carbs, fat };
}

async function fdcSearchRaw(query: string, dataType: string, pageSize: number): Promise<Record<string, unknown>[]> {
  const key = process.env.FDC_API_KEY;
  if (!key) return [];
  const cacheKey = `fdc:${dataType}:${pageSize}:${query.toLowerCase()}`;
  const cached = cacheGet<Record<string, unknown>[]>(cacheKey);
  if (cached) return cached;

  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}` +
    `&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=${encodeURIComponent(dataType)}`;
  try {
    const data = (await fetchJson(url)) as { foods?: Record<string, unknown>[] };
    const foods = data.foods ?? [];
    cacheSet(cacheKey, foods);
    return foods;
  } catch {
    return [];
  }
}

/** Manual search → ScannedFood candidates (per 100 g basis from FDC). */
export async function fdcSearch(query: string): Promise<ScannedFood[]> {
  const foods = await fdcSearchRaw(query, "Foundation,SR Legacy,Branded", 6);
  return foods.map((f) => {
    const nut = readFdcNutrients(f);
    const grams = num(f.servingSize as number) || 100;
    return {
      name: String(f.description || "Food").slice(0, 80),
      brand: f.brandName ? String(f.brandName).slice(0, 40) : undefined,
      grams: 100,
      calories: Math.round(nut.kcal),
      protein: Math.round(nut.protein),
      carbs: Math.round(nut.carbs),
      fat: Math.round(nut.fat),
      servingDescription: `per 100 g${grams !== 100 ? "" : ""}`,
      source: "search" as const,
      grounded: true,
    };
  }).filter((f) => f.calories > 0);
}

/**
 * Ground LLM estimates against FDC for whole foods. Only overrides when we can
 * scale per-100g FDC data by the model's estimated grams — so it never makes
 * numbers worse for branded/composite dishes (those keep the LLM estimate).
 */
export async function groundFoods(items: RawFood[]): Promise<RawFood[]> {
  if (!process.env.FDC_API_KEY) return items;
  return Promise.all(
    items.map(async (item) => {
      const grams = num(item.grams);
      if (grams <= 0) return item;
      try {
        const foods = await fdcSearchRaw(item.name, "Foundation,SR Legacy", 1);
        if (foods.length === 0) return item;
        const nut = readFdcNutrients(foods[0]);
        if (nut.kcal <= 0) return item;
        const factor = grams / 100;
        return {
          ...item,
          calories: Math.round(nut.kcal * factor),
          protein: Math.round(nut.protein * factor),
          carbs: Math.round(nut.carbs * factor),
          fat: Math.round(nut.fat * factor),
          grounded: true,
        };
      } catch {
        return item;
      }
    }),
  );
}
