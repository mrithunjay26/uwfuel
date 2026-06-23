"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { authErrorMessage, useAuth } from "@/lib/auth/AuthContext";
import { haptic } from "@/lib/utils/haptics";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "email" | "google">(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    try {
      await signIn(email.trim(), password);
      haptic("success");
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
      haptic("error");
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
      haptic("success");
      router.replace("/dashboard");
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
      <p className="mt-1.5 text-[14px] text-ink-soft">Sign in to your UW Fuel account.</p>

      <form onSubmit={handleEmail} className="mt-7 flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
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
        {error && <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}
        <Button type="submit" full size="lg" loading={busy === "email"}>
          Log in
        </Button>
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
        New here?{" "}
        <button onClick={() => router.push("/signup")} className="font-semibold text-accent-ink">
          Create an account
        </button>
      </p>
    </div>
  );
}
