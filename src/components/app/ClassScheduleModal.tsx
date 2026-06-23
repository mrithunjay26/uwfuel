"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Plus, Route, Trash2, X } from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { saveClassSchedule } from "@/lib/db/userDb";
import { ClassLocationPicker } from "@/components/app/ClassLocationPicker";
import { DayRouteMap, type DayRoutePoint } from "@/components/app/DayRouteMap";
import type { ClassSchedule, ClassStop, Weekday } from "@/lib/db/types";

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "monday",    label: "Mon" },
  { key: "tuesday",   label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday",  label: "Thu" },
  { key: "friday",    label: "Fri" },
  { key: "saturday",  label: "Sat" },
  { key: "sunday",    label: "Sun" },
];

interface ClassScheduleModalProps {
  open:    boolean;
  initial: ClassSchedule | null;
  onClose: () => void;
}

interface DraftStop {
  id:             string;
  building_label: string;
  start_time:     string;
  end_time:       string;
  lat:            number | null;
  lng:            number | null;
}

function newStop(): DraftStop {
  return {
    id: crypto.randomUUID(),
    building_label: "",
    start_time: "09:00",
    end_time: "10:00",
    lat: null,
    lng: null,
  };
}

export function ClassScheduleModal({ open, initial, onClose }: ClassScheduleModalProps) {
  const handle = useUserDb();

  const [activeDay,    setActiveDay]    = useState<Weekday>("monday");
  const [schedule,     setSchedule]     = useState<Record<Weekday, DraftStop[]>>({
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  });
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [pinningId,    setPinningId]    = useState<string | null>(null);
  const [showDayMap,   setShowDayMap]   = useState(true);

  const dayRoutePoints = useMemo<DayRoutePoint[]>(() => {
    return schedule[activeDay]
      .filter((s) => s.lat != null && s.lng != null && s.building_label.trim())
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => ({
        lat: s.lat as number,
        lng: s.lng as number,
        label: s.building_label.trim(),
        time: `${s.start_time} to ${s.end_time}`,
      }));
  }, [schedule, activeDay]);

  useEffect(() => {
    if (!initial) return;
    const next = {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: [],
    } as Record<Weekday, DraftStop[]>;
    (Object.keys(initial) as Weekday[]).forEach((day) => {
      next[day] = (initial[day] ?? []).map((s: ClassStop) => ({
        id:             s.id || crypto.randomUUID(),
        building_label: s.building_label,
        start_time:     s.start_time,
        end_time:       s.end_time,
        lat:            s.lat ?? null,
        lng:            s.lng ?? null,
      }));
    });
    setSchedule(next);
    setPinningId(null);
  }, [initial, open]);

  function addStop() {
    setSchedule((prev) => ({
      ...prev,
      [activeDay]: [...prev[activeDay], newStop()],
    }));
  }

  function removeStop(id: string) {
    setSchedule((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].filter((s) => s.id !== id),
    }));
    if (pinningId === id) setPinningId(null);
  }

  function updateStop<K extends keyof DraftStop>(id: string, field: K, value: DraftStop[K]) {
    setSchedule((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((s) =>
        s.id === id ? { ...s, [field]: value } : s,
      ),
    }));
  }

  function setStopCoords(id: string, lat: number, lng: number) {
    setSchedule((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((s) =>
        s.id === id ? { ...s, lat, lng } : s,
      ),
    }));
  }

  function clearStopCoords(id: string) {
    setSchedule((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((s) =>
        s.id === id ? { ...s, lat: null, lng: null } : s,
      ),
    }));
  }

  async function handleSave() {
    if (!handle) return;
    setSaving(true);
    setError(null);
    try {
      const payload: ClassSchedule = {};
      (Object.keys(schedule) as Weekday[]).forEach((day) => {
        const stops = schedule[day].filter((s) => s.building_label.trim());
        if (stops.length > 0) {
          payload[day] = stops.map((s): ClassStop => ({
            id:             s.id,
            building_label: s.building_label.trim(),
            start_time:     s.start_time,
            end_time:       s.end_time,
            lat:            s.lat,
            lng:            s.lng,
            source:         "manual",
          }));
        }
      });
      await saveClassSchedule(handle.db, handle.uid, payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const stops = schedule[activeDay];

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Class schedule"
        className="glass-strong animate-rise fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5"
        style={{ maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />

        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-extrabold text-ink">Class Schedule</h2>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-surface-3 text-ink-soft"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">
          Add class stops and pin buildings on the map so the AI planner can suggest nearby dining.
        </p>

        <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
          {WEEKDAYS.map(({ key, label }) => {
            const hasStops = schedule[key].some((s) => s.building_label.trim());
            return (
              <button
                key={key}
                onClick={() => setActiveDay(key)}
                className={`relative shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-bold transition ${
                  activeDay === key
                    ? "bg-accent text-accent-contrast"
                    : "bg-surface-2 text-ink-soft"
                }`}
              >
                {label}
                {hasStops && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-success" />
                )}
              </button>
            );
          })}
        </div>

        {dayRoutePoints.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowDayMap((s) => !s)}
              className="flex w-full items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <Route className="size-4 text-accent" />
                Day route · {dayRoutePoints.length} stop{dayRoutePoints.length === 1 ? "" : "s"}
              </span>
              {showDayMap ? <ChevronUp className="size-4 text-ink-soft" /> : <ChevronDown className="size-4 text-ink-soft" />}
            </button>
            {showDayMap && (
              <>
                <div className="mt-2 overflow-hidden rounded-[14px] border border-line" style={{ height: "200px" }}>
                  <DayRouteMap points={dayRoutePoints} className="h-full w-full" />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-faint">
                  <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full border-2 border-success" /> Start</span>
                  <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full border-2 border-danger" /> End</span>
                  <span>Markers are numbered in time order.</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="thin-scrollbar mt-4 flex-1 overflow-y-auto">
          {stops.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-ink-faint">
              No classes on {WEEKDAYS.find((d) => d.key === activeDay)?.label}. Tap + to add one.
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-2">
              {stops.map((stop) => {
                const isPickerOpen = pinningId === stop.id;
                const hasPin = stop.lat != null && stop.lng != null;

                return (
                  <div key={stop.id} className="rounded-[14px] bg-surface-2 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Building / Class name"
                        value={stop.building_label}
                        onChange={(e) => updateStop(stop.id, "building_label", e.target.value)}
                        className="flex-1 rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
                      />
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <label className="flex-1">
                        <span className="text-[10px] font-semibold text-ink-soft">Start</span>
                        <input
                          type="time"
                          value={stop.start_time}
                          onChange={(e) => updateStop(stop.id, "start_time", e.target.value)}
                          className="mt-0.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <label className="flex-1">
                        <span className="text-[10px] font-semibold text-ink-soft">End</span>
                        <input
                          type="time"
                          value={stop.end_time}
                          onChange={(e) => updateStop(stop.id, "end_time", e.target.value)}
                          className="mt-0.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                        />
                      </label>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <button
                        onClick={() => setPinningId(isPickerOpen ? null : stop.id)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                          isPickerOpen
                            ? "bg-accent text-accent-contrast"
                            : hasPin
                            ? "bg-success/15 text-success"
                            : "bg-surface-3 text-ink-soft"
                        }`}
                      >
                        <MapPin className="size-3" />
                        {isPickerOpen
                          ? "Close map"
                          : hasPin
                          ? "Edit pin"
                          : "Pin on map"}
                      </button>

                      {hasPin && !isPickerOpen && (
                        <span className="text-[10px] text-ink-faint">
                          {stop.lat!.toFixed(4)}, {stop.lng!.toFixed(4)}
                        </span>
                      )}

                      {hasPin && (
                        <button
                          onClick={() => clearStopCoords(stop.id)}
                          className="text-[11px] font-semibold text-danger"
                        >
                          Remove pin
                        </button>
                      )}
                    </div>

                    {isPickerOpen && (
                      <div className="mt-2 overflow-hidden rounded-[12px] border border-line" style={{ height: "200px" }}>
                        <ClassLocationPicker
                          lat={stop.lat}
                          lng={stop.lng}
                          onChange={(lat, lng) => setStopCoords(stop.id, lat, lng)}
                          onClear={() => clearStopCoords(stop.id)}
                          className="h-full w-full"
                        />
                      </div>
                    )}
                    {isPickerOpen && (
                      <p className="mt-1.5 text-center text-[10px] text-ink-faint">
                        Tap anywhere on the map to place a pin · drag pin to fine-tune
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          <button
            onClick={addStop}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-line-strong py-2.5 text-[13px] font-semibold text-ink-soft"
          >
            <Plus className="size-4" /> Add class stop
          </button>
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-[14px] bg-accent py-3 text-[14px] font-bold text-accent-contrast disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </>
  );
}
