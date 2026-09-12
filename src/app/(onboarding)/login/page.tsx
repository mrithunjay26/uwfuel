"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { authErrorMessage, useAuth } from "@/lib/auth/AuthContext";
import { readStoredCustomize } from "@/lib/customize/CustomizeContext";
import { startPagePath } from "@/lib/customize/homeSections";
import { haptic } from "@/lib/utils/haptics";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, needsVerification, signIn, signInWithGoogle, sendReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "email" | "google" | "reset">(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("email");
    if (prefill) setEmail(prefill);
    if (params.get("verified") === "1") setNotice("Email confirmed. Log in to get started.");
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (needsVerification) router.replace("/verify-email");
    else router.replace(startPagePath(readStoredCustomize().startPage));
  }, [loading, user, needsVerification, router]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("email");
    try {
      const signedIn = await signIn(email.trim(), password);
      haptic("success");
      if (!signedIn.emailVerified) router.replace("/verify-email");
      else router.replace(startPagePath(readStoredCustomize().startPage));
    } catch (err) {
      setError(authErrorMessage(err));
      haptic("error");
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setNotice(null);
    setBusy("google");
    try {
      await signInWithGoogle();
      haptic("success");
      router.replace(startPagePath(readStoredCustomize().startPage));
    } catch (err) {
      setError(authErrorMessage(err));
      haptic("error");
    } finally {
      setBusy(null);
    }
  }

  async function handleReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Type your email first, then tap this.");
      return;
    }
    setBusy("reset");
    try {
      await sendReset(email.trim());
      setNotice("Password reset link sent. Check your email.");
      haptic("success");
    } catch (err) {
      setError(authErrorMessage(err));
      haptic("error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-safe">
      <OnboardingHeader onBack={() => router.push("/welcome")} />

      <h1 className="mt-6 font-display text-[26px] font-extrabold text-ink">Welcome back</h1>
      <p className="mt-1.5 text-[14px] text-ink-soft">Log in to UW Fuel.</p>

      <form onSubmit={handleEmail} className="mt-7 flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@uw.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {notice && <p className="rounded-[10px] bg-success/10 px-3 py-2 text-[13px] font-medium text-success">{notice}</p>}
        {error && <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}
        <Button type="submit" full size="lg" loading={busy === "email"}>
          Log in
        </Button>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy === "reset"}
          className="self-center text-[13px] font-semibold text-accent-ink disabled:opacity-60"
        >
          Forgot your password?
        </button>
        <div className="flex items-center gap-3 text-[12px] text-ink-faint">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <Button
          type="button"
          variant="secondary"
          full
          size="lg"
          loading={busy === "google"}
          onClick={handleGoogle}
        >
          <GoogleIcon className="size-[18px]" /> Continue with Google
        </Button>
      </form>

      <div className="flex-1" />
      <p className="mt-8 text-center text-[13px] text-ink-faint">
        No account yet?{" "}
        <button onClick={() => router.push("/signup")} className="font-semibold text-accent-ink">
          Sign up
        </button>
      </p>
    </div>
  );
}
