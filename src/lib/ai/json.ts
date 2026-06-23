export function extractJsonObject<T = unknown>(raw: string): T {
  if (!raw || !raw.trim()) throw new Error("Empty AI response.");
  let text = raw.trim();

  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence && fence[1].trim()) text = fence[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response.");
  }
  let candidate = text.slice(start, end + 1);

  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(candidate) as T;
}

export function tryExtractJsonObject<T = unknown>(raw: string): T | null {
  try {
    return extractJsonObject<T>(raw);
  } catch {
    return null;
  }
}
