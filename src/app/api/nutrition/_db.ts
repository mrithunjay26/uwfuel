import type { ScannedFood } from "@/lib/nutrition/scan";
import type { RawFood } from "./_vision";
import { lookupFood, type FoodFacts } from "./_foods";

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

const PORTION_FALLBACK = 150;

function scaleTo(facts: FoodFacts, grams: number) {
  const factor = grams / 100;
  return {
    calories: Math.round(facts.kcal * factor),
    protein: Math.round(facts.protein * factor),
    carbs: Math.round(facts.carbs * factor),
    fat: Math.round(facts.fat * factor),
  };
}

function sharesToken(a: string, b: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-zs]/g, " ").split(/s+/).filter((w) => w.length > 2);
  const set = new Set(norm(a));
  return norm(b).some((w) => set.has(w));
}

async function offFacts(name: string): Promise<FoodFacts | null> {
  let hits: ScannedFood[] = [];
  try {
    hits = await offSearch(name);
  } catch {
    return null;
  }
  const best = hits.find((h) => h.calories > 0 && h.name && sharesToken(name, h.name));
  if (!best) return null;
  const basis = best.grams && best.grams > 0 ? best.grams : 100;
  const per100 = 100 / basis;
  return {
    kcal: best.calories * per100,
    protein: best.protein * per100,
    carbs: best.carbs * per100,
    fat: best.fat * per100,
    portion: basis,
  };
}

async function fdcFacts(name: string): Promise<FoodFacts | null> {
  if (!process.env.FDC_API_KEY) return null;
  try {
    const foods = await fdcSearchRaw(name, "Foundation,SR Legacy", 1);
    if (foods.length === 0) return null;
    const nut = readFdcNutrients(foods[0]);
    if (nut.kcal <= 0) return null;
    return { kcal: nut.kcal, protein: nut.protein, carbs: nut.carbs, fat: nut.fat, portion: 100 };
  } catch {
    return null;
  }
}

export async function groundFoods(items: RawFood[]): Promise<RawFood[]> {
  return Promise.all(
    items.map(async (item) => {
      const table = lookupFood(item.name);
      let grams = num(item.grams);
      if (grams <= 0) grams = table ? table.portion : PORTION_FALLBACK;

      if (table) return { ...item, grams, ...scaleTo(table, grams), grounded: true };

      const off = await offFacts(item.name);
      if (off) return { ...item, grams, ...scaleTo(off, grams), grounded: true };

      const fdc = await fdcFacts(item.name);
      if (fdc) return { ...item, grams, ...scaleTo(fdc, grams), grounded: true };

      return { ...item, grams, grounded: false };
    }),
  );
}
