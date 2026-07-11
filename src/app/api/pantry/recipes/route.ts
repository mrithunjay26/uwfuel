import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real recipes from TheMealDB (https://www.themealdb.com) — a free, community-curated
// recipe database with source attributions + video tutorials. We rank its real recipes by
// how much of the student's actual pantry they use, and strictly classify what equipment
// each recipe needs (parsed from its real instructions) against the student's kitchen.

const API = "https://www.themealdb.com/api/json/v1/1";

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strCategory?: string | null;
  strArea?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  strYoutube?: string | null;
  strSource?: string | null;
  strTags?: string | null;
  [key: string]: string | null | undefined;
}

interface OutRecipe {
  id: string;
  title: string;
  image: string;
  category: string;
  area: string;
  source: string;
  youtube: string;
  tags: string[];
  ingredients: { name: string; measure: string }[];
  steps: string[];
  uses: string[];      // ingredients actually in the student's pantry
  staples: string[];   // common seasonings assumed on hand (salt, oil, …) — NOT claimed to be in inventory
  missing: string[];   // real ingredients the student must buy
  requiredMethods: string[];
  canMake: boolean;
  matchCount: number;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Reduce a messy pantry name ("2% milk", "boneless chicken breasts") to searchable tokens. */
function ingredientTokens(raw: string): string[] {
  let s = raw.toLowerCase().trim();
  s = s.replace(
    /\b\d+([.,/]\d+)?\s*(g|kg|oz|lb|lbs|ml|l|cups?|cans?|bags?|boxes?|packs?|pieces?|slices?|tbsp|tsp|cloves?|bunch(?:es)?|jars?|bottles?)\b/g,
    " ",
  );
  s = s.replace(
    /\b(fresh|frozen|dried|canned|raw|cooked|organic|large|small|medium|boneless|skinless|ground|whole|low[- ]?fat|non[- ]?fat|reduced[- ]?fat|fat[- ]?free|2%|1%|skim|unsalted|salted|extra|virgin|plain|ripe)\b/g,
    " ",
  );
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return [];
  const singular = s.split(" ").map((w) =>
    w.endsWith("ies") ? w.slice(0, -3) + "y"
      : w.endsWith("oes") ? w.slice(0, -2)
      : w.endsWith("ss") ? w
      : w.endsWith("s") && w.length > 3 ? w.slice(0, -1)
      : w,
  );
  const tokens = new Set<string>();
  const full = singular.join(" ");
  if (full.length > 2) tokens.add(full);
  if (singular.length > 1) {
    const last = singular[singular.length - 1];
    if (last.length > 2) tokens.add(last); // core noun, e.g. "chicken" from "chicken breast"
  }
  return [...tokens];
}

/** Individual words (≥3 chars) an ingredient name reduces to — for word-level pantry matching. */
function wordsOf(name: string): string[] {
  return ingredientTokens(name).flatMap((t) => t.split(" ")).filter((w) => w.length >= 3);
}

/** Ubiquitous seasonings/basics assumed to be on hand, shown separately (never as "in pantry"). */
function isStaple(name: string): boolean {
  return /\b(salt|pepper|sugar|water|ice|oil|cooking spray|non[- ]?stick spray|seasoning)\b/i.test(name);
}

/* --------------------------- equipment classifier -------------------------- */

function inferMethods(instructions: string): string[] {
  const t = instructions.toLowerCase();
  const m = new Set<string>();

  // Explicit appliance mentions.
  if (/air[- ]?fry|air[- ]?fryer/.test(t)) m.add("Air fryer");
  if (/microwave/.test(t)) m.add("Microwave");
  if (/slow cooker|crock[- ]?pot/.test(t)) m.add("Slow cooker");
  if (/pressure cooker|instant pot/.test(t)) m.add("Pressure cooker");
  if (/rice cooker/.test(t)) m.add("Rice cooker");
  if (/\b(blend|blender|pur[ée]e|smoothie|food processor)\b/.test(t)) m.add("Blender");
  if (/\bkettle\b/.test(t)) m.add("Kettle");
  if (/\b(toaster|sandwich press|panini)\b/.test(t)) m.add("Toaster");

  // Oven cues (bake/roast/broil, temperatures, preheat).
  if (/\b(bake|baking|baked|roast|roasted|broil|oven|preheat)\b/.test(t) || /°\s?[cf]|gas mark|\bdegrees?\b/.test(t)) m.add("Oven");

  // Grill / barbecue.
  if (/\b(barbecue|bbq|char[- ]?grill|griddle|grill pan|grill)\b/.test(t)) m.add("Grill");

  // Stovetop cues.
  if (/\b(fry|fried|frying|deep[- ]?fry|shallow[- ]?fry|stir[- ]?fry|pan[- ]?fry|saut[ée]|sear|skillet|frying pan|saucepan|sauce pan|wok|boil|boiling|simmer|poach|blanch|steam|braise|brown the|caramel|reduce the|melt|heat the oil|over (?:medium|high|low) heat|on the (?:hob|stove))\b/.test(t)) m.add("Stove");

  // Generic cooking verb but no equipment matched → assume a stovetop (conservative, not "no-cook").
  if (m.size === 0 && /\b(cook|cooked|cooking|heat|heated|warm|hot|prepare)\b/.test(t)) m.add("Stove");

  if (m.size === 0) m.add("No-cook");
  return [...m];
}

function buildCapabilities(appliances: string[], access: string) {
  const kitchen = access !== "none"; // shared / full dorm kitchens include a stove + oven
  const has = (re: RegExp) => appliances.some((a) => re.test(a));
  return {
    stove: kitchen || has(/stove|hot plate/i) || appliances.includes("Instant Pot"),
    oven: kitchen || has(/oven/i) || appliances.includes("Air fryer") || appliances.includes("Toaster oven"),
    airfryer: appliances.includes("Air fryer"),
    microwave: appliances.includes("Microwave"),
    blender: appliances.includes("Blender"),
    riceCooker: appliances.includes("Rice cooker") || appliances.includes("Instant Pot"),
    pressure: appliances.includes("Instant Pot"),
    kettle: appliances.includes("Kettle"),
    press: appliances.includes("Sandwich press"),
    toaster: appliances.includes("Toaster oven") || appliances.includes("Sandwich press"),
  };
}
type Caps = ReturnType<typeof buildCapabilities>;

function coversMethod(method: string, c: Caps): boolean {
  switch (method) {
    case "Stove": return c.stove;
    case "Oven": return c.oven;
    case "Air fryer": return c.airfryer;
    case "Microwave": return c.microwave;
    case "Grill": return c.stove || c.press;
    case "Blender": return c.blender;
    case "Rice cooker": return c.riceCooker;
    case "Pressure cooker": return c.pressure;
    case "Slow cooker": return c.pressure;
    case "Kettle": return c.kettle || c.stove;
    case "Toaster": return c.toaster || c.oven;
    case "No-cook": return true;
    default: return true;
  }
}

/* ------------------------------- parsing ---------------------------------- */

function parseSteps(raw: string): string[] {
  const text = (raw || "").replace(/\r/g, "\n").trim();
  if (!text) return [];
  let parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  parts = parts
    .map((p) => p.replace(/^(step\s*\d+\s*[:.)-]?\s*|\d+\s*[.)]\s*)/i, "").trim())
    .filter(Boolean);
  if (parts.length <= 1 && text.length > 220) {
    parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter((s) => s.length > 1);
  }
  return parts.slice(0, 40);
}

function ingredientsOf(meal: MealDbMeal): { name: string; measure: string }[] {
  const out: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").toString().trim();
    if (!name) continue;
    const measure = (meal[`strMeasure${i}`] || "").toString().trim();
    out.push({ name, measure });
  }
  return out;
}

const MEAT_WORDS = /\b(chicken|beef|pork|bacon|ham|lamb|turkey|sausage|fish|salmon|tuna|shrimp|prawn|anchov|gelatin|meat|steak|mince)\b/i;

export async function POST(req: Request) {
  let body: { ingredients?: unknown; appliances?: unknown; access?: unknown; diet?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients.map(String).slice(0, 40) : [];
  const appliances = Array.isArray(body.appliances) ? body.appliances.map(String).slice(0, 20) : [];
  const access = typeof body.access === "string" ? body.access : "shared";
  const diet = (typeof body.diet === "string" ? body.diet : "").toLowerCase();
  const vegetarian = /vegetarian|vegan|no meat|plant/.test(diet);
  const caps = buildCapabilities(appliances, access);

  // Word set of what the student actually has, plus per-ingredient search terms.
  const pantryWords = new Set<string>();
  const searchTerms = new Set<string>();
  for (const raw of ingredients) {
    for (const w of wordsOf(raw)) pantryWords.add(w);
    for (const t of ingredientTokens(raw)) if (!isStaple(t)) searchTerms.add(t);
  }

  // 1) Find candidate meals by filtering TheMealDB on each pantry ingredient; tally how many
  //    of the student's ingredients point at each meal (higher = uses more of what they have).
  const tally = new Map<string, number>();
  const terms = [...searchTerms].slice(0, 12);
  const filterResults = await Promise.all(
    terms.map((t) => getJson<{ meals: { idMeal: string }[] | null }>(`${API}/filter.php?i=${encodeURIComponent(t)}`)),
  );
  for (const r of filterResults) {
    for (const m of r?.meals ?? []) tally.set(m.idMeal, (tally.get(m.idMeal) ?? 0) + 1);
  }

  // If the pantry gave us nothing to search on, offer a few real recipes to browse.
  let candidateIds = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([id]) => id);
  if (candidateIds.length === 0) {
    const randoms = await Promise.all(
      Array.from({ length: 8 }, () => getJson<{ meals: MealDbMeal[] }>(`${API}/random.php`)),
    );
    const ids = new Set<string>();
    for (const r of randoms) if (r?.meals?.[0]) ids.add(r.meals[0].idMeal);
    candidateIds = [...ids];
  }

  // 2) Look up full details for each candidate (real instructions, measures, source, video).
  const details = await Promise.all(
    candidateIds.map((id) => getJson<{ meals: MealDbMeal[] | null }>(`${API}/lookup.php?i=${encodeURIComponent(id)}`)),
  );

  const recipes: OutRecipe[] = [];
  for (const d of details) {
    const meal = d?.meals?.[0];
    if (!meal) continue;
    const ings = ingredientsOf(meal);
    if (vegetarian && (MEAT_WORDS.test(meal.strCategory || "") || ings.some((i) => MEAT_WORDS.test(i.name)))) continue;

    const uses: string[] = [];
    const staples: string[] = [];
    const missing: string[] = [];
    for (const ing of ings) {
      const have = wordsOf(ing.name).some((w) => pantryWords.has(w));
      if (have) uses.push(ing.name);
      else if (isStaple(ing.name)) staples.push(ing.name);
      else missing.push(ing.name);
    }

    const instructions = meal.strInstructions || "";
    const requiredMethods = inferMethods(instructions);
    const canMake = requiredMethods.every((m) => coversMethod(m, caps));

    recipes.push({
      id: meal.idMeal,
      title: meal.strMeal,
      image: meal.strMealThumb || "",
      category: meal.strCategory || "",
      area: meal.strArea || "",
      source: meal.strSource || "",
      youtube: meal.strYoutube || "",
      tags: (meal.strTags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4),
      ingredients: ings,
      steps: parseSteps(instructions),
      uses,
      staples,
      missing,
      requiredMethods,
      canMake,
      matchCount: tally.get(meal.idMeal) ?? 0,
    });
  }

  // 3) Rank: what you can cook first, then most pantry coverage, then fewest items to buy.
  recipes.sort((a, b) => {
    if (a.canMake !== b.canMake) return a.canMake ? -1 : 1;
    if (b.uses.length !== a.uses.length) return b.uses.length - a.uses.length;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return a.missing.length - b.missing.length;
  });

  return NextResponse.json({ recipes: recipes.slice(0, 14) });
}
