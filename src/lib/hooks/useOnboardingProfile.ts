"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { OnboardingProfile } from "@/lib/db/types";

export function useOnboardingProfile(): { profile: OnboardingProfile | null; loading: boolean } {
  const handle = useUserDb();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) { queueMicrotask(() => { setProfile(null); setLoading(false); }); return; }
    return onValue(ref(handle.db, PATHS.onboardingProfile(handle.uid)), (snap) => {
      setProfile(snap.exists() ? snap.val() as OnboardingProfile : null);
      setLoading(false);
    });
  }, [handle]);

  return { profile, loading };
}
