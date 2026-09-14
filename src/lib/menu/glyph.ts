const GLYPH_RULES: [RegExp, string][] = [
  [/coffee|latte|espresso|mocha|cappuccino|americano|cold brew/, "☕"],
  [/matcha|\btea\b|chai/, "🍵"],
  [/\bmilk\b/, "🥛"],
  [/water/, "💧"],
  [/smoothie|shake|juice|lemonade|soda|cola|drink|kombucha/, "🥤"],
  [/pizza/, "🍕"],
  [/burger|cheeseburger/, "🍔"],
  [/salad|greens/, "🥗"],
  [/sandwich|panini|wrap|sub\b/, "🥪"],
  [/taco|burrito|quesadilla|nacho/, "🌮"],
  [/pasta|noodle|spaghetti|ramen|mac and cheese|lasagna/, "🍝"],
  [/soup|broth|pho|chowder|stew/, "🍜"],
  [/sushi|salmon|tuna|shrimp|seafood|\bfish\b/, "🍣"],
  [/chicken|wing|poultry|nugget/, "🍗"],
  [/rice|grain|quinoa/, "🍚"],
  [/egg|omelet|breakfast|scramble/, "🍳"],
  [/pancake|waffle|french toast/, "🥞"],
  [/cake|cookie|brownie|dessert|pastry|donut|muffin|ice cream|pie|sweet|chocolate/, "🍰"],
  [/fruit|apple|banana|berry|melon|grape|orange/, "🍎"],
  [/bowl|poke/, "🥣"],
  [/beef|steak|pork|bacon|sausage/, "🥩"],
  [/bread|bagel|toast|bun|roll|croissant/, "🥐"],
  [/cheese|dairy/, "🧀"],
  [/potato|fries|fry\b/, "🍟"],
  [/veg|vegetable|broccoli|carrot|tofu/, "🥦"],
];

export function foodGlyph(name: string, extra = ""): string {
  const hay = `${name} ${extra}`.toLowerCase();
  for (const [re, glyph] of GLYPH_RULES) if (re.test(hay)) return glyph;
  return "🍽️";
}
