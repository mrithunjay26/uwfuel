import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc.v1.";

function encryptionKey(): Buffer | null {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw.trim(), "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function encryptionReady(): boolean {
  return encryptionKey() !== null;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function seal(plain: string, uid: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("No encryption key configured.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(uid, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function open(sealed: string, uid: string): string {
  if (!isSealed(sealed)) return sealed;
  const key = encryptionKey();
  if (!key) throw new Error("No encryption key configured.");
  const raw = Buffer.from(sealed.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(uid, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export async function uidFromIdToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_DINING_API_KEY;
  if (!apiKey || !idToken) return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: { localId?: string }[] };
    const uid = data.users?.[0]?.localId;
    return typeof uid === "string" && uid.length > 0 ? uid : null;
  } catch {
    return null;
  }
}
