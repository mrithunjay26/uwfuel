import type { FirebaseClientConfig } from "./types";

const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"] as const;

export interface ParseResult {
  ok: boolean;
  config?: FirebaseClientConfig;
  error?: string;
  missing?: string[];
}

export function parseFirebaseConfig(raw: string): ParseResult {
  const text = (raw || "").trim();
  if (!text) return { ok: false, error: "Paste your firebaseConfig to continue." };

  const objText = extractObject(text);
  if (!objText) return { ok: false, error: "Couldn't find a { … } config object in that text." };

  const parsed =
    tryJson(objText) ?? tryJson(looseToJson(objText)) ?? tryEval(objText);
  if (!parsed) return { ok: false, error: "That doesn't look like a valid config object." };

  const missing = REQUIRED_KEYS.filter((k) => !parsed[k]);
  if (missing.length) {
    return {
      ok: false,
      error: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      missing,
    };
  }
  if (!parsed.databaseURL) {
    return {
      ok: false,
      error:
        "No databaseURL found. Enable Realtime Database in your Firebase project, then copy the config again.",
      missing: ["databaseURL"],
    };
  }

  return {
    ok: true,
    config: {
      apiKey: String(parsed.apiKey),
      authDomain: String(parsed.authDomain),
      databaseURL: String(parsed.databaseURL),
      projectId: String(parsed.projectId),
      appId: String(parsed.appId),
      storageBucket: parsed.storageBucket ? String(parsed.storageBucket) : undefined,
      messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId) : undefined,
      measurementId: parsed.measurementId ? String(parsed.measurementId) : undefined,
    },
  };
}

function extractObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function tryJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function looseToJson(s: string): string {
  return s
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'/g, '"')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, "$1");
}

function tryEval(s: string): Record<string, unknown> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const v = new Function(`"use strict"; return (${s});`)();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
