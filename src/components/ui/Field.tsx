"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const BASE_CONTROL =
  "w-full rounded-[14px] border border-line bg-surface text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FieldShell({ label, hint, error, children, htmlFor, className }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-soft">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, trailing, className, id, type = "text", ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const isPassword = type === "password";
  const [reveal, setReveal] = useState(false);
  const resolvedType = isPassword && reveal ? "text" : type;
  const showToggle = isPassword;

  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={resolvedType}
          className={cn(
            BASE_CONTROL,
            "h-12 px-4",
            (trailing || showToggle) && "pr-12",
            error && "border-danger focus:border-danger focus:ring-danger/15",
            className,
          )}
          {...rest}
        />
        {showToggle ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-lg text-ink-faint hover:bg-surface-2 hover:text-ink-soft"
            aria-label={reveal ? "Hide" : "Show"}
          >
            {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        ) : trailing ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">{trailing}</div>
        ) : null}
      </div>
    </FieldShell>
  );
});

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, mono, className, id, rows = 4, ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cn(
          BASE_CONTROL,
          "resize-none p-4 leading-relaxed",
          mono && "font-mono text-[13px]",
          error && "border-danger focus:border-danger focus:ring-danger/15",
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
});
