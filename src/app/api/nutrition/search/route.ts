import { NextResponse } from "next/server";
import { fdcSearch, offSearch } from "../_db";
import type { ScannedFood } from "@/lib/nutrition/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }
  try {
    const [fdc, off] = await Promise.all([fdcSearch(q), offSearch(q)]);
    const seen = new Set<string>();
    const items: ScannedFood[] = [];
    for (const f of [...fdc, ...off]) {
      const key = `${f.name.toLowerCase()}|${f.brand ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(f);
      if (items.length >= 10) break;
    }
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed." },
      { status: 502 },
    );
  }
}
