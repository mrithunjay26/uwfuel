"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NoteCard } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import { useConfig } from "@/lib/config/ConfigContext";
import type { FirebaseClientConfig } from "@/lib/config/types";
import { parseFirebaseConfig } from "@/lib/config/parse";
import { testFirebaseConnection } from "@/lib/firebase/test";
import { haptic } from "@/lib/utils/haptics";

const PLACEHOLDER = `const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "your-app.firebaseapp.com",
  databaseURL: "https://your-app-default-rtdb.firebaseio.com",
  projectId: "your-app",
  appId: "1:…:web:…"
};`;

const GUIDE_URL = "/guide#database";

type Status = { type: "idle" | "ok" | "err"; msg?: string };

export function ConnectDatabaseForm({
  onConnected,
  ctaLabel = "Save & continue",
}: {
  onConnected?: (config: FirebaseClientConfig) => void;
  ctaLabel?: string;
}) {
  const _config = useConfig(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const setFirebase = (_cfg: FirebaseClientConfig) => {};
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setError(null);
    setStatus({ type: "idle" });
    const res = parseFirebaseConfig(text);
    if (!res.ok || !res.config) {
      setError(res.error ?? "Invalid config.");
      haptic("error");
      return;
    }
    setTesting(true);
    const conn = await testFirebaseConnection(res.config);
    setTesting(false);
    if (conn.ok) {
      setStatus({ type: "ok", msg: "Connected. Your database is reachable." });
      haptic("success");
    } else {
      setStatus({ type: "err", msg: conn.error });
      haptic("error");
    }
  }

  function handleSave() {
    setError(null);
    const res = parseFirebaseConfig(text);
    if (!res.ok || !res.config) {
      setError(res.error ?? "Invalid config.");
      haptic("error");
      return;
    }
    setFirebase(res.config);
    haptic("success");
    onConnected?.(res.config);
  }

  return (
    <div className="flex flex-col gap-4">
      <NoteCard className="flex gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p className="leading-relaxed">
          <b className="font-semibold">Paste your own Firebase config.</b> It stays on this device
          and in your project. We can&apos;t read it.
        </p>
      </NoteCard>

      <TextArea
        label="Paste firebaseConfig"
        mono
        rows={7}
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={error ?? undefined}
      />

      {status.type !== "idle" && (
        <div
          className={`flex items-center gap-2 text-[13px] font-medium ${
            status.type === "ok" ? "text-success" : "text-danger"
          }`}
        >
          {status.type === "ok" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <XCircle className="size-4" />
          )}
          {status.msg}
        </div>
      )}

      <div className="flex items-center justify-between text-[13px] text-ink-faint">
        <span>Don&apos;t have one yet?</span>
        <Link
          href={GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-accent-ink"
        >
          <BookOpen className="size-3.5" /> Database setup guide
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button variant="secondary" full loading={testing} onClick={handleTest}>
          Test connection
        </Button>
        <Button full onClick={handleSave}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
