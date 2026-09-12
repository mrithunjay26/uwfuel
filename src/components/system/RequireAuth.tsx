"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Splash } from "@/components/system/Splash";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, needsVerification } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (needsVerification) router.replace("/verify-email");
  }, [user, loading, needsVerification, router]);

  if (loading || !user || needsVerification) return <Splash />;
  return <>{children}</>;
}
