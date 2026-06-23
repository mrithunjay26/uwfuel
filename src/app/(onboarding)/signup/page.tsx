"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { ConnectAIForm } from "@/components/onboarding/ConnectAIForm";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { Stepper } from "@/components/onboarding/Stepper";
import { authErrorMessage, useAuth } from "@/lib/auth/AuthContext";
import { haptic } from "@/lib/utils/haptics";

interface Account { name: string; email: string; password: string; confirm: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLES = ["Create account", "Add your AI key (optional)"];

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();

  const [step, setStep] = useState(0);
  const [account, setAccount] = useState<Account>({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  function set<K extends keyof Account>(key: K, value: string) {
    setAccount((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!account.name.trim()) return setError("Enter your name.");
    if (!EMAIL_RE.test(account.email.trim())) return setError("Enter a valid email.");
    if (account.password.length < 6) return setError("Password needs 6+ characters.");
    if (account.password !== account.confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await signUp(account.name.trim(), account.email.trim(), account.password);
      haptic("success");
      setStep(1);
    } catch (err) {
      setError(authErrorMessage(err));
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      haptic("success");
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
      haptic("error");
    } finally {
      setGoogleBusy(false);
    }
  }

  const finish = () => router.replace("/dashboard");

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-safe">
      <OnboardingHeader
        onBack={() => (step === 0 ? router.push("/welcome") : setStep(0))}
        right={<span className="text-[12px] font-medium text-ink-faint">Step {step + 1} of 2</span>}
      />

      <h1 className="mt-6 font-display text-[26px] font-extrabold text-ink">{TITLES[step]}</h1>

      <div className="mt-4">
        <Stepper step={step} total={2} />
      </div>

      <div className="mt-7">
        {step === 0 && (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <TextField
              label="Full name"
              autoComplete="name"
              placeholder="Husky Student"
              value={account.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={account.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="6+ characters"
              value={account.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={account.confirm}
              onChange={(e) => set("confirm", e.target.value)}
            />
            {error && (
              <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" full size="lg" loading={busy}>
              Create account
            </Button>
            <div className="flex items-center gap-3 text-[12px] text-ink-faint">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <Button
              type="button"
              variant="secondary"
              full
              size="lg"
              loading={googleBusy}
              onClick={handleGoogle}
            >
              <GoogleIcon className="size-[18px]" /> Continue with Google
            </Button>
          </form>
        )}

        {step === 1 && (
          <ConnectAIForm onSaved={finish} onSkip={finish} saveLabel="Finish setup" />
        )}
      </div>

      {step === 0 && (
        <>
          <div className="flex-1" />
          <p className="mt-8 text-center text-[13px] text-ink-faint">
            Already have an account?{" "}
            <button onClick={() => router.push("/login")} className="font-semibold text-accent-ink">
              Log in
            </button>
          </p>
        </>
      )}
    </div>
  );
}
