"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { logWorkout } from "@/lib/db/userDb";
import { parseFitNotesCsv, type FitNotesImportResult } from "@/lib/workout/fitnotesImport";
import { Portal } from "@/components/ui/Portal";
import { haptic } from "@/lib/utils/haptics";

type Phase = "pick" | "preview" | "importing" | "done";

export function FitNotesImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const handle = useUserDb();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [parsed, setParsed] = useState<FitNotesImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  if (!open) return null;

  function reset() { setPhase("pick"); setParsed(null); setError(null); setProgress(0); }
  function close() { reset(); onClose(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const result = parseFitNotesCsv(text);
      if (result.logs.length === 0) {
        setError("No workouts found. Make sure this is a FitNotes CSV export.");
        return;
      }
      setParsed(result);
      setPhase("preview");
      haptic("light");
    } catch {
      setError("Couldn't read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runImport() {
    if (!handle || !parsed) return;
    setPhase("importing");
    setProgress(0);
    let done = 0;
    try {
      for (const log of parsed.logs) {
        await logWorkout(handle.db, handle.uid, log);
        done++;
        setProgress(Math.round((done / parsed.logs.length) * 100));
      }
      haptic("success");
      setPhase("done");
    } catch {
      setError("Import failed partway. Check your connection and try again.");
      setPhase("preview");
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[75] flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div className="animate-rise relative mt-auto flex max-h-[92dvh] flex-col rounded-t-[26px] border-t border-line bg-bg px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[17px] font-extrabold text-ink">Import from FitNotes</h2>
          <button onClick={close} aria-label="Close" className="grid size-9 place-items-center rounded-full text-ink-soft"><X className="size-5" /></button>
        </div>

        {phase === "pick" && (
          <div className="mt-4">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              In FitNotes: <b className="text-ink">Settings → Export Data → CSV</b>, then choose that file here.
              Each set becomes a logged set, grouped into a workout per day.
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="press mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3.5 text-[14px] font-bold text-accent-contrast"
            >
              <Upload className="size-4" /> Choose FitNotes CSV
            </button>
            {error && <p className="mt-3 text-[12px] font-semibold text-danger">{error}</p>}
          </div>
        )}

        {phase === "preview" && parsed && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-2">
              {[["Days", parsed.dayCount], ["Exercises", parsed.exerciseCount], ["Sets", parsed.rowCount]].map(([label, val]) => (
                <div key={label} className="glass-panel rounded-[14px] px-2 py-3 text-center">
                  <p className="font-display text-[20px] font-extrabold text-ink">{val}</p>
                  <p className="text-[10px] font-semibold text-ink-soft">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
              This adds {parsed.dayCount} workout{parsed.dayCount === 1 ? "" : "s"} to your log. It won&apos;t remove anything —
              re-importing the same file will create duplicates.
            </p>
            <button onClick={runImport} disabled={!handle} className="press mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3.5 text-[14px] font-bold text-accent-contrast disabled:opacity-50">
              <Upload className="size-4" /> Import {parsed.dayCount} workouts
            </button>
            <button onClick={reset} className="press mt-2 w-full rounded-[14px] bg-surface-2 py-2.5 text-[13px] font-bold text-ink-soft">Choose a different file</button>
            {error && <p className="mt-3 text-[12px] font-semibold text-danger">{error}</p>}
          </div>
        )}

        {phase === "importing" && (
          <div className="mt-6 flex flex-col items-center py-6">
            <Loader2 className="size-7 animate-spin text-accent" />
            <p className="mt-3 text-[13px] font-semibold text-ink-soft">Importing… {progress}%</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {phase === "done" && parsed && (
          <div className="mt-6 flex flex-col items-center py-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success"><Check className="size-6" /></span>
            <p className="mt-3 text-[15px] font-extrabold text-ink">Imported {parsed.dayCount} workouts</p>
            <p className="mt-1 text-[12px] text-ink-soft">Find them in Log → Calendar.</p>
            <button onClick={close} className="press mt-5 w-full rounded-[14px] bg-accent py-3 text-[14px] font-bold text-accent-contrast">Done</button>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}
