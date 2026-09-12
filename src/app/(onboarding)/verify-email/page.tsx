"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { authErrorMessage, useAuth } from "@/lib/auth/AuthContext";
import { haptic } from "@/lib/utils/haptics";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, loading, needsVerification, sendVerification, refreshUser, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!needsVerification) router.replace("/setup");
  }, [loading, user, needsVerification, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const check = useCallback(async () => {
    const ok = await refreshUser();
    if (ok) {
      haptic("success");
      router.replace("/setup");
    }
    return ok;
  }, [refreshUser, router]);

  useEffect(() => {
    const id = setInterval(() => { void check(); }, 5000);
    return () => clearInterval(id);
  }, [check]);

  async function handleResend() {
    setError(null);
    try {
      await sendVerification();
      setSent(true);
      setCooldown(30);
      haptic("success");
    } catch (cause) {
      setError(authErrorMessage(cause));
      haptic("error");
    }
  }

  async function handleCheck() {
    setChecking(true);
    setError(null);
    const ok = await check();
    setChecking(false);
    if (!ok) {
      setError("Still not verified. Open the link in the email, then tap this again.");
      haptic("error");
    }
  }

  async function handleSwitch() {
    await signOut().catch(() => {});
    router.replace("/signup");
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-safe">
      <OnboardingHeader onBack={handleSwitch} />

      <span className="mt-6 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <MailCheck className="size-6" />
      </span>

      <h1 className="mt-4 font-display text-[26px] font-extrabold text-ink">Confirm your email</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
        We sent a link to <b className="font-semibold text-ink">{user?.email}</b>. Open it, then come back here.
        This page moves on by itself once you do.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {error && <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}
        {sent && !error && (
          <p className="rounded-[10px] bg-success/10 px-3 py-2 text-[13px] font-medium text-success">
            Sent. Check your inbox, and your spam folder.
          </p>
        )}

        <Button full size="lg" loading={checking} onClick={handleCheck}>
          I clicked the link
        </Button>
        <Button variant="secondary" full size="lg" disabled={cooldown > 0} onClick={handleResend}>
          <RefreshCw className="size-4" /> {cooldown > 0 ? `Resend in ${cooldown}s` : "Send it again"}
        </Button>
      </div>

      <div className="flex-1" />
      <p className="mt-8 text-center text-[13px] text-ink-faint">
        Wrong email?{" "}
        <button onClick={handleSwitch} className="font-semibold text-accent-ink">
          Start over
        </button>
      </p>
    </div>
  );
}
