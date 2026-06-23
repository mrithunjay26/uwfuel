import { Hammer } from "lucide-react";

export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 grid place-items-center rounded-[22px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Hammer className="size-6" />
      </span>
      <p className="mt-3 font-display text-[16px] font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[260px] text-[13px] text-ink-soft">{body}</p>
    </div>
  );
}
