"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useConfig } from "@/lib/config/ConfigContext";
import { getUserFirebase } from "@/lib/firebase/userApp";
import type { Database } from "firebase/database";

interface UserDbHandle {
  db: Database;
  uid: string;
}

export function useUserDb(): UserDbHandle | null {
  const { user } = useAuth();
  const { firebase, ready } = useConfig();

  const personalUrl = firebase?.databaseURL ?? null;

  return useMemo(() => {
    if (!user || !ready) return null;
    return { db: getUserFirebase(user.uid, firebase).db, uid: user.uid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, personalUrl]);
}
