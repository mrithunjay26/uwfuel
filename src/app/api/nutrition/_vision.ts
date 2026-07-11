import { extractJsonObject } from "@/lib/ai/json";

// Server-only vision/NLP helper. The provider key never reaches the client.

export interface RawFood {
  name: string;
  grams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingDescription?: string;
  confidence?: number;
  grounded?: boolean;
}
export interface VisionResult {
  items: RawFood[];
  ingredients: string[];
}

const PROMPT = [
  "You are an expert nutrition & food-vision assistant (calorimetry).",
  "Identify each distinct food or drink in the input.",
  "Estimate the portion ACTUALLY SHOWN by judging real-world scale: use the plate/bowl/utensil,",
  "the hand, packaging, or other reference objects to gauge size, and account for cooking method",
  "(fried vs grilled vs raw), visible oils/sauces/dressings, and food density. Prefer realistic",
  "restaurant/home portions over textbook serving sizes.",
  "For each item estimate that serving's nutrition as accurately as you can.",
  "servingDescription MUST include an approximate total weight in grams in parentheses,",
  'e.g. "1 medium banana (118 g)" or "1.5 cups fried rice (320 g)". Also return that number in `grams`.',
  "Return STRICT JSON ONLY, no prose, matching exactly:",
  '{"items":[{"name":string,"grams":number,"calories":number,"protein":number,"carbs":number,"fat":number,"servingDescription":string,"confidence":number}],"ingredients":[string]}',
  "calories is kcal; protein/carbs/fat are grams; confidence is 0..1.",
  "ingredients is a flat list of the main components you can identify across all items.",
  "IMPORTANT: if the user's input/context states specific calories, macros, portion size,",
  "brand, or preparation, treat those as AUTHORITATIVE and override your visual estimate to match.",
  "If you cannot identify any food, return {\"items\":[],\"ingredients\":[]}.",
].join(" ");

/** The free, server-side fallback provider (used when the user has no Cohere key, or it fails). */
function fallbackProvider(): string {
  return (process.env.VISION_PROVIDER || "gemini").toLowerCase();
}

/** Whether a free fallback provider is configured on the server. */
export function fallbackConfigured(): boolean {
  const p = fallbackProvider();
  if (p === "none") return false;
  if (p === "claude") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (p === "groq") return Boolean(process.env.GROQ_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Strip a `data:image/...;base64,` prefix if present. */
function rawBase64(image: string): { data: string; mime: string } {
  const m = image.match(/^data:(image\/[a-z+]+);base64,(.*)$/i);
  if (m) return { mime: m[1], data: m[2] };
  return { mime: "image/jpeg", data: image };
}

function coerce(parsed: unknown): VisionResult {
  const obj = (parsed ?? {}) as { items?: unknown; ingredients?: unknown };
  const items: RawFood[] = Array.isArray(obj.items)
    ? obj.items.map((raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0);
        return {
          name: String(r.name ?? "Food").slice(0, 80),
          grams: num(r.grams) || undefined,
          calories: Math.round(num(r.calories)),
          protein: Math.round(num(r.protein)),
          carbs: Math.round(num(r.carbs)),
          fat: Math.round(num(r.fat)),
          servingDescription: r.servingDescription ? String(r.servingDescription).slice(0, 100) : undefined,
          confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : undefined,
        };
      }).filter((i) => i.name)
    : [];
  const ingredients: string[] = Array.isArray(obj.ingredients)
    ? obj.ingredients.map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, 40)
    : [];
  return { items, ingredients };
}

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "UpstreamError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract a human message (and any rate-limit retry hint) from a provider error body. */
function describeError(body: string): { message: string; retryMs?: number } {
  try {
    const j = JSON.parse(body) as {
      message?: string; // Cohere / Groq shape
      error?: { message?: string; details?: { retryDelay?: string }[] };
    };
    const msg = j.error?.message ?? j.message;
    const delay = j.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const retryMs = delay ? Math.round(parseFloat(delay) * 1000) : undefined;
    if (msg) return { message: msg, retryMs };
  } catch { /* not JSON */ }
  return { message: body.slice(0, 200) };
}

/** POST JSON with one automatic retry on a transient 429. Throws UpstreamError on failure. */
async function postJsonRetry(url: string, init: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();

    const body = await res.text().catch(() => "");
    const { message, retryMs } = describeError(body);

    // Retry once on a rate-limit if the provider suggests a short wait.
    if (res.status === 429 && attempt === 0) {
      await sleep(Math.min(retryMs ?? 1500, 4000));
      continue;
    }
    const hint =
      res.status === 429
        ? "Vision provider is rate-limited or out of quota. Wait a moment, or check your Gemini plan/billing."
        : `Vision provider error (${res.status}).`;
    throw new UpstreamError(res.status, message ? `${hint} ${message}` : hint);
  }
  throw new UpstreamError(429, "Vision provider is rate-limited. Try again shortly.");
}

/** Final text prompt, appending any user description/context with a neutral label. */
function promptWith(text: string | null): string {
  return text
    ? `${PROMPT}\n\nUser input / context (use it — it may state portion size, preparation, or exactly what's in frame): ${text}`
    : PROMPT;
}

async function callGemini(imageB64: string | null, text: string | null): Promise<VisionResult> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const parts: unknown[] = [{ text: promptWith(text) }];
  if (imageB64) {
    const { data, mime } = rawBase64(imageB64);
    parts.push({ inline_data: { mime_type: mime, data } });
  }
  const json = (await postJsonRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
  return coerce(extractJsonObject(out));
}

async function callClaude(imageB64: string | null, text: string | null): Promise<VisionResult> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const content: unknown[] = [];
  if (imageB64) {
    const { data, mime } = rawBase64(imageB64);
    content.push({ type: "image", source: { type: "base64", media_type: mime, data } });
  }
  content.push({ type: "text", text: promptWith(text) });
  const json = (await postJsonRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 1024, temperature: 0.2, messages: [{ role: "user", content }] }),
  })) as { content?: { text?: string }[] };
  const out = json.content?.map((c) => c.text || "").join("") ?? "";
  return coerce(extractJsonObject(out));
}

/** Build an OpenAI/Cohere-style multimodal message content array. */
function multimodalContent(imageB64: string | null, text: string | null): unknown[] {
  const content: unknown[] = [{ type: "text", text: promptWith(text) }];
  if (imageB64) {
    const url = imageB64.startsWith("data:") ? imageB64 : `data:image/jpeg;base64,${imageB64}`;
    content.push({ type: "image_url", image_url: { url } });
  }
  return content;
}

/** Primary provider: Cohere Command A Vision, using the user's own key (no cost to us). */
async function callCohere(apiKey: string, imageB64: string | null, text: string | null): Promise<VisionResult> {
  const model = process.env.COHERE_VISION_MODEL || "command-a-vision-07-2025";
  const json = (await postJsonRetry("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: multimodalContent(imageB64, text) }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  })) as { message?: { content?: { text?: string }[] } };
  const out = (json.message?.content || []).map((p) => p.text || "").join("");
  return coerce(extractJsonObject(out));
}

/** Groq (OpenAI-compatible, generous free tier) with a vision model, using the given key. */
async function callGroqWithKey(apiKey: string, imageB64: string | null, text: string | null): Promise<VisionResult> {
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  const json = (await postJsonRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: multimodalContent(imageB64, text) }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  })) as { choices?: { message?: { content?: string } }[] };
  return coerce(extractJsonObject(json.choices?.[0]?.message?.content ?? ""));
}

/** The server's free fallback provider, if configured. */
function fallbackVision(imageB64: string | null, text: string | null): Promise<VisionResult> {
  const p = fallbackProvider();
  if (p === "claude") return callClaude(imageB64, text);
  if (p === "groq") return callGroqWithKey(process.env.GROQ_API_KEY!, imageB64, text);
  return callGemini(imageB64, text);
}

/**
 * Analyze a meal. Order of attempts (all free for the user where possible):
 *   1. the user's own Cohere key   2. the user's own Groq key
 *   3. the server's free fallback provider.
 * Throws the most relevant error if every available provider fails.
 */
export async function visionAnalyze(opts: {
  imageB64?: string;
  text?: string;
  note?: string;
  cohereKey?: string;
  groqKey?: string;
}): Promise<VisionResult> {
  const image = opts.imageB64 ?? null;
  const text = [opts.text, opts.note].map((s) => s?.trim()).filter(Boolean).join(" — ") || null;
  let lastErr: unknown;

  if (opts.cohereKey) {
    try { return await callCohere(opts.cohereKey, image, text); }
    catch (e) { lastErr = e; }
  }
  if (opts.groqKey) {
    try { return await callGroqWithKey(opts.groqKey, image, text); }
    catch (e) { lastErr = e; }
  }
  if (fallbackConfigured()) {
    try { return await fallbackVision(image, text); }
    catch (e) { lastErr = e; }
  }

  if (lastErr) {
    throw lastErr instanceof UpstreamError
      ? lastErr
      : new UpstreamError(502, lastErr instanceof Error ? lastErr.message : "Vision failed.");
  }
  throw new UpstreamError(503, "No vision provider available. Add a Cohere or Groq key in Settings to scan meals.");
}

/* ── Generic JSON completion (custom prompt) — used by pantry / recipes ── */

function genericContent(prompt: string, imageB64: string | null): unknown[] {
  const content: unknown[] = [{ type: "text", text: prompt }];
  if (imageB64) {
    const url = imageB64.startsWith("data:") ? imageB64 : `data:image/jpeg;base64,${imageB64}`;
    content.push({ type: "image_url", image_url: { url } });
  }
  return content;
}

async function rawCohere(apiKey: string, prompt: string, imageB64: string | null): Promise<string> {
  const model = imageB64 ? (process.env.COHERE_VISION_MODEL || "command-a-vision-07-2025") : "command-a-03-2025";
  const json = (await postJsonRetry("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: genericContent(prompt, imageB64) }], temperature: 0.3, response_format: { type: "json_object" } }),
  })) as { message?: { content?: { text?: string }[] } };
  return (json.message?.content || []).map((p) => p.text || "").join("");
}

async function rawGroq(apiKey: string, prompt: string, imageB64: string | null): Promise<string> {
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  const json = (await postJsonRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: genericContent(prompt, imageB64) }], temperature: 0.3, response_format: { type: "json_object" } }),
  })) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

async function rawGemini(prompt: string, imageB64: string | null): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const parts: unknown[] = [{ text: prompt }];
  if (imageB64) { const { data, mime } = rawBase64(imageB64); parts.push({ inline_data: { mime_type: mime, data } }); }
  const json = (await postJsonRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.3, responseMimeType: "application/json" } }) },
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
}

async function rawClaude(prompt: string, imageB64: string | null): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const content: unknown[] = [];
  if (imageB64) { const { data, mime } = rawBase64(imageB64); content.push({ type: "image", source: { type: "base64", media_type: mime, data } }); }
  content.push({ type: "text", text: prompt });
  const json = (await postJsonRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.3, messages: [{ role: "user", content }] }),
  })) as { content?: { text?: string }[] };
  return json.content?.map((c) => c.text || "").join("") ?? "";
}

function rawFallback(prompt: string, imageB64: string | null): Promise<string> {
  const p = fallbackProvider();
  if (p === "claude") return rawClaude(prompt, imageB64);
  if (p === "groq") return rawGroq(process.env.GROQ_API_KEY!, prompt, imageB64);
  return rawGemini(prompt, imageB64);
}

/** Run a custom prompt (optionally with an image) and return parsed JSON. Same provider fallback as visionAnalyze. */
export async function llmJson<T = unknown>(opts: {
  prompt: string;
  imageB64?: string;
  cohereKey?: string;
  groqKey?: string;
}): Promise<T> {
  const image = opts.imageB64 ?? null;
  let lastErr: unknown;
  const attempts: (() => Promise<string>)[] = [];
  if (opts.cohereKey) attempts.push(() => rawCohere(opts.cohereKey!, opts.prompt, image));
  if (opts.groqKey) attempts.push(() => rawGroq(opts.groqKey!, opts.prompt, image));
  if (fallbackConfigured()) attempts.push(() => rawFallback(opts.prompt, image));
  for (const attempt of attempts) {
    try { return extractJsonObject<T>(await attempt()); }
    catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr instanceof UpstreamError ? lastErr : new UpstreamError(502, lastErr instanceof Error ? lastErr.message : "AI failed.");
  throw new UpstreamError(503, "No AI provider available. Add a Cohere or Groq key in Settings.");
}
