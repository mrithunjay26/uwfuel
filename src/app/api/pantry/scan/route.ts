import { NextResponse } from "next/server";
import { llmJson, fallbackConfigured, UpstreamError } from "@/app/api/nutrition/_vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT = [
  "You are a dorm pantry vision assistant. Look at the photo of a student's fridge / shelf / grocery haul.",
  "List each distinct FOOD or INGREDIENT you can identify (not brand-name marketing, just the food).",
  "Return STRICT JSON only: {\"items\":[{\"name\":string,\"category\":string,\"quantity\":string}]}.",
  "category is one of: produce, protein, grain, dairy, snack, condiment, frozen, beverage, other.",
  "quantity is a short guess like \"1 bag\", \"2 cans\", \"a few\" — or empty if unsure.",
  "If you can't identify any food, return {\"items\":[]}.",
].join(" ");

export async function POST(req: Request) {
  let body: { imageB64?: unknown; cohereKey?: unknown; groqKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const image = body.imageB64;
  const cohereKey = typeof body.cohereKey === "string" && body.cohereKey ? body.cohereKey : undefined;
  const groqKey = typeof body.groqKey === "string" && body.groqKey ? body.groqKey : undefined;
  if (!cohereKey && !groqKey && !fallbackConfigured()) {
    return NextResponse.json({ error: "Add a Cohere or Groq key in Settings to scan your pantry." }, { status: 503 });
  }
  if (typeof image !== "string" || !image) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }
  if (image.length > 1_600_000) {
    return NextResponse.json({ error: "Image too large — try again." }, { status: 413 });
  }
  try {
    const parsed = await llmJson<{ items?: { name?: unknown; category?: unknown; quantity?: unknown }[] }>({
      prompt: PROMPT,
      imageB64: image,
      cohereKey,
      groqKey,
    });
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((it) => ({
            name: String(it?.name ?? "").slice(0, 60).trim(),
            category: String(it?.category ?? "other").slice(0, 20).toLowerCase(),
            quantity: it?.quantity ? String(it.quantity).slice(0, 30) : "",
          }))
          .filter((it) => it.name)
          .slice(0, 40)
      : [];
    return NextResponse.json({ items });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read that photo." }, { status });
  }
}
