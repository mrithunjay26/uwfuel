import { AuroraField } from "@/components/app/AuroraField";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full">
      <AuroraField />
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col">{children}</div>
    </div>
  );
}
