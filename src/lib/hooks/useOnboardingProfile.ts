"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { OnboardingProfile } from "@/lib/db/types";
import { normalizeDietarySafetyProfile } from "@/lib/dietary/safety";

function normalizeProfile(value: OnboardingProfile): OnboardingProfile {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...value,
    dining_wallet: {
      selection: value.dining_wallet?.selection ?? null,
      quarter_key: value.dining_wallet?.quarter_key ?? "",
      quarter_start: value.dining_wallet?.quarter_start ?? today,
      quarter_end: value.dining_wallet?.quarter_end ?? today,
      ...(value.dining_wallet?.current_balance != null ? { current_balance: value.dining_wallet.current_balance } : {}),
      ...(value.dining_wallet?.balance_as_of ? { balance_as_of: value.dining_wallet.balance_as_of } : {}),
    },
    personal_wallet: {
      monthly_budget: value.personal_wallet?.monthly_budget ?? 0,
      cycle_day: value.personal_wallet?.cycle_day ?? 1,
      ...(value.personal_wallet?.grocery_target != null ? { grocery_target: value.personal_wallet.grocery_target } : {}),
    },
    cooking: {
      kitchen_access: value.cooking?.kitchen_access ?? "none",
      cooked_meals_per_week: value.cooking?.cooked_meals_per_week ?? 0,
    },
    dietary: normalizeDietarySafetyProfile(value.dietary) ?? {
      styles: [], allergens: [], hard_exclusions: [], dislikes: [],
      cross_contact_sensitive: false, allow_unknown: true,
    },
  };
}

export function useOnboardingProfile(): { profile: OnboardingProfile | null; loading: boolean } {
  const handle = useUserDb();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { queueMicrotask(() => { setProfile(null); setLoading(false); }); return; }
    return onValue(ref(handle.db, PATHS.onboardingProfile(handle.uid)), (snap) => {
      setProfile(snap.exists() ? normalizeProfile(snap.val() as OnboardingProfile) : null);
      setLoading(false);
    });
  }, [handle]);

  return { profile, loading };
}
