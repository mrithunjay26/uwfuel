// Lightweight validator for a user-provided Groq API key. Groq is OpenAI-compatible.

export async function testGroqKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey.trim()) return { ok: false, error: "Enter a key first." };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That key was rejected by Groq." };
    return { ok: false, error: `Groq returned ${res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach Groq. Check your connection." };
  }
}
