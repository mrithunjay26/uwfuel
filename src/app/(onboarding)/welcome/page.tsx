"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Code2, Heart, KeyRound, Check } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Ring } from "@/components/ui/Ring";
import { useAuth } from "@/lib/auth/AuthContext";
import { useConfig } from "@/lib/config/ConfigContext";

const REPO_URL = "https://github.com/mrithunjay26/uwfuel";

const PROMISES: [React.ComponentType<{ className?: string }>, React.ReactNode][] = [
  [KeyRound, "Bring your own AI key for personalized plans"],
  [Heart, "100% free & open source"],
];

export default function WelcomePage() {
  const router = useRouter();
  const { ready } = useConfig();
  const { user } = useAuth();

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-safe">
      <div className="flex items-center justify-between pt-7">
        <div className="flex items-center gap-2.5">
          <BrandMark size={34} />
          <Wordmark />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[11px] font-bold text-accent-ink">
          <span className="size-1.5 rounded-full bg-accent" /> open source
        </span>
      </div>

      <div className="relative mt-7 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-hero-from to-hero-to text-white shadow-[var(--shadow-hero)]">
        <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 size-44 rounded-full bg-white/10" />
        <div className="flex items-center gap-5 px-6">
          <Ring size={104} stroke={10} value={0.68} color="#fff" track="rgba(255,255,255,0.25)">
            <div className="leading-none">
              <div className="font-display text-2xl font-extrabold">1260</div>
              <div className="mt-0.5 text-[10px] font-medium text-white/70">kcal left</div>
            </div>
          </Ring>
          <div className="flex flex-col gap-2">
            {[
              ["Protein", "79g", "bg-protein"],
              ["Carbs", "196g", "bg-carbs"],
              ["Fat", "52g", "bg-fat"],
            ].map(([name, val, bar]) => (
              <div key={name as string} className="w-28">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-white/80">{name}</span>
                  <span className="text-white/60">{val}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className={`h-full w-2/3 rounded-full ${bar}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h1 className="mt-7 font-display text-[27px] font-extrabold leading-[1.1] text-ink">
        Meal &amp; macro planning,
        <br />
        built for UW students.
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
        Track campus dining, macros &amp; budget, powered by an AI you control. No shared server.
      </p>

      <ul className="mt-6 flex flex-col gap-3.5">
        {PROMISES.map(([Icon, label], i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint-soft text-carbs">
              <Check className="size-4" strokeWidth={3} />
            </span>
            <span className="flex items-center gap-2 text-[14px] text-ink-soft">
              <Icon className="size-4 text-accent" />
              {label}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex-1" />

      <div className="mt-8 flex flex-col gap-2.5">
        <Button size="lg" full onClick={() => router.push("/signup")}>
          Create account
        </Button>
        <Button size="lg" variant="secondary" full onClick={() => router.push("/login")}>
          I already have an account
        </Button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="mx-auto mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink-soft"
        >
          <Code2 className="size-3.5" /> View source on GitHub
        </a>
      </div>
    </div>
  );
}
