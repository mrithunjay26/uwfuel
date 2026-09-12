"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Splash } from "@/components/system/Splash";
import { Landing } from "@/components/landing/Landing";
import { readStoredCustomize } from "@/lib/customize/CustomizeContext";
import { startPagePath } from "@/lib/customize/homeSections";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace(startPagePath(readStoredCustomize().startPage));
  }, [loading, user, router]);

  if (loading) return <Splash />;
  if (user) return <Splash />;
  return <Landing />;
}
