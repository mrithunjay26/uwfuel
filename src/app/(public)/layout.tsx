import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuroraField } from "@/components/app/AuroraField";
import { ThemeToggle } from "@/components/system/ThemeToggle";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full">
      <AuroraField />

      <header className="glass-nav sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-5 md:px-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-xl bg-accent text-[13px] font-extrabold text-accent-contrast">U</span>
            <span className="font-display text-[15px] font-extrabold text-ink">UW Fuel</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="press flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1.5 text-[12px] font-bold text-ink-soft backdrop-blur-md"
            >
              <ArrowLeft className="size-3.5" /> Back to app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-7 md:px-8 md:pt-10">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-3xl px-5 pb-[max(env(safe-area-inset-bottom),24px)] md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line pt-5 text-[12px] font-semibold text-ink-soft">
          <Link href="/guide" className="hover:text-ink">Setup guide</Link>
          <span className="text-line-strong">·</span>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <span className="text-line-strong">·</span>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <span className="text-line-strong">·</span>
          <span className="text-ink-faint">UW Fuel, a student project</span>
        </div>
      </footer>
    </div>
  );
}
