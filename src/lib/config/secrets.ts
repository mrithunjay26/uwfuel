import { getSharedAuth } from "@/lib/firebase/userApp";

const PREFIX = "enc.v1.";

export function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

async function callSecure(
  mode: "seal" | "open",
  values: Record<string, string | null>,
): Promise<Record<string, string | null>> {
  const user = getSharedAuth().currentUser;
  if (!user) throw new Error("Log in again to save this.");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/secure/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, idToken, values }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    values?: Record<string, string | null>;
    error?: string;
  };
  if (!res.ok || !data.values) throw new Error(data.error || "Couldn't secure your settings.");
  return data.values;
}

export function sealSecrets(values: Record<string, string | null>) {
  return callSecure("seal", values);
}

export function openSecrets(values: Record<string, string | null>) {
  return callSecure("open", values);
}
