export interface FoodFacts {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number;
}

type Row = [number, number, number, number, number];

const TABLE: Record<string, Row> = {
  "chicken breast": [165, 31, 0, 3.6, 120],
  "grilled chicken": [165, 31, 0, 3.6, 120],
  "fried chicken": [320, 19, 14, 21, 140],
  "chicken tenders": [297, 18, 18, 17, 120],
  "chicken wings": [203, 18, 0, 14, 100],
  "chicken thigh": [209, 26, 0, 11, 110],
  "turkey breast": [135, 30, 0, 1, 110],
  "ground beef": [250, 26, 0, 15, 113],
  "burger patty": [250, 26, 0, 15, 113],
  "cheeseburger": [250, 13, 19, 13, 165],
  "hamburger": [254, 13, 30, 9, 150],
  "steak": [271, 25, 0, 19, 170],
  "pork chop": [231, 26, 0, 14, 130],
  "bacon": [541, 37, 1.4, 42, 30],
  "sausage": [301, 13, 2, 27, 75],
  "hot dog": [290, 10, 4, 26, 98],
  "salmon": [208, 20, 0, 13, 170],
  "tuna": [132, 28, 0, 1, 100],
  "shrimp": [99, 24, 0.2, 0.3, 100],
  "tilapia": [129, 26, 0, 2.7, 150],
  "tofu": [76, 8, 1.9, 4.8, 126],
  "eggs": [155, 13, 1.1, 11, 100],
  "scrambled eggs": [149, 10, 1.6, 11, 120],
  "fried egg": [196, 14, 0.8, 15, 60],
  "omelette": [154, 11, 1, 12, 180],
  "white rice": [130, 2.7, 28, 0.3, 158],
  "brown rice": [123, 2.7, 26, 1, 158],
  "fried rice": [163, 5, 20, 6, 200],
  "quinoa": [120, 4.4, 21, 1.9, 185],
  "pasta": [131, 5, 25, 1.1, 140],
  "spaghetti": [158, 6, 31, 0.9, 140],
  "mac and cheese": [164, 6.5, 20, 6.6, 220],
  "lo mein": [150, 6, 22, 5, 250],
  "ramen": [188, 5, 27, 7, 300],
  "pad thai": [180, 8, 25, 6, 300],
  "pho": [45, 3, 5, 1, 500],
  "pizza": [266, 11, 33, 10, 107],
  "burrito": [206, 9, 26, 7.5, 250],
  "taco": [217, 10, 20, 11, 100],
  "quesadilla": [290, 13, 25, 15, 180],
  "sandwich": [220, 14, 26, 6, 200],
  "grilled cheese": [350, 13, 33, 18, 120],
  "sushi roll": [150, 6, 28, 1.5, 170],
  "french fries": [312, 3.4, 41, 15, 117],
  "potato": [93, 2.5, 21, 0.1, 173],
  "mashed potatoes": [113, 2, 17, 4.2, 210],
  "sweet potato": [90, 2, 21, 0.1, 200],
  "hash browns": [265, 3, 28, 16, 100],
  "broccoli": [35, 2.4, 7, 0.4, 150],
  "green beans": [31, 1.8, 7, 0.1, 125],
  "carrots": [41, 0.9, 10, 0.2, 128],
  "corn": [86, 3.2, 19, 1.2, 154],
  "mixed vegetables": [65, 3, 13, 0.5, 150],
  "garden salad": [60, 2, 8, 2, 150],
  "caesar salad": [190, 5, 8, 16, 150],
  "chicken salad": [120, 12, 6, 5, 300],
  "black beans": [132, 8.9, 24, 0.5, 172],
  "chickpeas": [164, 8.9, 27, 2.6, 164],
  "lentils": [116, 9, 20, 0.4, 198],
  "hummus": [166, 8, 14, 10, 60],
  "avocado": [160, 2, 9, 15, 150],
  "white bread": [265, 9, 49, 3.2, 28],
  "wheat bread": [247, 13, 41, 3.4, 28],
  "bagel": [250, 10, 49, 1.5, 95],
  "toast": [313, 12, 55, 4, 30],
  "tortilla": [304, 8, 51, 7, 45],
  "cereal": [379, 7, 84, 3, 40],
  "oatmeal": [71, 2.5, 12, 1.5, 234],
  "pancakes": [227, 6.4, 28, 9.7, 154],
  "waffle": [291, 7.9, 33, 14, 75],
  "french toast": [229, 8, 25, 11, 130],
  "milk": [61, 3.2, 4.8, 3.3, 244],
  "skim milk": [34, 3.4, 5, 0.2, 244],
  "greek yogurt": [59, 10, 3.6, 0.4, 170],
  "yogurt": [63, 5, 7, 1.6, 170],
  "cheddar cheese": [403, 25, 1.3, 33, 28],
  "mozzarella": [280, 28, 3.1, 17, 28],
  "butter": [717, 0.9, 0.1, 81, 14],
  "apple": [52, 0.3, 14, 0.2, 182],
  "banana": [89, 1.1, 23, 0.3, 118],
  "orange": [47, 0.9, 12, 0.1, 131],
  "grapes": [69, 0.7, 18, 0.2, 150],
  "strawberries": [32, 0.7, 7.7, 0.3, 150],
  "blueberries": [57, 0.7, 14, 0.3, 148],
  "watermelon": [30, 0.6, 7.6, 0.2, 152],
  "chicken curry": [150, 12, 6, 9, 250],
  "stir fry": [130, 9, 12, 5, 250],
  "orange chicken": [250, 12, 25, 11, 200],
  "chili": [112, 7, 11, 4, 250],
  "chicken noodle soup": [36, 2, 4, 1.2, 245],
  "tomato soup": [66, 1.6, 12, 1.5, 245],
  "peanut butter": [588, 25, 20, 50, 32],
  "almonds": [579, 21, 22, 50, 28],
  "trail mix": [462, 14, 45, 29, 40],
  "granola bar": [471, 10, 64, 20, 40],
  "protein bar": [350, 30, 35, 10, 60],
  "protein shake": [52, 10, 3, 0.5, 330],
  "smoothie": [60, 1.5, 13, 0.5, 300],
  "potato chips": [536, 7, 53, 34, 28],
  "pretzels": [380, 10, 80, 3, 30],
  "popcorn": [387, 13, 78, 4.5, 25],
  "cookie": [474, 5, 64, 22, 30],
  "brownie": [466, 6, 60, 23, 60],
  "muffin": [377, 6, 54, 15, 110],
  "donut": [452, 5, 51, 25, 60],
  "ice cream": [207, 3.5, 24, 11, 132],
  "cake": [350, 4, 53, 14, 100],
  "coffee": [1, 0.1, 0, 0, 240],
  "latte": [42, 2.2, 4.2, 1.8, 350],
  "orange juice": [45, 0.7, 10, 0.2, 248],
  "soda": [41, 0, 11, 0, 355],
  "energy drink": [45, 0, 11, 0, 250],
  "beer": [43, 0.5, 3.6, 0, 355],
};

const ALIASES: Record<string, string> = {
  "chicken": "chicken breast",
  "grilled chicken breast": "chicken breast",
  "rice": "white rice",
  "jasmine rice": "white rice",
  "noodles": "pasta",
  "penne": "pasta",
  "fries": "french fries",
  "chips": "potato chips",
  "egg": "eggs",
  "salad": "garden salad",
  "burger": "cheeseburger",
  "sub": "sandwich",
  "wrap": "burrito",
  "yoghurt": "yogurt",
  "cheese": "cheddar cheese",
  "baked potato": "potato",
  "soup": "chicken noodle soup",
  "oats": "oatmeal",
  "pancake": "pancakes",
  "cola": "soda",
  "juice": "orange juice",
  "veggies": "mixed vegetables",
  "vegetables": "mixed vegetables",
};

const STOP = new Set([
  "a", "an", "the", "of", "with", "and", "or", "in", "on", "fresh", "hot", "cold",
  "small", "medium", "large", "side", "plate", "bowl", "cup", "serving", "portion",
  "grilled", "baked", "roasted", "steamed", "fried", "cooked", "raw", "homemade",
]);

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .filter((w) => w && !STOP.has(w));
}

function toFacts(row: Row): FoodFacts {
  return { kcal: row[0], protein: row[1], carbs: row[2], fat: row[3], portion: row[4] };
}

export function lookupFood(name: string): FoodFacts | null {
  const norm = normalize(name);
  if (!norm) return null;

  if (TABLE[norm]) return toFacts(TABLE[norm]);
  if (ALIASES[norm] && TABLE[ALIASES[norm]]) return toFacts(TABLE[ALIASES[norm]]);

  const want = tokens(name);
  if (want.length === 0) return null;
  const wantSet = new Set(want);

  let best: { key: string; score: number } | null = null;
  for (const key of Object.keys(TABLE)) {
    const keyTokens = tokens(key);
    if (keyTokens.length === 0) continue;
    let hits = 0;
    for (const kt of keyTokens) if (wantSet.has(kt)) hits++;
    if (hits === 0) continue;
    const score = hits / keyTokens.length + hits / want.length;
    if (!best || score > best.score) best = { key, score };
  }
  if (best && best.score >= 1) return toFacts(TABLE[best.key]);

  for (const [alias, target] of Object.entries(ALIASES)) {
    const at = tokens(alias);
    if (at.length > 0 && at.every((t) => wantSet.has(t)) && TABLE[target]) {
      return toFacts(TABLE[target]);
    }
  }
  return null;
}
