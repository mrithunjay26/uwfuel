"use client";

import { cn } from "@/lib/utils/cn";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

export function ChatBubble({ role, content, timestamp, isStreaming }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mr-2.5 mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[14px]">
          🤖
        </div>
      )}

      <div className={cn("max-w-[80%]", isUser ? "items-end" : "items-start", "flex flex-col gap-1")}>
        <div
          className={cn(
            "rounded-[18px] px-4 py-3 text-[14px] leading-relaxed",
            isUser
              ? "rounded-tr-[6px] bg-accent text-accent-contrast"
              : "rounded-tl-[6px] bg-surface text-ink shadow-[var(--shadow-sm)]",
          )}
        >
          {isStreaming ? (
            <TypingDots />
          ) : (
            <FormattedMessage content={content} />
          )}
        </div>
        {timestamp && (
          <span className="px-1 text-[10px] text-ink-faint">
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <p key={li} className={li > 0 ? "mt-1.5" : ""}>
          {parseBold(line)}
        </p>
      ))}
    </>
  );
}

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-ink-soft"
          style={{ animation: `uw-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes uw-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </span>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch { return ""; }
}
