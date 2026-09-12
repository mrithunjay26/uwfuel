"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Check, ChevronDown, ChevronUp, Copy, MapPin, Plus, Repeat, Route,
  Search, Star, Trash2, X,
} from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { Portal } from "@/components/ui/Portal";
import { saveClassSchedule, saveSavedPlace, deleteSavedPlace } from "@/lib/db/userDb";
import { useSavedPlaces, type SavedPlaceEntry } from "@/lib/hooks/useSavedPlaces";
import { ClassLocationPicker } from "@/components/app/ClassLocationPicker";
import { DayRouteMap, type DayRoutePoint } from "@/components/app/DayRouteMap";
import { CAMPUS_BUILDINGS, resolveCampusPlace } from "@/lib/campus/buildings";
import { haptic } from "@/lib/utils/haptics";
import type { ClassSchedule, ClassStop, ScheduleTag, Weekday } from "@/lib/db/types";

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
  title:          string;
  building_label: string;
  start_time:     string;
  end_time:       string;
  lat:            number | null;
  lng:            number | null;
  tag:            ScheduleTag;
}

const SCHEDULE_TAGS: { id: ScheduleTag; label: string; icon: string }[] = [
  { id: "class", label: "Class", icon: "🎓" },
  { id: "home",  label: "Home",  icon: "🏠" },
  { id: "gym",   label: "Gym",   icon: "💪" },
  { id: "club",  label: "Club",  icon: "🎭" },
  { id: "work",  label: "Work",  icon: "💼" },
  { id: "study", label: "Study", icon: "📚" },
  { id: "other", label: "Other", icon: "📌" },
];

interface PlaceOption {
  label: string;
  lat: number | null;
  lng: number | null;
  origin: "saved" | "schedule" | "campus";
  savedId?: string;
}

function newStop(): DraftStop {
  return {
    id: crypto.randomUUID(),
    title: "",
    building_label: "",
    start_time: "09:00",
    end_time: "10:00",
    lat: null,
    lng: null,
    tag: "class",
  };
}

const emptyWeek = (): Record<Weekday, DraftStop[]> => ({
  monday: [], tuesday: [], wednesday: [], thursday: [],
  friday: [], saturday: [], sunday: [],
});

function sameStop(a: DraftStop, b: DraftStop): boolean {
  return a.title.trim() === b.title.trim()
    && a.building_label.trim() === b.building_label.trim()
    && a.start_time === b.start_time;
}

import { useSheetDrag } from "@/lib/hooks/useSheetDrag";
import { DragHandle } from "@/components/ui/DragHandle";

export function ClassScheduleModal({ open, initial, onClose }: ClassScheduleModalProps) {
  const drag = useSheetDrag(onClose);
  const handle = useUserDb();
  const { places: savedPlaces } = useSavedPlaces();

  const [activeDay,  setActiveDay]  = useState<Weekday>("monday");
  const [schedule,   setSchedule]   = useState<Record<Weekday, DraftStop[]>>(emptyWeek);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [pinningId,  setPinningId]  = useState<string | null>(null);
  const [pickerId,   setPickerId]   = useState<string | null>(null);
  const [repeatId,   setRepeatId]   = useState<string | null>(null);
  const [showDayMap, setShowDayMap] = useState(true);
  const [copyOpen,   setCopyOpen]   = useState(false);

  useEffect(() => {
    if (!initial) return;
    const next = emptyWeek();
    (Object.keys(initial) as Weekday[]).forEach((day) => {
      next[day] = (initial[day] ?? []).map((s: ClassStop) => ({
        id:             s.id || crypto.randomUUID(),
        title:          s.title ?? "",
        building_label: s.building_label,
        start_time:     s.start_time,
        end_time:       s.end_time,
        lat:            s.lat ?? null,
        lng:            s.lng ?? null,
        tag:            s.tag ?? "class",
      }));
    });
    setSchedule(next);
    setPinningId(null);
    setPickerId(null);
    setRepeatId(null);
  }, [initial, open]);

  const dayRoutePoints = useMemo<DayRoutePoint[]>(() => {
    return schedule[activeDay]
      .filter((s) => s.lat != null && s.lng != null && s.building_label.trim())
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => ({
        lat: s.lat as number,
        lng: s.lng as number,
        label: s.title.trim() || s.building_label.trim(),
        time: `${s.start_time} to ${s.end_time}`,
      }));
  }, [schedule, activeDay]);

  const placeOptions = useMemo<PlaceOption[]>(() => {
    const seen = new Set<string>();
    const out: PlaceOption[] = [];

    for (const p of savedPlaces) {
      const key = p.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: p.label, lat: p.lat, lng: p.lng, origin: "saved", savedId: p.id });
    }
    for (const day of Object.keys(schedule) as Weekday[]) {
      for (const s of schedule[day]) {
        const label = s.building_label.trim();
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label, lat: s.lat, lng: s.lng, origin: "schedule" });
      }
    }
    for (const b of CAMPUS_BUILDINGS) {
      const key = b.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: b.name, lat: b.lat, lng: b.lng, origin: "campus" });
    }
    return out;
  }, [savedPlaces, schedule]);

  const stops = schedule[activeDay];

  function mutateDay(day: Weekday, fn: (list: DraftStop[]) => DraftStop[]) {
    setSchedule((prev) => ({ ...prev, [day]: fn(prev[day]) }));
  }

  function addStop() {
    const stop = newStop();
    mutateDay(activeDay, (list) => [...list, stop]);
    setPickerId(stop.id);
    haptic("light");
  }

  function removeStop(id: string) {
    mutateDay(activeDay, (list) => list.filter((s) => s.id !== id));
    if (pinningId === id) setPinningId(null);
    if (pickerId === id) setPickerId(null);
    if (repeatId === id) setRepeatId(null);
  }

  function updateStop<K extends keyof DraftStop>(id: string, field: K, value: DraftStop[K]) {
    mutateDay(activeDay, (list) => list.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function onLabelBlur(stop: DraftStop) {
    if (stop.lat != null || !stop.building_label.trim()) return;
    const match = resolveCampusPlace(stop.building_label);
    if (match) {
      mutateDay(activeDay, (list) =>
        list.map((s) => (s.id === stop.id ? { ...s, lat: match.lat, lng: match.lng } : s)));
    }
  }

  function applyPlace(id: string, place: PlaceOption) {
    mutateDay(activeDay, (list) =>
      list.map((s) => (s.id === id ? { ...s, building_label: place.label, lat: place.lat, lng: place.lng } : s)));
    setPickerId(null);
    haptic("light");
  }

  async function toggleSavedPlace(stop: DraftStop) {
    if (!handle || !stop.building_label.trim()) return;
    const existing = savedPlaces.find((p) => p.label.toLowerCase() === stop.building_label.trim().toLowerCase());
    haptic("light");
    if (existing) await deleteSavedPlace(handle.db, handle.uid, existing.id).catch(() => {});
    else await saveSavedPlace(handle.db, handle.uid, {
      label: stop.building_label.trim(), lat: stop.lat, lng: stop.lng,
    }).catch(() => {});
  }

  function toggleRepeat(stop: DraftStop, day: Weekday) {
    if (day === activeDay) return;
    haptic("light");
    setSchedule((prev) => {
      const match = prev[day].find((s) => sameStop(s, stop));
      return {
        ...prev,
        [day]: match
          ? prev[day].filter((s) => s.id !== match.id)
          : [...prev[day], { ...stop, id: crypto.randomUUID() }],
      };
    });
  }

  function copyDayTo(day: Weekday) {
    if (day === activeDay) return;
    haptic("light");
    setSchedule((prev) => {
      const additions = prev[activeDay]
        .filter((s) => s.building_label.trim() || s.title.trim())
        .filter((s) => !prev[day].some((t) => sameStop(t, s)))
        .map((s) => ({ ...s, id: crypto.randomUUID() }));
      return { ...prev, [day]: [...prev[day], ...additions] };
    });
  }

  function clearDay() {
    if (stops.length === 0) return;
    mutateDay(activeDay, () => []);
    haptic("medium");
  }

  async function handleSave() {
    if (!handle) return;
    setSaving(true);
    setError(null);
    try {
      const payload: ClassSchedule = {};
      (Object.keys(schedule) as Weekday[]).forEach((day) => {
        const dayStops = schedule[day].filter((s) => s.building_label.trim() || s.title.trim());
        if (dayStops.length > 0) {
          payload[day] = dayStops
            .slice()
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((s): ClassStop => ({
              id:             s.id,
              title:          s.title.trim(),
              building_label: s.building_label.trim() || s.title.trim(),
              start_time:     s.start_time,
              end_time:       s.end_time,
              lat:            s.lat,
              lng:            s.lng,
              source:         "manual",
              tag:            s.tag ?? "class",
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

  const totalClasses = (Object.keys(schedule) as Weekday[])
    .reduce((n, d) => n + schedule[d].filter((s) => s.building_label.trim() || s.title.trim()).length, 0);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Class schedule"
        className="glass-strong animate-rise fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-5"
        style={{ maxHeight: "94dvh", display: "flex", flexDirection: "column", ...drag.sheetStyle }}
      >
        <DragHandle handleProps={drag.handleProps} className="mb-1.5" />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-[20px] font-extrabold text-ink">Class Schedule</h2>
            <p className="text-[11px] text-ink-soft">
              {totalClasses === 0 ? "Add your timetable once — the app plans around it." : `${totalClasses} class${totalClasses === 1 ? "" : "es"} this week`}
            </p>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-surface-3 text-ink-soft">
            <X className="size-4" />
          </button>
        </div>

        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {WEEKDAYS.map(({ key, label }) => {
            const count = schedule[key].filter((s) => s.building_label.trim() || s.title.trim()).length;
            return (
              <button
                key={key}
                onClick={() => { setActiveDay(key); setCopyOpen(false); setPickerId(null); setRepeatId(null); }}
                className={`relative shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-bold transition ${
                  activeDay === key ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1 text-[10px] ${activeDay === key ? "text-accent-contrast/80" : "text-ink-faint"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setCopyOpen((c) => !c)}
            disabled={stops.length === 0}
            className="press flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-ink-soft disabled:opacity-40"
          >
            <Copy className="size-3" /> Copy day to…
          </button>
          {stops.length > 0 && (
            <button onClick={clearDay} className="press rounded-full px-2.5 py-1.5 text-[11px] font-bold text-danger">
              Clear day
            </button>
          )}
        </div>
        {copyOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-[12px] bg-surface-2 p-2">
            {WEEKDAYS.filter((d) => d.key !== activeDay).map((d) => (
              <button
                key={d.key}
                onClick={() => copyDayTo(d.key)}
                className="press rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-ink"
              >
                + {d.label}
              </button>
            ))}
          </div>
        )}

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
              <div className="mt-2 overflow-hidden rounded-[14px] border border-line" style={{ height: "180px" }}>
                <DayRouteMap points={dayRoutePoints} className="h-full w-full" />
              </div>
            )}
          </div>
        )}

        <div className="thin-scrollbar mt-3 flex-1 overflow-y-auto">
          {stops.length === 0 ? (
            <div className="py-8 text-center">
              <span className="text-2xl">📚</span>
              <p className="mt-2 text-[13px] font-semibold text-ink">No classes on {WEEKDAYS.find((d) => d.key === activeDay)?.label}</p>
              <p className="text-[12px] text-ink-soft">Add one below, or copy another day over.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-2">
              {stops.map((stop) => {
                const isPinning = pinningId === stop.id;
                const isPicking = pickerId === stop.id;
                const isRepeating = repeatId === stop.id;
                const hasPin = stop.lat != null && stop.lng != null;
                const isSaved = savedPlaces.some((p) => p.label.toLowerCase() === stop.building_label.trim().toLowerCase());
                const repeatDays = WEEKDAYS.filter((d) => d.key !== activeDay && schedule[d.key].some((s) => sameStop(s, stop)));

                return (
                  <div key={stop.id} className="rounded-[14px] bg-surface-2 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Class name — e.g. CSE 142"
                        value={stop.title}
                        onChange={(e) => updateStop(stop.id, "title", e.target.value)}
                        className="flex-1 rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint focus:border-accent"
                      />
                      <button
                        onClick={() => removeStop(stop.id)}
                        aria-label="Remove class"
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => { setPickerId(isPicking ? null : stop.id); setRepeatId(null); }}
                        className="press flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-left"
                      >
                        <Building2 className={`size-3.5 shrink-0 ${hasPin ? "text-success" : "text-ink-faint"}`} />
                        <span className={`min-w-0 flex-1 truncate text-[13px] ${stop.building_label ? "text-ink" : "text-ink-faint"}`}>
                          {stop.building_label || "Choose a building"}
                        </span>
                        <ChevronDown className={`size-3.5 shrink-0 text-ink-faint transition-transform ${isPicking ? "rotate-180" : ""}`} />
                      </button>
                      <button
                        onClick={() => void toggleSavedPlace(stop)}
                        disabled={!stop.building_label.trim()}
                        aria-label={isSaved ? "Remove from saved places" : "Save this place for reuse"}
                        title={isSaved ? "Saved — reuse on any day" : "Save this place for reuse"}
                        className={`grid size-8 shrink-0 place-items-center rounded-full disabled:opacity-40 ${isSaved ? "bg-accent text-accent-contrast" : "bg-surface text-ink-faint"}`}
                      >
                        <Star className={`size-3.5 ${isSaved ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    {isPicking && (
                      <PlacePicker
                        options={placeOptions}
                        onPick={(p) => applyPlace(stop.id, p)}
                        onManual={(text) => { updateStop(stop.id, "building_label", text); setPickerId(null); }}
                      />
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SCHEDULE_TAGS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => updateStop(stop.id, "tag", t.id)}
                          className={`press flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                            (stop.tag ?? "class") === t.id ? "bg-accent text-accent-contrast" : "bg-surface-3 text-ink-soft"
                          }`}
                        >
                          <span aria-hidden>{t.icon}</span> {t.label}
                        </button>
                      ))}
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

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => { setPinningId(isPinning ? null : stop.id); setPickerId(null); onLabelBlur(stop); }}
                        className={`press flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                          isPinning ? "bg-accent text-accent-contrast" : hasPin ? "bg-success/15 text-success" : "bg-surface-3 text-ink-soft"
                        }`}
                      >
                        <MapPin className="size-3" />
                        {isPinning ? "Close map" : hasPin ? "Pinned" : "Pin on map"}
                      </button>

                      <button
                        onClick={() => { setRepeatId(isRepeating ? null : stop.id); setPickerId(null); }}
                        className={`press flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                          isRepeating ? "bg-accent text-accent-contrast" : repeatDays.length > 0 ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-ink-soft"
                        }`}
                      >
                        <Repeat className="size-3" />
                        {repeatDays.length > 0 ? `Also ${repeatDays.map((d) => d.label).join(", ")}` : "Repeat on days"}
                      </button>

                      {hasPin && (
                        <button
                          onClick={() => { updateStop(stop.id, "lat", null); updateStop(stop.id, "lng", null); }}
                          className="text-[11px] font-semibold text-ink-faint"
                        >
                          Clear pin
                        </button>
                      )}
                    </div>

                    {isRepeating && (
                      <div className="mt-2 flex flex-wrap gap-1.5 rounded-[12px] bg-surface p-2">
                        {WEEKDAYS.filter((d) => d.key !== activeDay).map((d) => {
                          const on = schedule[d.key].some((s) => sameStop(s, stop));
                          return (
                            <button
                              key={d.key}
                              onClick={() => toggleRepeat(stop, d.key)}
                              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                                on ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                              }`}
                            >
                              {on && <Check className="size-3" />}
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {isPinning && (
                      <>
                        <div className="mt-2 overflow-hidden rounded-[12px] border border-line" style={{ height: "190px" }}>
                          <ClassLocationPicker
                            lat={stop.lat}
                            lng={stop.lng}
                            onChange={(lat, lng) => {
                              mutateDay(activeDay, (list) => list.map((s) => (s.id === stop.id ? { ...s, lat, lng } : s)));
                            }}
                            onClear={() => {
                              mutateDay(activeDay, (list) => list.map((s) => (s.id === stop.id ? { ...s, lat: null, lng: null } : s)));
                            }}
                            className="h-full w-full"
                          />
                        </div>
                        <p className="mt-1.5 text-center text-[10px] text-ink-faint">
                          Tap the map to place a pin · drag to fine-tune
                        </p>
                      </>
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
            <Plus className="size-4" /> Add class
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
    </Portal>
  );
}

const ORIGIN_LABEL: Record<PlaceOption["origin"], string> = {
  saved: "Saved",
  schedule: "In your week",
  campus: "UW buildings",
};

function PlacePicker({
  options,
  onPick,
  onManual,
}: {
  options: PlaceOption[];
  onPick: (p: PlaceOption) => void;
  onManual: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return list.slice(0, 40);
  }, [options, q]);

  const groups: PlaceOption["origin"][] = ["saved", "schedule", "campus"];

  return (
    <div className="mt-2 rounded-[12px] border border-line bg-surface p-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search buildings or saved places…"
          className="w-full rounded-[10px] border border-line bg-surface-2 py-2 pl-8 pr-3 text-[13px] text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="thin-scrollbar mt-2 max-h-[190px] overflow-y-auto">
        {matches.length === 0 ? (
          <button
            onClick={() => onManual(query.trim())}
            disabled={!query.trim()}
            className="press w-full rounded-[10px] bg-surface-2 px-3 py-2 text-left text-[12px] font-semibold text-ink disabled:opacity-40"
          >
            Use “{query.trim() || "…"}” as a custom place
          </button>
        ) : (
          groups.map((origin) => {
            const rows = matches.filter((m) => m.origin === origin);
            if (rows.length === 0) return null;
            return (
              <div key={origin} className="mb-1.5">
                <p className="px-1 py-1 text-[9px] font-bold uppercase tracking-wide text-ink-faint">{ORIGIN_LABEL[origin]}</p>
                {rows.map((p, i) => (
                  <button
                    key={`${origin}-${i}`}
                    onClick={() => onPick(p)}
                    className="press flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-surface-2"
                  >
                    {origin === "saved"
                      ? <Star className="size-3.5 shrink-0 fill-current text-accent" />
                      : <Building2 className="size-3.5 shrink-0 text-ink-faint" />}
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{p.label}</span>
                    {p.lat != null && <MapPin className="size-3 shrink-0 text-success" />}
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
