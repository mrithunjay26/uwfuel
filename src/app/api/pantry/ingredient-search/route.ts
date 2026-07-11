import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ingredient / food search backed by Open Food Facts — a free, open database that covers
// both generic foods ("tomato", "brown rice") and branded products ("Rice Krispies"), each
// with a real product photo. No API key required.

const OFF = "https://world.openfoodfacts.org/cgi/search.pl";

interface OffProduct {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_small_url?: string;
  categories_tags?: string[];
}

export interface IngredientResult {
  name: string;
  brand: string;
  image: string;
  category: string;
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/vegetable|fruit|produce|fresh/, "produce"],
  [/meat|poultry|fish|seafood|egg|tofu|bean|legume|protein/, "protein"],
  [/rice|pasta|bread|cereal|grain|oat|noodle|flour/, "grain"],
  [/dairy|milk|cheese|yogurt|yoghurt|butter/, "dairy"],
  [/snack|chip|cracker|cookie|candy|chocolate|bar/, "snack"],
  [/sauce|condiment|spread|oil|vinegar|dressing|spice/, "condiment"],
  [/frozen/, "frozen"],
  [/beverage|drink|juice|soda|water|coffee|tea/, "beverage"],
];

function guessCategory(tags: string[]): string {
  const joined = tags.join(" ").toLowerCase();
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(joined)) return cat;
  return "other";
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const url = `${OFF}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30`
    + `&fields=product_name,generic_name,brands,image_front_small_url,image_small_url,categories_tags`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "UWFuel/1.0 (dorm pantry)", accept: "application/json" },
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = (await res.json()) as { products?: OffProduct[] };
    const seen = new Set<string>();
    const results: IngredientResult[] = [];
    for (const p of data.products ?? []) {
      const name = (p.product_name || p.generic_name || "").trim();
      const image = p.image_front_small_url || p.image_small_url || "";
      if (!name || !image) continue; // cards need a real photo
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name: name.slice(0, 80),
        brand: (p.brands || "").split(",")[0]?.trim().slice(0, 40) || "",
        image,
        category: guessCategory(p.categories_tags ?? []),
      });
      if (results.length >= 18) break;
    }
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
