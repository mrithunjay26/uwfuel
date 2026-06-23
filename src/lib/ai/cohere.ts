const COHERE_CHAT_URL = "https://api.cohere.com/v2/chat";
const COHERE_MODEL = "command-a-03-2025";

interface CohereMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callCohere(
  apiKey: string,
  prompt: string | CohereMessage[],
  opts: { temperature?: number; signal?: AbortSignal } = {},
): Promise<string> {
  if (!apiKey) throw new Error("No Cohere API key set. Add one in Settings to use AI features.");

  const messages: CohereMessage[] =
    typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

  const response = await fetch(COHERE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: COHERE_MODEL,
      messages,
      temperature: opts.temperature ?? 0.55,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(cohereErrorMessage(response.status, text));
  }

  const data = await response.json();
  const parts = data?.message?.content || [];
  return parts
    .map((p: { text?: string }) => p.text || "")
    .join("\n")
    .trim();
}

export async function testCohereKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey.trim()) return { ok: false, error: "Enter a key first." };
  try {
    const res = await fetch("https://api.cohere.com/v1/models?page_size=1", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That key was rejected by Cohere." };
    return { ok: false, error: `Cohere returned ${res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach Cohere. Check your connection." };
  }
}

function cohereErrorMessage(status: number, body: string): string {
  if (status === 401) return "Your Cohere key was rejected. Check it in Settings.";
  if (status === 429) return "Cohere rate limit hit. Wait a moment and try again.";
  try {
    const parsed = JSON.parse(body);
    if (parsed?.message) return `Cohere: ${parsed.message}`;
  } catch {}
  return body ? `Cohere error (${status}): ${body.slice(0, 200)}` : `Cohere error (${status}).`;
}
