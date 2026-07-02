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

function norm(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function assessDietarySafety(candidate: DietaryCandidate, profile: DietarySafetyProfile | null): DietaryAssessment {
  if (!profile) return { status: "unknown", evidence: "unknown", reasons: ["Dietary preferences are not set"] };
  const haystack = norm([candidate.name, candidate.description, ...(candidate.ingredients ?? []), ...(candidate.allergens ?? [])].filter(Boolean).join(" "));
  const reasons: string[] = [];
  for (const allergen of profile.allergens) {
    if (haystack.includes(norm(allergen))) reasons.push(`Contains or lists ${allergen}`);
  }
  for (const excluded of profile.hard_exclusions) {
    if (haystack.includes(norm(excluded))) reasons.push(`Matches excluded ingredient ${excluded}`);
  }
  for (const style of profile.styles) {
    const terms = STYLE_TERMS[style];
    const conflict = terms.negative.find((term) => haystack.includes(term));
    if (conflict) reasons.push(`Conflicts with ${style.replace("_", " ")}: ${conflict}`);
  }
  if (reasons.length) return { status: "blocked", evidence: candidate.ingredients?.length || candidate.allergens?.length ? "verified" : "inferred", reasons };

  const styleVerified = profile.styles.every((style) => STYLE_TERMS[style].positive.some((term) => haystack.includes(term)));
  const hasSourceData = Boolean(candidate.ingredients?.length || candidate.allergens?.length);
  if ((profile.styles.length === 0 || styleVerified) && hasSourceData) return { status: "safe", evidence: styleVerified ? "verified" : "inferred", reasons: ["No configured exclusions were found"] };
  return { status: profile.allow_unknown ? "unknown" : "blocked", evidence: "unknown", reasons: ["Dietary status is not verified"] };
}

export function filterSafeCandidates<T extends DietaryCandidate>(items: T[], profile: DietarySafetyProfile | null): T[] {
  return items.filter((item) => assessDietarySafety(item, profile).status !== "blocked");
}
