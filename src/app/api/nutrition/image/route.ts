import { NextResponse } from "next/server";
import { visionAnalyze, fallbackConfigured, UpstreamError } from "../_vision";
import { groundFoods } from "../_db";
import type { ScannedFood } from "@/lib/nutrition/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { imageB64?: unknown; cohereKey?: unknown; groqKey?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const image = body.imageB64;
  const cohereKey = typeof body.cohereKey === "string" && body.cohereKey ? body.cohereKey : undefined;
  const groqKey = typeof body.groqKey === "string" && body.groqKey ? body.groqKey : undefined;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : undefined;
  if (!cohereKey && !groqKey && !fallbackConfigured()) {
    return NextResponse.json(
      { error: "Add a Cohere or Groq key in Settings to scan meals." },
      { status: 503 },
    );
  }
  if (typeof image !== "string" || !image) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }
  if (image.length > 1_600_000) {
    return NextResponse.json({ error: "Image too large — try again." }, { status: 413 });
  }
  try {
    const result = await visionAnalyze({ imageB64: image, cohereKey, groqKey, note });
    const items: ScannedFood[] = (await groundFoods(result.items)).map((f) => ({
      ...f,
      source: "vision" as const,
    }));
    return NextResponse.json({ items, ingredients: result.ingredients });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't read that photo." },
      { status },
    );
  }
}
