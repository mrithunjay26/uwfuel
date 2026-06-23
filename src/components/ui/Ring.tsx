import { cn } from "@/lib/utils/cn";

interface RingProps {
  size?: number;
  stroke?: number;
  value?: number;
  color?: string;
  track?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Ring({
  size = 96,
  stroke = 9,
  value = 0,
  color = "var(--accent)",
  track = "color-mix(in srgb, currentColor 16%, transparent)",
  className,
  children,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.7,0.3,1)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}
