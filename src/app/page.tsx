"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Splash } from "@/components/system/Splash";
import { Landing } from "@/components/landing/Landing";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading) return <Splash />;
  if (user) return <Splash />;
  return <Landing />;
}
