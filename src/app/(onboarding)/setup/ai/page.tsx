"use client";

import { useRouter } from "next/navigation";
import { ConnectAIForm } from "@/components/onboarding/ConnectAIForm";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";

export default function SetupAIPage() {
  const router = useRouter();
  const back = () => router.push("/profile");
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-safe">
      <OnboardingHeader onBack={back} />
      <h1 className="mt-6 font-display text-[26px] font-extrabold text-ink">Add your AI key</h1>
      <p className="mt-1.5 text-[14px] text-ink-soft">
        Powers the chatbot, meal planner, and the camera meal scanner with your own Cohere key.
      </p>
      <div className="mt-7">
        <ConnectAIForm saveLabel="Save AI key" onSaved={back} onSkip={back} />
      </div>
      <p className="mt-5 rounded-[14px] bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
        Tip: for a <b className="text-ink">free</b> scanner backup that works even when Cohere is
        busy, add a Groq key in <b className="text-ink">Settings → Meal scanner key</b>. Grab one free
        at <span className="font-semibold text-accent-ink">console.groq.com/keys</span>.
      </p>
    </div>
  );
}
