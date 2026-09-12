"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Copy, Lock, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NoteCard } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import { useConfig } from "@/lib/config/ConfigContext";
import { useAuth } from "@/lib/auth/AuthContext";
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
  const { setFirebase } = useConfig();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleTest() {
    setError(null);
    setStatus({ type: "idle" });
    const res = parseFirebaseConfig(text);
    if (!res.ok || !res.config) {
      setError(res.error ?? "That doesn't look like a firebaseConfig block.");
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

  async function handleSave() {
    setError(null);
    const res = parseFirebaseConfig(text);
    if (!res.ok || !res.config) {
      setError(res.error ?? "That doesn't look like a firebaseConfig block.");
      haptic("error");
      return;
    }
    setSaving(true);
    try {
      await setFirebase(res.config);
      haptic("success");
      setStatus({ type: "ok", msg: "Saved. Your data now lives in your own database." });
      onConnected?.(res.config);
    } catch (cause) {
      setStatus({ type: "err", msg: cause instanceof Error ? cause.message : "Couldn't save that." });
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  async function copyUid() {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
      haptic("light");
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-4">
      <NoteCard className="flex gap-2.5">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <p className="leading-relaxed">
          <b className="font-semibold">Your database details are encrypted before we store them.</b>{" "}
          Only your signed-in account can unlock them.
        </p>
      </NoteCard>

      <div className="rounded-[14px] border border-warning/30 bg-warning/10 p-3.5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-warning">
          <ShieldAlert className="size-4 shrink-0" /> Read this first
        </p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[12.5px] leading-relaxed text-ink-soft">
          <li>Your database address is not a password. Whoever has it can reach your database.</li>
          <li>What stops them is your Firebase rules. Use the locked-down rules in the guide, not test mode.</li>
          <li>Test mode lets anyone read and wipe everything. Don&apos;t leave it on.</li>
          <li>Never post your databaseURL or your account ID anywhere public.</li>
        </ul>
        <Link href={GUIDE_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-accent-ink">
          <BookOpen className="size-3.5" /> Copy the safe rules
        </Link>
      </div>

      {user?.uid && (
        <div className="rounded-[14px] border border-line bg-surface-2 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Your account ID</p>
          <p className="mt-1 break-all font-mono text-[12px] text-ink">{user.uid}</p>
          <p className="mt-1 text-[11px] text-ink-soft">The rules in the guide need this. Keep it private.</p>
          <button
            onClick={copyUid}
            className="press mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold text-ink"
          >
            <Copy className="size-3.5" /> {copied ? "Copied" : "Copy ID"}
          </button>
        </div>
      )}

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
          {status.type === "ok" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
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
        <Button full loading={saving} onClick={handleSave}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
