import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-line bg-surface p-4 shadow-[var(--shadow-md)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function NoteCard({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[18px] bg-accent-soft p-3.5 text-[13px] text-accent-ink", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
