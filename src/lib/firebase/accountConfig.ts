import { get, onValue, ref, update } from "firebase/database";
import { getDiningDb } from "@/lib/firebase/diningApp";
import type { FirebaseClientConfig } from "@/lib/config/types";
import type { Customize } from "@/lib/customize/types";

export interface AccountConfig {
  cohereKey: string | null;
  groqKey: string | null;
  firebase: FirebaseClientConfig | null;
  dailyBudget: number;
  showWorkoutTabs: boolean;
  remindersOn: boolean;
}

export const DEFAULT_DAILY_BUDGET = 37;

const accountPath = (uid: string) => `users/${uid}/account`;

export function defaultAccountConfig(): AccountConfig {
  return {
    cohereKey: null,
    groqKey: null,
    firebase: null,
    dailyBudget: DEFAULT_DAILY_BUDGET,
    showWorkoutTabs: true,
    remindersOn: false,
  };
}

function parseAccount(raw: unknown): AccountConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fb = v.firebase_config;
  return {
    cohereKey: typeof v.cohere_key === "string" && v.cohere_key ? v.cohere_key : null,
    groqKey: typeof v.groq_key === "string" && v.groq_key ? v.groq_key : null,
    firebase:
      fb && typeof fb === "object" && typeof (fb as Record<string, unknown>).databaseURL === "string"
        ? (fb as unknown as FirebaseClientConfig)
        : null,
    dailyBudget:
      typeof v.daily_budget === "number" && v.daily_budget > 0
        ? v.daily_budget
        : DEFAULT_DAILY_BUDGET,
    showWorkoutTabs: typeof v.show_workout_tabs === "boolean" ? v.show_workout_tabs : true,
    remindersOn: typeof v.reminders_on === "boolean" ? v.reminders_on : false,
  };
}

export function subscribeAccountConfig(
  uid: string,
  cb: (cfg: AccountConfig) => void,
): () => void {
  const r = ref(getDiningDb(), accountPath(uid));
  return onValue(r, (snap) => cb(parseAccount(snap.val())));
}

export async function getAccountConfigOnce(uid: string): Promise<AccountConfig> {
  const snap = await get(ref(getDiningDb(), accountPath(uid)));
  return parseAccount(snap.exists() ? snap.val() : {});
}

function cleanFirebaseConfig(cfg: FirebaseClientConfig | null): Record<string, string> | null {
  if (!cfg) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}

export async function writeCohereKey(uid: string, key: string | null): Promise<void> {
  await update(ref(getDiningDb(), accountPath(uid)), { cohere_key: key ?? null });
}

export async function writeGroqKey(uid: string, key: string | null): Promise<void> {
  await update(ref(getDiningDb(), accountPath(uid)), { groq_key: key ?? null });
}

export async function writeFirebaseConfig(
  uid: string,
  cfg: FirebaseClientConfig | null,
): Promise<void> {
  await update(ref(getDiningDb(), accountPath(uid)), { firebase_config: cleanFirebaseConfig(cfg) });
}

export async function writeDailyBudget(uid: string, value: number): Promise<void> {
  if (!(value > 0)) return;
  await update(ref(getDiningDb(), accountPath(uid)), { daily_budget: value });
}

export async function writeShowWorkoutTabs(uid: string, show: boolean): Promise<void> {
  await update(ref(getDiningDb(), accountPath(uid)), { show_workout_tabs: show });
}

export async function writeRemindersOn(uid: string, on: boolean): Promise<void> {
  await update(ref(getDiningDb(), accountPath(uid)), { reminders_on: on });
}

const customizePath = (uid: string) => `${accountPath(uid)}/customize`;

export function subscribeCustomize(
  uid: string,
  cb: (raw: Record<string, unknown> | null) => void,
): () => void {
  const r = ref(getDiningDb(), customizePath(uid));
  return onValue(r, (snap) =>
    cb(snap.exists() && typeof snap.val() === "object" ? (snap.val() as Record<string, unknown>) : null),
  );
}

export async function writeCustomize(uid: string, customize: Customize): Promise<void> {
  await update(ref(getDiningDb(), accountPath(uid)), { customize });
}

export async function writeAccountFields(
  uid: string,
  fields: Partial<{
    cohere_key: string | null;
    groq_key: string | null;
    firebase_config: FirebaseClientConfig | null;
    daily_budget: number;
    show_workout_tabs: boolean;
    reminders_on: boolean;
  }>,
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const payload: Record<string, unknown> = { ...fields };
  if ("firebase_config" in payload) {
    payload.firebase_config = cleanFirebaseConfig(fields.firebase_config ?? null);
  }
  await update(ref(getDiningDb(), accountPath(uid)), payload);
}
