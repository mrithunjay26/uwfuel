import { BrandMark } from "@/components/brand/Logo";

export function Splash({ label = "Loading UW Fuel…" }: { label?: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg">
      <div className="flex animate-rise flex-col items-center gap-4">
        <BrandMark size={56} className="animate-pulse" />
        <span className="text-sm font-medium text-ink-faint">{label}</span>
      </div>
    </div>
  );
}
