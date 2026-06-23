import type { FirebaseClientConfig } from "@/lib/config/types";

export async function testFirebaseConnection(
  config: FirebaseClientConfig,
): Promise<{ ok: boolean; error?: string }> {
  const base = (config.databaseURL || "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    return { ok: false, error: "databaseURL must start with https://" };
  }
  try {
    const res = await fetch(`${base}/.json?shallow=true`, { method: "GET" });
    if (res.ok || res.status === 401 || res.status === 403) return { ok: true };
    if (res.status === 404) {
      return { ok: false, error: "That database URL wasn't found, double-check databaseURL." };
    }
    return { ok: false, error: `Database responded with ${res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach that database URL. Check it and your connection." };
  }
}
