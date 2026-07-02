import type { DietarySafetyProfile, DietaryStyle } from "@/lib/db/types";

export interface DietaryCandidate {
  name: string;
  description?: string;
  ingredients?: string[];
  allergens?: string[];
}

export interface DietaryAssessment {
  status: "safe" | "blocked" | "unknown";
  evidence: "verified" | "inferred" | "unknown";
  reasons: string[];
}

const STYLE_TERMS: Record<DietaryStyle, { positive: string[]; negative: string[] }> = {
  vegan: { positive: ["vegan"], negative: ["beef", "pork", "chicken", "turkey", "fish", "salmon", "tuna", "egg", "milk", "cheese", "butter", "honey"] },
  vegetarian: { positive: ["vegetarian", "veggie"], negative: ["beef", "pork", "chicken", "turkey", "fish", "salmon", "tuna", "shrimp", "bacon"] },
  halal: { positive: ["halal"], negative: ["pork", "bacon", "ham", "prosciutto", "alcohol", "wine", "beer"] },
  gluten_sensitive: { positive: ["gluten-free", "gluten free"], negative: ["wheat", "barley", "rye", "flour", "bread", "pasta"] },
};

const DIETARY_STYLES = new Set<DietaryStyle>(["vegan", "vegetarian", "halal", "gluten_sensitive"]);

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/** Firebase omits empty arrays, so normalize both new and legacy setup records at the boundary. */
export function normalizeDietarySafetyProfile(profile: Partial<DietarySafetyProfile> | null | undefined): DietarySafetyProfile | null {
  if (!profile) return null;
  return {
    styles: stringList(profile.styles).filter((style): style is DietaryStyle => DIETARY_STYLES.has(style as DietaryStyle)),
    allergens: stringList(profile.allergens),
    hard_exclusions: stringList(profile.hard_exclusions),
    dislikes: stringList(profile.dislikes),
    cross_contact_sensitive: Boolean(profile.cross_contact_sensitive),
    allow_unknown: profile.allow_unknown ?? true,
  };
}

function norm(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function assessDietarySafety(candidate: DietaryCandidate, profile: DietarySafetyProfile | null): DietaryAssessment {
  const normalized = normalizeDietarySafetyProfile(profile);
  if (!normalized) return { status: "unknown", evidence: "unknown", reasons: ["Dietary preferences are not set"] };
  const candidateIngredients = stringList(candidate.ingredients);
  const candidateAllergens = stringList(candidate.allergens);
  const haystack = norm([candidate.name, candidate.description, ...candidateIngredients, ...candidateAllergens].filter(Boolean).join(" "));
  const reasons: string[] = [];
  for (const allergen of normalized.allergens) {
    if (haystack.includes(norm(allergen))) reasons.push(`Contains or lists ${allergen}`);
  }
  for (const excluded of normalized.hard_exclusions) {
    if (haystack.includes(norm(excluded))) reasons.push(`Matches excluded ingredient ${excluded}`);
  }
  for (const style of normalized.styles) {
    const terms = STYLE_TERMS[style];
    const conflict = terms.negative.find((term) => haystack.includes(term));
    if (conflict) reasons.push(`Conflicts with ${style.replace("_", " ")}: ${conflict}`);
  }
  if (reasons.length) return { status: "blocked", evidence: candidateIngredients.length || candidateAllergens.length ? "verified" : "inferred", reasons };

  const styleVerified = normalized.styles.every((style) => STYLE_TERMS[style].positive.some((term) => haystack.includes(term)));
  const hasSourceData = Boolean(candidateIngredients.length || candidateAllergens.length);
  if ((normalized.styles.length === 0 || styleVerified) && hasSourceData) return { status: "safe", evidence: styleVerified ? "verified" : "inferred", reasons: ["No configured exclusions were found"] };
  return { status: normalized.allow_unknown ? "unknown" : "blocked", evidence: "unknown", reasons: ["Dietary status is not verified"] };
}

export function filterSafeCandidates<T extends DietaryCandidate>(items: T[], profile: DietarySafetyProfile | null): T[] {
  return items.filter((item) => assessDietarySafety(item, profile).status !== "blocked");
}
