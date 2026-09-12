"use client";

import { useState } from "react";
import { CheckCircle2, Key, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NoteCard } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { useConfig } from "@/lib/config/ConfigContext";
import { testCohereKey } from "@/lib/ai/cohere";
import { haptic } from "@/lib/utils/haptics";

type Provider = "cohere";

const PROVIDERS: Record<Provider, {
  label: string;
  placeholder: string;
  url: string;
  getHint: string;
  test: (key: string) => Promise<{ ok: boolean; error?: string }>;
  note: React.ReactNode;
}> = {
  cohere: {
    label: "Cohere API key",
    placeholder: "Paste your Cohere key",
    url: "https://dashboard.cohere.com/api-keys",
    getHint: "Free key from cohere.com",
    test: testCohereKey,
    note: (
      <>The AI coach and meal scanner use <b className="font-semibold">your own Cohere key</b>. You
      control usage and billing, with no shared quota.</>
    ),
  },
};

type Status = { type: "idle" | "ok" | "err"; msg?: string };

export function ConnectAIForm({
  provider = "cohere",
  onSaved,
  onSkip,
  saveLabel = "Finish setup",
  allowSkip = true,
}: {
  provider?: Provider;
  onSaved?: () => void;
  onSkip?: () => void;
  saveLabel?: string;
  allowSkip?: boolean;
}) {
  const cfg = PROVIDERS[provider];
  const { setCohereKey } = useConfig();
  const setKeyFor = setCohereKey;
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleTest() {
    setStatus({ type: "idle" });
    setTesting(true);
    const res = await cfg.test(key);
    setTesting(false);
    if (res.ok) {
      setStatus({ type: "ok", msg: "Key works." });
      haptic("success");
    } else {
      setStatus({ type: "err", msg: res.error });
      haptic("error");
    }
  }

  async function handleSave() {
    if (!key.trim()) {
      onSaved?.();
      return;
    }
    setSaving(true);
    try {
      await setKeyFor(key.trim());
      haptic("success");
      onSaved?.();
    } catch (cause) {
      setStatus({ type: "err", msg: cause instanceof Error ? cause.message : "Couldn't save that key." });
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NoteCard className="flex gap-2.5">
        <Sparkles className="mt-0.5 size-4 shrink-0" />
        <p className="leading-relaxed">{cfg.note}</p>
      </NoteCard>

      <TextField
        label={cfg.label}
        type="password"
        placeholder={cfg.placeholder}
        autoComplete="off"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />

      {status.type !== "idle" && (
        <div
          className={`flex items-center gap-2 text-[13px] font-medium ${
            status.type === "ok" ? "text-success" : "text-danger"
          }`}
        >
          {status.type === "ok" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {status.msg}
        </div>
      )}

      <div className="flex items-center justify-between text-[13px] text-ink-faint">
        <span>{cfg.getHint}</span>
        <a
          href={cfg.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-accent-ink"
        >
          <Key className="size-3.5" /> Get a key
        </a>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button variant="secondary" full loading={testing} onClick={handleTest} disabled={!key.trim()}>
          Test key
        </Button>
        <Button full loading={saving} onClick={handleSave}>
          {saveLabel}
        </Button>
        {allowSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mx-auto text-[13px] font-medium text-ink-faint hover:text-ink-soft"
          >
            Skip for now, add later in Settings
          </button>
        )}
      </div>
    </div>
  );
}
