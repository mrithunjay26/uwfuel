// Client types + API wrappers for the dorm pantry.

export const APPLIANCES = [
  "Microwave", "Mini fridge", "Air fryer", "Toaster oven", "Kettle",
  "Hot plate", "Rice cooker", "Blender", "Full stove", "Full oven",
  "Instant Pot", "Sandwich press", "Coffee maker",
] as const;

export const PANTRY_CATEGORIES = ["produce", "protein", "grain", "dairy", "snack", "condiment", "frozen", "beverage", "other"] as const;

export interface ScannedPantryItem {
  name: string;
  category: string;
  quantity: string;
}

export interface RecipeIngredient {
  name: string;
  measure: string;
}

/** A real recipe sourced from TheMealDB — instructions come from a cited source, not AI. */
export interface Recipe {
  id: string;
  title: string;
  image: string;
  category: string;
  area: string;
  source: string;
  youtube: string;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  uses: string[];
  staples: string[];
  missing: string[];
  requiredMethods: string[];
  canMake: boolean;
  matchCount: number;
}

export interface AiKeys {
  cohereKey?: string | null;
  groqKey?: string | null;
}

export interface IngredientResult {
  name: string;
  brand: string;
  image: string;
  category: string;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export function scanPantryPhoto(imageB64: string, keys: AiKeys, signal?: AbortSignal): Promise<{ items: ScannedPantryItem[] }> {
  return postJson("/api/pantry/scan", { imageB64, cohereKey: keys.cohereKey ?? undefined, groqKey: keys.groqKey ?? undefined }, signal);
}

/** Search foods/ingredients (with photos) from Open Food Facts — no AI key required. */
export async function searchIngredients(q: string, signal?: AbortSignal): Promise<IngredientResult[]> {
  const res = await fetch(`/api/pantry/ingredient-search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { results?: IngredientResult[] };
  return data.results ?? [];
}

/** Recipes come from a real recipe database — no AI key required. */
export function findRecipes(
  input: { ingredients: string[]; appliances: string[]; access: string; diet?: string },
  signal?: AbortSignal,
): Promise<{ recipes: Recipe[] }> {
  return postJson("/api/pantry/recipes", input, signal);
}

/**
 * TheMealDB does not carry nutrition, so we estimate per-serving macros from the recipe's
 * category. These are rough starting numbers the user can correct after logging — the app
 * never presents them as exact.
 */
export function estimateRecipeNutrition(r: Recipe): { calories: number; protein: number; carbs: number; fat: number } {
  const cat = (r.category || "").toLowerCase();
  let calories = 430;
  let protein = 20;
  if (/beef|chicken|pork|lamb|goat|seafood/.test(cat)) { calories = 520; protein = 38; }
  else if (/pasta/.test(cat)) { calories = 560; protein = 20; }
  else if (/dessert/.test(cat)) { calories = 380; protein = 6; }
  else if (/breakfast/.test(cat)) { calories = 450; protein = 22; }
  else if (/vegetarian|vegan|side|starter|miscellaneous/.test(cat)) { calories = 400; protein = 16; }
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}
