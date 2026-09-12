"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarClock, ChevronDown, Clock, Compass, Crosshair, ExternalLink,
  Footprints, Loader2, MapPin, Maximize2, Minimize2, Navigation, Pin, Route as RouteIcon,
} from "lucide-react";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { CampusRouteMap } from "@/components/app/CampusRouteMap";
import { ClassScheduleModal } from "@/components/app/ClassScheduleModal";
import { Portal } from "@/components/ui/Portal";
import { useClassSchedule } from "@/lib/hooks/useClassSchedule";
import { useActivePlan } from "@/lib/hooks/useActivePlan";
import { useActiveWorkoutPlan } from "@/lib/hooks/useActiveWorkoutPlan";
import { useLiveLocation } from "@/lib/hooks/useLiveLocation";
import { haversineMetres } from "@/lib/hooks/useGeolocation";
import { useCustomize, readStoredCustomize } from "@/lib/customize/CustomizeContext";
import { getDiningLocations, todayPacificKey, type DiningLocationsSnapshot } from "@/lib/firebase/dining";
import {
  buildDayPlan, fmtTime, nextStopIndex, routeStops,
  type DayEvent, type DayPlace,
} from "@/lib/schedule/dayPlan";
import { fetchWalkRoute, formatDistance, walkMinutes, type WalkRoute } from "@/lib/nav/walkRoute";
import { useConfig } from "@/lib/config/ConfigContext";
import { useMealTiming } from "@/lib/hooks/useMealTiming";
import { remindersFromDayEvents } from "@/lib/schedule/reminderPlan";
import { syncReminders, clearAllReminders, notificationsGranted } from "@/lib/utils/notifications";
import type { Weekday } from "@/lib/db/types";
import { haptic } from "@/lib/utils/haptics";

const WEEKDAYS: { v: Weekday; short: string }[] = [
  { v: "monday", short: "Mon" },
  { v: "tuesday", short: "Tue" },
  { v: "wednesday", short: "Wed" },
  { v: "thursday", short: "Thu" },
  { v: "friday", short: "Fri" },
  { v: "saturday", short: "Sat" },
  { v: "sunday", short: "Sun" },
];

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

const KIND_STYLE: Record<string, { dot: string; chip: string; label: string }> = {
  class:   { dot: "bg-accent",  chip: "bg-accent-soft text-accent-ink", label: "Class" },
  meal:    { dot: "bg-flame",   chip: "bg-flame/15 text-flame",         label: "Meal" },
  workout: { dot: "bg-success", chip: "bg-success/15 text-success",     label: "Training" },
  study:   { dot: "bg-ink-faint", chip: "bg-surface-2 text-ink-soft",   label: "Open" },
  home:     { dot: "bg-pink",   chip: "bg-pink-soft text-ink",       label: "Home" },
  gym:      { dot: "bg-carbs",  chip: "bg-carbs-soft text-carbs",    label: "Gym" },
  club:     { dot: "bg-lav",    chip: "bg-lav-soft text-accent-ink", label: "Club" },
  activity: { dot: "bg-peach",  chip: "bg-peach-soft text-ink",      label: "Activity" },
};

const ARRIVE_RADIUS_M = 45;

const FULL_MAP_PAD_TOP = 118;
const FULL_MAP_PAD_BOTTOM = 210;

export default function TodayPage() {
  const { schedule, stopsForDay, loading: scheduleLoading } = useClassSchedule();
  const { activePlan } = useActivePlan();
  const { remindersOn } = useConfig();
  const { timing } = useMealTiming();
  const workoutPlan = useActiveWorkoutPlan();
  const { customize, setCustomize } = useCustomize();
  const today = todayPacificKey();
  const navTop = customize.navPosition === "top";

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [weekday, setWeekday] = useState<Weekday>(() => JS_DAY_TO_WEEKDAY[new Date().getDay()]);
  const isToday = weekday === JS_DAY_TO_WEEKDAY[new Date().getDay()];

  const [fullMap, setFullMap] = useState(false);
  useEffect(() => {
    if (readStoredCustomize().todayFullMap) setFullMap(true);
  }, []);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const [diningPlaces, setDiningPlaces] = useState<DayPlace[]>([]);
  useEffect(() => {
    let cancelled = false;
    getDiningLocations()
      .then((locs: DiningLocationsSnapshot) => {
        if (cancelled) return;
        const places: DayPlace[] = Object.values(locs ?? {})
          .filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number")
          .map((l) => ({ label: l.name, lat: l.latitude as number, lng: l.longitude as number }));
        const seen = new Set<string>();
        setDiningPlaces(places.filter((p) => {
          const k = p.label.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const workoutDay = useMemo(
    () => workoutPlan?.days?.find((d) => d.weekday === weekday) ?? null,
    [workoutPlan, weekday],
  );

  const events = useMemo(() => buildDayPlan({
    classes: stopsForDay(weekday),
    workout: workoutDay,
    plannedMeals:
      isToday && activePlan?.date === today && Array.isArray(activePlan.meals) ? activePlan.meals : [],
    diningPlaces,
    timing,
  }), [schedule, weekday, workoutDay, activePlan, diningPlaces, isToday, timing]);

  const stops = useMemo(() => routeStops(events), [events]);

  useEffect(() => {
    if (!isToday) return;
    if (!remindersOn || !notificationsGranted()) {
      void clearAllReminders();
      return;
    }
    void syncReminders(remindersFromDayEvents(today, events, Date.now()));
  }, [isToday, remindersOn, events, today]);
  const hasSchedule = (schedule && Object.values(schedule).some((d) => (d?.length ?? 0) > 0)) || false;
  const showFullMap = fullMap && hasSchedule;

  useEffect(() => {
    if (!showFullMap) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showFullMap]);

  const { position, status, error: geoError, start, stop } = useLiveLocation();
  const [navOn, setNavOn] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [manualIdx, setManualIdx] = useState<number | null>(null);
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const arrivedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (manualIdx !== null) { setActiveIdx(manualIdx); return; }
    if (stops.length === 0) return;
    setActiveIdx(isToday ? nextStopIndex(stops, nowMinutes) : 0);
  }, [stops, nowMinutes, manualIdx, isToday]);

  const activeStop: DayEvent | null = stops[activeIdx] ?? null;

  useEffect(() => {
    if (!navOn || !position || !activeStop?.place || manualIdx !== null) return;
    const d = haversineMetres(position.lat, position.lng, activeStop.place.lat, activeStop.place.lng);
    if (d <= ARRIVE_RADIUS_M && !arrivedRef.current.has(activeStop.id)) {
      arrivedRef.current.add(activeStop.id);
      haptic("success");
      setActiveIdx((i) => Math.min(i + 1, stops.length - 1));
    }
  }, [navOn, position, activeStop, stops.length, manualIdx]);

  useEffect(() => {
    if (!activeStop?.place) { setRoute(null); return; }
    const from = position ?? (activeIdx > 0 ? stops[activeIdx - 1]?.place ?? null : null);
    if (!from) { setRoute(null); return; }
    let cancelled = false;
    setRouting(true);
    fetchWalkRoute(
      { lat: from.lat, lng: from.lng },
      { lat: activeStop.place.lat, lng: activeStop.place.lng },
    )
      .then((r) => { if (!cancelled) setRoute(r); })
      .catch(() => { if (!cancelled) setRoute(null); })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; };
  }, [activeStop?.id, activeIdx, position ? Math.round(position.lat * 4000) : 0, position ? Math.round(position.lng * 4000) : 0]);

  const toggleNav = useCallback(() => {
    setNavOn((on) => {
      if (on) { stop(); return false; }
      start();
      haptic("medium");
      return true;
    });
  }, [start, stop]);

  const selectStop = useCallback((i: number) => {
    setManualIdx(i);
    setShowSteps(false);
    haptic("light");
  }, []);
  const followSchedule = useCallback(() => {
    setManualIdx(null);
    setShowSteps(false);
    haptic("light");
  }, []);
  const chooseDay = useCallback((d: Weekday) => {
    setWeekday(d);
    setManualIdx(null);
    setShowSteps(false);
    haptic("light");
  }, []);
  const toggleDefaultView = useCallback(() => {
    setCustomize({ todayFullMap: !customize.todayFullMap });
    haptic("light");
  }, [customize.todayFullMap, setCustomize]);

  const carouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showFullMap) return;
    const el = carouselRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIdx, showFullMap]);

  const leaveBy = activeStop && route ? activeStop.start - walkMinutes(route.seconds) : null;
  const lateNow = leaveBy !== null && isToday && nowMinutes >= leaveBy;
  const mapsUrl = activeStop?.place
    ? `https://www.google.com/maps/dir/?api=1&destination=${activeStop.place.lat},${activeStop.place.lng}&travelmode=walking`
    : null;
  const eyebrow = manualIdx !== null ? "Selected stop" : isToday ? "Next stop" : "First stop";

  return (
    <div className="flex min-h-screen flex-col">
      <ClassScheduleModal
        open={scheduleOpen}
        initial={schedule}
        onClose={() => setScheduleOpen(false)}
      />

      <AuroraHeader
        title="My Day"
        subtitle={isToday ? "Today's route across campus" : `Your ${WEEKDAYS.find((w) => w.v === weekday)?.short} plan`}
        icon={<RouteIcon className="size-[18px]" />}
      >
        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d.v}
              onClick={() => chooseDay(d.v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                weekday === d.v ? "bg-accent text-accent-contrast" : "glass-soft text-ink-soft"
              }`}
            >
              {d.short}
            </button>
          ))}
        </div>
      </AuroraHeader>

      <div className="flex-1 px-5 pb-8 pt-4">
        {!hasSchedule && !scheduleLoading ? (
          <div className="glass-panel grid place-items-center rounded-[22px] px-6 py-10 text-center">
            <span className="text-3xl">🗓️</span>
            <p className="mt-3 font-display text-[16px] font-extrabold text-ink">Add your timetable</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Add your classes once. After that this page tells you where to be, when to eat, and how
              long it takes to walk there.
            </p>
            <button
              onClick={() => setScheduleOpen(true)}
              className="press mt-4 rounded-full bg-accent px-5 py-2.5 text-[13px] font-bold text-accent-contrast"
            >
              Set up my classes
            </button>
          </div>
        ) : (
          <>
            <div className="glass-panel relative mb-4 overflow-hidden rounded-[22px]">
              {showFullMap ? (
                <div className="h-[280px] w-full" />
              ) : (
                <CampusRouteMap
                  stops={stops}
                  activeIndex={activeIdx}
                  user={position}
                  routeCoords={route?.coords ?? null}
                  follow={navOn}
                  onSelectStop={selectStop}
                  className="h-[280px] w-full"
                />
              )}
              <button
                onClick={toggleNav}
                className={`press absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  navOn ? "on-map-accent" : "on-map"
                }`}
              >
                {status === "locating" ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
                {navOn ? "Live" : "Navigate"}
              </button>
              <button
                onClick={() => { setFullMap(true); haptic("light"); }}
                aria-label="Expand the map to full screen"
                title="Full-screen map"
                className="on-map press absolute right-3 top-3 z-[1000] grid size-9 place-items-center rounded-full"
              >
                <Maximize2 className="size-4" />
              </button>
              {stops.length === 0 && (
                <div className="absolute inset-0 z-[900] grid place-items-center bg-surface/90">
                  <p className="px-6 text-center text-[12px] font-semibold text-ink-soft">
                    Nothing with a location on this day yet.
                  </p>
                </div>
              )}
            </div>

            {geoError && navOn && (
              <p className="mb-3 text-[12px] font-semibold text-danger">{geoError}</p>
            )}

            {activeStop && (
              <div className="glass-panel mb-4 rounded-[22px] p-4">
                <NextStopDetails
                  stop={activeStop}
                  eyebrow={eyebrow}
                  route={route}
                  routing={routing}
                  leaveBy={leaveBy}
                  lateNow={lateNow}
                  mapsUrl={mapsUrl}
                  showSteps={showSteps}
                  onToggleSteps={() => setShowSteps((s) => !s)}
                />
              </div>
            )}

            <section className="glass-panel rounded-[22px] p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-[18px] text-accent" />
                <h2 className="font-display text-[16px] font-extrabold text-ink">Your day</h2>
              </div>

              {events.length === 0 ? (
                <p className="mt-3 text-[12px] text-ink-soft">No classes on this day — the day is yours.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {events.map((e) => {
                    const style = KIND_STYLE[e.kind] ?? KIND_STYLE.study;
                    const stopIndex = stops.indexOf(e);
                    const isActive = stopIndex !== -1 && stopIndex === activeIdx;
                    const past = isToday && e.end <= nowMinutes;
                    const current = isToday && e.start <= nowMinutes && e.end > nowMinutes;
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => { if (stopIndex !== -1) selectStop(stopIndex); }}
                          disabled={stopIndex === -1}
                          className={`flex w-full items-start gap-3 rounded-[14px] border p-3 text-left transition ${
                            isActive ? "border-accent bg-accent-soft/40" : "border-line bg-surface-2"
                          } ${past ? "opacity-55" : ""}`}
                        >
                          <div className="flex w-[62px] shrink-0 flex-col items-start">
                            <span className="text-[12px] font-extrabold text-ink">{fmtTime(e.start)}</span>
                            <span className="text-[10px] text-ink-faint">{fmtTime(e.end)}</span>
                          </div>
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13.5px] font-bold text-ink">{e.title}</p>
                              {current && <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold text-success">NOW</span>}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-soft">
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${style.chip}`}>{style.label}</span>
                              {e.subtitle}
                            </p>
                          </div>
                          {stopIndex !== -1 && <Compass className="mt-1 size-4 shrink-0 text-ink-faint" />}
                        </button>

                        {e.kind === "meal" && (e.alternatives?.length ?? 0) > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 pl-[74px]">
                            {(e.alternatives ?? []).map((alt) => (
                              <span key={alt.label} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                                or {alt.label} · {alt.walkMin} min
                              </span>
                            ))}
                          </div>
                        )}

                        {(e.kind === "meal" || e.kind === "workout") && (
                          <Link
                            href={e.href}
                            className="press mt-1 flex items-center gap-1 pl-[74px] text-[11px] font-bold text-accent-ink"
                          >
                            {e.kind === "meal" ? "Find something to eat" : "Open the workout"}
                            <ArrowRight className="size-3" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              <button
                onClick={() => setScheduleOpen(true)}
                className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-surface-2 py-2.5 text-[12px] font-bold text-ink-soft"
              >
                <CalendarClock className="size-3.5" /> Edit my timetable
              </button>
            </section>
          </>
        )}
      </div>

      {showFullMap && (
        <Portal>
          <div
            role="dialog"
            aria-label="My Day map"
            className="fixed inset-x-0 z-[35] mx-auto flex max-w-[480px] flex-col bg-bg"
            style={navTop
              ? { top: "calc(74px + env(safe-area-inset-top))", bottom: 0 }
              : { top: 0, bottom: "calc(80px + env(safe-area-inset-bottom))" }}
          >
            <div className={`on-map z-10 shrink-0 px-3 pb-2 ${navTop ? "pt-2" : "pt-[max(env(safe-area-inset-top),10px)]"}`}>
              <div className="flex items-center gap-2">
                <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.v}
                      onClick={() => chooseDay(d.v)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                        weekday === d.v ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
                <button
                  onClick={toggleDefaultView}
                  aria-pressed={customize.todayFullMap}
                  aria-label={customize.todayFullMap ? "Stop opening My Day in map view" : "Always open My Day in map view"}
                  title={customize.todayFullMap ? "Map is My Day's default view — tap to turn off" : "Make this map My Day's default view"}
                  className={`press grid size-9 shrink-0 place-items-center rounded-full transition ${
                    customize.todayFullMap ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                  }`}
                >
                  <Pin className={`size-4 ${customize.todayFullMap ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => { setFullMap(false); haptic("light"); }}
                  aria-label="Exit full-screen map"
                  className="press grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"
                >
                  <Minimize2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <CampusRouteMap
                stops={stops}
                activeIndex={activeIdx}
                user={position}
                routeCoords={route?.coords ?? null}
                follow={navOn}
                onSelectStop={selectStop}
                zoomControl={false}
                scrollZoom
                focusActive
                padTop={FULL_MAP_PAD_TOP}
                padBottom={FULL_MAP_PAD_BOTTOM}
                className="absolute inset-0"
              />

              <div className="pointer-events-none absolute inset-x-0 top-2 z-[1000]">
                <div ref={carouselRef} className="no-scrollbar pointer-events-auto flex snap-x gap-2 overflow-x-auto px-3 pb-2">
                  <button
                    onClick={followSchedule}
                    className={`snap-start shrink-0 rounded-[16px] px-3 py-2 text-left transition ${
                      manualIdx === null ? "on-map-accent" : "on-map"
                    }`}
                  >
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-80">
                      <Clock className="size-3" /> Auto
                    </span>
                    <span className="mt-0.5 block text-[12px] font-extrabold">
                      {manualIdx === null ? "Following your day" : "Follow my day"}
                    </span>
                  </button>
                  {stops.map((s, i) => {
                    const active = i === activeIdx;
                    const past = isToday && s.end <= nowMinutes;
                    return (
                      <button
                        key={s.id}
                        data-idx={i}
                        onClick={() => selectStop(i)}
                        className={`on-map snap-start w-[152px] shrink-0 rounded-[16px] px-3 py-2 text-left transition ${
                          active ? "ring-2 ring-accent/50" : ""
                        } ${past && !active ? "opacity-70" : ""}`}
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink-faint">
                          <span className={`size-1.5 shrink-0 rounded-full ${(KIND_STYLE[s.kind] ?? KIND_STYLE.study).dot}`} />
                          {fmtTime(s.start)}
                          {active && manualIdx === null && isToday ? " · next" : ""}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] font-extrabold text-ink">{s.title}</span>
                        <span className="block truncate text-[10.5px] text-ink-soft">{s.place?.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="on-map absolute inset-x-3 bottom-3 z-[1000] rounded-[20px] p-3.5">
                {activeStop ? (
                  <NextStopDetails
                    compact
                    stop={activeStop}
                    eyebrow={eyebrow}
                    route={route}
                    routing={routing}
                    leaveBy={leaveBy}
                    lateNow={lateNow}
                    mapsUrl={mapsUrl}
                    showSteps={showSteps}
                    onToggleSteps={() => setShowSteps((s) => !s)}
                    navControl={
                      <button
                        onClick={toggleNav}
                        aria-pressed={navOn}
                        className={`press flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[12px] font-bold ${
                          navOn ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink"
                        }`}
                      >
                        {status === "locating" ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
                        {navOn ? "Live" : "Start"}
                      </button>
                    }
                  />
                ) : (
                  <p className="py-2 text-center text-[12px] font-semibold text-ink-soft">
                    Nothing with a location on this day yet.
                  </p>
                )}
                {geoError && navOn && <p className="mt-2 text-[11px] font-semibold text-danger">{geoError}</p>}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function NextStopDetails({
  stop, eyebrow, route, routing, leaveBy, lateNow, mapsUrl, showSteps, onToggleSteps, navControl, compact,
}: {
  stop: DayEvent;
  eyebrow: string;
  route: WalkRoute | null;
  routing: boolean;
  leaveBy: number | null;
  lateNow: boolean;
  mapsUrl: string | null;
  showSteps: boolean;
  onToggleSteps: () => void;
  navControl?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            <Navigation className="size-3 text-accent" /> {eyebrow}
          </p>
          <p className={`mt-0.5 truncate font-display font-extrabold text-ink ${compact ? "text-[15px]" : "text-[17px]"}`}>{stop.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-soft">
            <MapPin className="size-3 shrink-0" />{stop.place?.label}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink">
          {fmtTime(stop.start)}
        </span>
      </div>

      <div className={`grid grid-cols-3 gap-2 ${compact ? "mt-2" : "mt-3"}`}>
        <Stat label="Distance" value={routing && !route ? "…" : route ? formatDistance(route.metres) : "—"} />
        <Stat label="Walk" value={route ? `${walkMinutes(route.seconds)} min` : "—"} />
        <Stat label="Leave by" value={leaveBy !== null ? fmtTime(leaveBy) : "—"} highlight={lateNow} />
      </div>

      {lateNow && (
        <p className="mt-2 rounded-[10px] bg-warning/15 px-3 py-2 text-[12px] font-bold text-warning">
          Head out now to make it on time.
        </p>
      )}

      <div className={`flex gap-2 ${compact ? "mt-2" : "mt-3"}`}>
        {navControl}
        {route && route.steps.length > 0 && (
          <button
            onClick={onToggleSteps}
            className="press flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-surface-2 py-2.5 text-[12px] font-bold text-ink"
          >
            <Footprints className="size-3.5" /> Directions
            <ChevronDown className={`size-3.5 transition-transform ${showSteps ? "rotate-180" : ""}`} />
          </button>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="press flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-accent py-2.5 text-[12px] font-bold text-accent-contrast"
          >
            <ExternalLink className="size-3.5" /> {compact ? "Maps" : "Open in Maps"}
          </a>
        )}
      </div>

      {showSteps && route && (
        <ol className={`mt-2 space-y-1.5 ${compact ? "thin-scrollbar max-h-36 overflow-y-auto" : ""}`}>
          {route.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-[10px] bg-surface-2 px-3 py-2">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-extrabold text-accent-contrast">{i + 1}</span>
              <span className="flex-1 text-[12.5px] leading-relaxed text-ink">{s.text}</span>
              {s.metres > 0 && <span className="shrink-0 text-[11px] font-semibold text-ink-faint">{formatDistance(s.metres)}</span>}
            </li>
          ))}
        </ol>
      )}
      {route?.source === "direct" && (
        <p className="mt-2 text-[10px] text-ink-faint">
          Showing a direct line — detailed walking directions weren&apos;t available offline.
        </p>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[12px] px-2 py-2 text-center ${highlight ? "bg-warning/15" : "bg-surface-2"}`}>
      <p className={`font-display text-[15px] font-extrabold ${highlight ? "text-warning" : "text-ink"}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
    </div>
  );
}
