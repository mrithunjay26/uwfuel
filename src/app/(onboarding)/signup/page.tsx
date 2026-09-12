"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { authErrorMessage, isEmailTakenError, useAuth } from "@/lib/auth/AuthContext";
import { haptic } from "@/lib/utils/haptics";

interface Account { name: string; email: string; password: string; confirm: string }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();
  const [account, setAccount] = useState<Account>({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  function set<K extends keyof Account>(key: K, value: string) {
    setAccount((prev) => ({ ...prev, [key]: value }));
    if (key === "email") setTaken(null);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setTaken(null);
    if (!account.name.trim()) return setError("What should we call you?");
    if (!EMAIL_RE.test(account.email.trim())) return setError("That email address isn't valid.");
    if (account.password.length < 6) return setError("Use at least 6 characters.");
    if (account.password !== account.confirm) return setError("Those passwords don't match.");
    setBusy(true);
    try {
      await signUp(account.name.trim(), account.email.trim(), account.password);
      haptic("success");
      router.replace("/verify-email");
    } catch (cause) {
      if (isEmailTakenError(cause)) setTaken(account.email.trim());
      else setError(authErrorMessage(cause));
      haptic("error");
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      haptic("success");
      router.replace("/setup");
    } catch (cause) {
      setError(authErrorMessage(cause));
      haptic("error");
      setGoogleBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-safe">
      <OnboardingHeader onBack={() => router.push("/welcome")} />
      <h1 className="mt-6 font-display text-[26px] font-extrabold text-ink">Create your account</h1>
      <p className="mt-1.5 text-[13px] text-ink-soft">Takes about a minute. We&apos;ll email you a link to confirm it&apos;s you.</p>

      <form onSubmit={handleCreate} className="mt-7 flex flex-col gap-4">
        <TextField label="Full name" autoComplete="name" placeholder="Husky Student" value={account.name} onChange={(event) => set("name", event.target.value)} />
        <TextField label="Email" type="email" autoComplete="email" placeholder="you@uw.edu" value={account.email} onChange={(event) => set("email", event.target.value)} />
        <TextField label="Password" type="password" autoComplete="new-password" placeholder="6+ characters" value={account.password} onChange={(event) => set("password", event.target.value)} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" value={account.confirm} onChange={(event) => set("confirm", event.target.value)} />

        {taken && (
          <div className="rounded-[12px] border border-accent/30 bg-accent-soft px-3.5 py-3">
            <p className="text-[13px] font-bold text-ink">You already have an account</p>
            <p className="mt-0.5 text-[12px] text-ink-soft">{taken} is already signed up. Log in instead.</p>
            <button
              type="button"
              onClick={() => router.push(`/login?email=${encodeURIComponent(taken)}`)}
              className="press mt-2 w-full rounded-[10px] bg-accent py-2 text-[13px] font-bold text-accent-contrast"
            >
              Go to log in
            </button>
          </div>
        )}
        {error && <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger">{error}</p>}

        <Button type="submit" full size="lg" loading={busy}>Create account</Button>
        <div className="flex items-center gap-3 text-[12px] text-ink-faint"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>
        <Button type="button" variant="secondary" full size="lg" loading={googleBusy} onClick={handleGoogle}><GoogleIcon className="size-[18px]" /> Continue with Google</Button>
      </form>

      <div className="flex-1" />
      <p className="mt-8 text-center text-[13px] text-ink-faint">
        Already have an account?{" "}
        <button onClick={() => router.push("/login")} className="font-semibold text-accent-ink">Log in</button>
      </p>
    </div>
  );
}
