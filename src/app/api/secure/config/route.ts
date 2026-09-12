import { NextResponse } from "next/server";
import { encryptionReady, isSealed, open, seal, uidFromIdToken } from "../_crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VALUE_LENGTH = 8000;

export async function POST(req: Request) {
  let body: { mode?: unknown; idToken?: unknown; values?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const mode = body.mode === "open" ? "open" : body.mode === "seal" ? "seal" : null;
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  const values =
    body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : null;

  if (!mode || !values) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  if (!encryptionReady()) {
    return NextResponse.json(
      { error: "This server isn't set up to encrypt secrets yet. Set CONFIG_ENCRYPTION_KEY." },
      { status: 503 },
    );
  }

  const uid = await uidFromIdToken(idToken);
  if (!uid) return NextResponse.json({ error: "Log in again, then retry." }, { status: 401 });

  const out: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") {
      out[field] = null;
      continue;
    }
    if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) {
      return NextResponse.json({ error: "That value is too big to store." }, { status: 400 });
    }
    try {
      out[field] = mode === "seal" ? seal(value, uid) : isSealed(value) ? open(value, uid) : value;
    } catch {
      return NextResponse.json(
        { error: mode === "seal" ? "Couldn't encrypt that." : "Couldn't unlock your saved settings." },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ values: out });
}
