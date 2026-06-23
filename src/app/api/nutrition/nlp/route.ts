import { NextResponse } from "next/server";
import { visionAnalyze, fallbackConfigured, UpstreamError } from "../_vision";
import { groundFoods } from "../_db";
import type { ScannedFood } from "@/lib/nutrition/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: unknown; cohereKey?: unknown; groqKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const cohereKey = typeof body.cohereKey === "string" && body.cohereKey ? body.cohereKey : undefined;
  const groqKey = typeof body.groqKey === "string" && body.groqKey ? body.groqKey : undefined;
  if (!cohereKey && !groqKey && !fallbackConfigured()) {
    return NextResponse.json(
      { error: "Add a Cohere or Groq key in Settings to analyze meals." },
      { status: 503 },
    );
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 400) : "";
  if (!text) {
    return NextResponse.json({ error: "Describe what you ate." }, { status: 400 });
  }
  try {
    const result = await visionAnalyze({ text, cohereKey, groqKey });
    const items: ScannedFood[] = (await groundFoods(result.items)).map((f) => ({
      ...f,
      source: "nlp" as const,
    }));
    return NextResponse.json({ items, ingredients: result.ingredients });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't parse that." },
      { status },
    );
  }
}
