import type { FirebaseClientConfig } from "./types";

const PREFIX = "uwfuel";

function allConfigKeys(uid: string): string[] {
  const pending = "__pending__";
  return [
    `${PREFIX}.cohereKey.${uid}`,
    `${PREFIX}.firebaseConfig.${uid}`,
    `${PREFIX}.dailyBudget.${uid}`,
    `${PREFIX}.showWorkout.${uid}`,
    `${PREFIX}.cohereKey.${pending}`,
    `${PREFIX}.firebaseConfig.${pending}`,
    `${PREFIX}.cohereKey`,
    `${PREFIX}.firebaseConfig`,
    `${PREFIX}.dailyBudget`,
    `${PREFIX}_daily_budget`,
  ];
}

function ls(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export interface LegacyLocalConfig {
  cohereKey: string | null;
  firebase: FirebaseClientConfig | null;
  dailyBudget: number | null;
  showWorkoutTabs: boolean | null;
}

export function readLegacyLocalConfig(uid: string): LegacyLocalConfig {
  const store = ls();
  const out: LegacyLocalConfig = {
    cohereKey: null,
    firebase: null,
    dailyBudget: null,
    showWorkoutTabs: null,
  };
  if (!store) return out;

  const firstString = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = store.getItem(k);
      if (v) return v;
    }
    return null;
  };

  out.cohereKey = firstString(
    `${PREFIX}.cohereKey.${uid}`,
    `${PREFIX}.cohereKey.__pending__`,
    `${PREFIX}.cohereKey`,
  );

  const fbRaw = firstString(
    `${PREFIX}.firebaseConfig.${uid}`,
    `${PREFIX}.firebaseConfig.__pending__`,
    `${PREFIX}.firebaseConfig`,
  );
  if (fbRaw) {
    try { out.firebase = JSON.parse(fbRaw) as FirebaseClientConfig; } catch {}
  }

  const budgetRaw = firstString(
    `${PREFIX}.dailyBudget.${uid}`,
    `${PREFIX}.dailyBudget`,
    `${PREFIX}_daily_budget`,
  );
  if (budgetRaw) {
    const n = parseFloat(budgetRaw);
    if (!isNaN(n) && n > 0) out.dailyBudget = n;
  }

  const showRaw = store.getItem(`${PREFIX}.showWorkout.${uid}`);
  if (showRaw !== null) out.showWorkoutTabs = showRaw === "1";

  return out;
}

export function purgeAllLocalConfig(uid: string): void {
  const store = ls();
  if (!store) return;
  for (const k of allConfigKeys(uid)) {
    try { store.removeItem(k); } catch {}
  }
}
