"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { PATHS } from "@/lib/db/paths";
import type { UserProfile } from "@/lib/db/types";

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
}

export function useUserProfile(): UseUserProfileResult {
  const handle = useUserDb();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { db, uid } = handle;
    setLoading(true);
    const unsub = onValue(ref(db, PATHS.profile(uid)), (snap) => {
      setProfile(snap.exists() ? (snap.val() as UserProfile) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [handle]);

  return { profile, loading };
}
