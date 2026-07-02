"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, MapPin, Search, UtensilsCrossed, X } from "lucide-react";
import { MealCard } from "@/components/app/MealCard";
import { MealScannerSheet } from "@/components/app/MealScannerSheet";
import { SCAN_ENABLED } from "@/lib/nutrition/scan";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useFoodLog } from "@/lib/hooks/useFoodLog";
import { useGeolocation, type GeoPosition } from "@/lib/hooks/useGeolocation";
import { logFoodItem } from "@/lib/db/userDb";
import {
  getDiningLocations,
  getDiningMenu,
  resolveMenuDate,
  todayPacificKey,
  type DiningLocationsSnapshot,
  type DiningMenuSnapshot,
} from "@/lib/firebase/dining";
import {
  flattenFullMenu,
  buildLocationGroups,
  buildLocationOpenMap,
  filterMenuItems,
  scoreMenuItem,
  type FlatMenuItem,
  type MenuFilter,
} from "@/lib/menu/flattenMenu";
import { estimateProteinGrams, estimateMacros } from "@/lib/utils/nutrition";
import { DiningMap } from "@/components/app/DiningMap";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { MealDetailSheet } from "@/components/app/MealDetailSheet";
import { useOnboardingProfile } from "@/lib/hooks/useOnboardingProfile";
import { assessDietarySafety, type DietaryAssessment } from "@/lib/dietary/safety";

type PageTab = "menu" | "map";

const FILTER_CHIPS: { value: MenuFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "available",  label: "Open now" },
  { value: "hi-protein", label: "Hi-protein" },
  { value: "low-cal",    label: "Low cal" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan",      label: "Vegan" },
  { value: "halal",      label: "Halal" },
];

export default function MenuPage() {
  const handle     = useUserDb();
  const { profile } = useUserProfile();
  const today      = todayPacificKey();
  const { totals } = useFoodLog(today);
  const searchParams = useSearchParams();
  const { position: userGeo } = useGeolocation();
  const { profile: setupProfile } = useOnboardingProfile();

  const [pageTab, setPageTab] = useState<PageTab>(
    searchParams.get("tab") === "map" ? "map" : "menu",
  );

  const [locations,     setLocations]     = useState<DiningLocationsSnapshot | null>(null);
  const [menuSnapshot,  setMenuSnapshot]  = useState<DiningMenuSnapshot | null>(null);
  const [resolvedDate,  setResolvedDate]  = useState<string>(today);
  const [isFallback,    setIsFallback]    = useState(false);
  const [dataLoading,   setDataLoading]   = useState(true);
  const [dataError,     setDataError]     = useState<string | null>(null);

  const [search,        setSearch]        = useState("");
  const [activeFilter,  setActiveFilter]  = useState<MenuFilter>("all");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loggingId,     setLoggingId]     = useState<string | null>(null);
  const [detailItem,    setDetailItem]    = useState<FlatMenuItem | null>(null);
  const [scanOpen,      setScanOpen]      = useState(false);
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [locs, { dateKey, isFallback: fb }] = await Promise.all([
          getDiningLocations(),
          resolveMenuDate(),
        ]);
        if (cancelled) return;
        setLocations(locs);
        setResolvedDate(dateKey);
        setIsFallback(fb);

        const menu = await getDiningMenu(dateKey) as DiningMenuSnapshot | null;
        if (cancelled) return;
        setMenuSnapshot(menu);
      } catch (e) {
        if (!cancelled) setDataError(e instanceof Error ? e.message : "Failed to load menu.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const locationNames = useMemo(
    () => Object.fromEntries(
      Object.entries(locations ?? {}).map(([id, loc]) => [id, loc.name]),
    ),
    [locations],
  );

  const locationGroups = useMemo(
    () => buildLocationGroups(locations ?? {}),
    [locations],
  );

  const locationOpenById = useMemo(
    () => buildLocationOpenMap(locations ?? {}),
    [locations],
  );

  const rawItems = useMemo(
    () => flattenFullMenu(menuSnapshot, locationNames, locationOpenById),
    [menuSnapshot, locationNames, locationOpenById],
  );
  const safetyByKey = useMemo(() => new Map(rawItems.map((item) => [item.unique_key, assessDietarySafety(item, setupProfile?.dietary ?? null)])), [rawItems, setupProfile]);
  const allItems = useMemo(() => rawItems.filter((item) => safetyByKey.get(item.unique_key)?.status !== "blocked"), [rawItems, safetyByKey]);

  const locationIdByGroup = useMemo(() => {
    const map: Record<string, string> = {};
    locationGroups.forEach((g) => {
      if (g.stations.length > 0) map[g.name] = g.stations[0].id;
    });
    return map;
  }, [locationGroups]);

  const phase           = profile?.phase ?? "maintain";
  const remainingBudget = Math.max(0, (profile ? 37 : 37) - totals.cost);

  const groupFilteredItems = useMemo(() => {
    if (!selectedGroup) return allItems;
    const group     = locationGroups.find((g) => g.name === selectedGroup);
    const stationIds = new Set((group?.stations ?? []).map((s) => s.id));
    return allItems.filter((i) => stationIds.has(i.location_id));
  }, [allItems, selectedGroup, locationGroups]);

  const sortedItems = useMemo(
    () => [...groupFilteredItems].sort(
      (a, b) => scoreMenuItem(b, phase, remainingBudget) - scoreMenuItem(a, phase, remainingBudget),
    ),
    [groupFilteredItems, phase, remainingBudget],
  );

  const displayItems = useMemo(
    () => filterMenuItems(sortedItems, activeFilter, search, false),
    [sortedItems, activeFilter, search],
  );

  useEffect(() => {
    const locationParam = searchParams.get("location");
    if (!locationParam || locationGroups.length === 0) return;
    const group = locationGroups.find((g) =>
      g.stations.some((s) => s.id === locationParam),
    );
    if (group) {
      queueMicrotask(() => {
        setSelectedGroup(group.name);
        setPageTab("menu");
      });
    }
  }, [searchParams, locationGroups]);

  useEffect(() => {
    const itemKey = searchParams.get("item");
    if (!itemKey || allItems.length === 0) return;
    const match = allItems.find((item) => item.unique_key === itemKey || item.item_id === itemKey);
    if (match) {
      queueMicrotask(() => {
        setDetailItem(match);
        setPageTab("menu");
      });
    }
  }, [searchParams, allItems]);

  const handleLocationSelect = useCallback(
    (locId: string) => {
      const group = locationGroups.find((g) =>
        g.stations.some((s) => s.id === locId),
      );
      if (group) setSelectedGroup(group.name);
      setPageTab("menu");
    },
    [locationGroups],
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const handleLog = useCallback(
    async (item: FlatMenuItem) => {
      if (!handle) { showToast("Sign in to log meals."); return; }
      setLoggingId(item.unique_key);
      try {
        const protein = item.protein_grams > 0
          ? item.protein_grams
          : estimateProteinGrams(item.name, item.description, item.calories);
        const macros = estimateMacros(item.calories, protein);
        const carbs  = (item.carbs_grams ?? 0) > 0 ? (item.carbs_grams as number) : macros.carbs;
        const fat    = (item.fat_grams   ?? 0) > 0 ? (item.fat_grams   as number) : macros.fat;
        await logFoodItem(handle.db, handle.uid, today, {
          name:          item.name,
          description:   item.description,
          calories:      item.calories,
          protein_grams: protein,
          carbs_grams:   carbs,
          fat_grams:     fat,
          price:         item.price,
          location_id:   item.location_id,
          location_name: item.location_name,
          is_custom:     false,
          funding_source: "dining_plan",
        });
        showToast(`${item.name} logged ✓`);
      } catch {
        showToast("Couldn't log. Check your connection.");
      } finally {
        setLoggingId(null);
      }
    },
    [handle, today, showToast],
  );

  return (
    <div className="flex min-h-screen flex-col">

      {SCAN_ENABLED && (
        <MealScannerSheet open={scanOpen} onClose={() => setScanOpen(false)} onLogged={showToast} />
      )}

      {toastMsg && (
        <div className="animate-rise fixed bottom-[100px] left-1/2 z-50 -translate-x-1/2 rounded-[14px] bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface shadow-[var(--shadow-lg)]">
          {toastMsg}
        </div>
      )}

      <AuroraHeader
        title="Campus Dining"
        icon={<UtensilsCrossed className="size-[18px]" />}
        right={
          <div className="flex items-center gap-2">
            {isFallback && resolvedDate && (
              <span className="rounded-full bg-warning/20 px-2.5 py-1 text-[11px] font-semibold text-warning backdrop-blur-md">
                Menu: {resolvedDate}
              </span>
            )}
            {SCAN_ENABLED && (
              <button
                onClick={() => setScanOpen(true)}
                aria-label="Scan a meal"
                className="press grid size-9 place-items-center rounded-full bg-accent text-accent-contrast shadow-[var(--shadow-sm)]"
              >
                <Camera className="size-[18px]" />
              </button>
            )}
          </div>
        }
      >
        <div className="glass-soft mt-3 flex gap-1 rounded-[16px] p-1">
          {(["menu", "map"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPageTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2 text-[13px] font-bold transition ${
                pageTab === t
                  ? "glass-strong text-ink shadow-[var(--shadow-sm)]"
                  : "text-ink-soft"
              }`}
            >
              {t === "menu" ? (
                <><UtensilsCrossed className="size-3.5" /> Menu</>
              ) : (
                <><MapPin className="size-3.5" /> Map</>
              )}
            </button>
          ))}
        </div>

        {pageTab === "menu" && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu items…"
              className="glass-soft w-full rounded-[14px] py-2.5 pl-9 pr-9 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
      </AuroraHeader>

      {pageTab === "menu" ? (
        <MenuTabContent
          locationGroups={locationGroups}
          selectedGroup={selectedGroup}
          onSelectGroup={setSelectedGroup}
          filters={FILTER_CHIPS}
          activeFilter={activeFilter}
          onFilter={setActiveFilter}
          items={displayItems}
          loading={dataLoading}
          error={dataError}
          onLog={handleLog}
          onOpen={setDetailItem}
          loggingId={loggingId}
          totalItems={allItems.length}
          hiddenUnsafe={rawItems.length - allItems.length}
          safetyByKey={safetyByKey}
        />
      ) : (
        <MapTabContent
          locations={locations}
          allItems={allItems}
          loading={dataLoading}
          locationIdByGroup={locationIdByGroup}
          onLocationSelect={handleLocationSelect}
          userLocation={userGeo}
        />
      )}

      <MealDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onLog={async (i) => { await handleLog(i); setDetailItem(null); }}
        isLogging={loggingId === detailItem?.unique_key}
      />
    </div>
  );
}

function MenuTabContent({
  locationGroups,
  selectedGroup,
  onSelectGroup,
  filters,
  activeFilter,
  onFilter,
  items,
  loading,
  error,
  onLog,
  onOpen,
  loggingId,
  totalItems,
  hiddenUnsafe,
  safetyByKey,
}: {
  locationGroups:  ReturnType<typeof buildLocationGroups>;
  selectedGroup:   string | null;
  onSelectGroup:   (g: string | null) => void;
  filters:         typeof FILTER_CHIPS;
  activeFilter:    MenuFilter;
  onFilter:        (f: MenuFilter) => void;
  items:           FlatMenuItem[];
  loading:         boolean;
  error:           string | null;
  onLog:           (item: FlatMenuItem) => void;
  onOpen:          (item: FlatMenuItem) => void;
  loggingId:       string | null;
  totalItems:      number;
  hiddenUnsafe:    number;
  safetyByKey:     Map<string, DietaryAssessment>;
}) {
  return (
    <div className="flex-1 px-5 pb-6 pt-4">

      {locationGroups.length > 0 && (
        <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          <GroupChip
            label="All"
            isOpen={true}
            active={!selectedGroup}
            onClick={() => onSelectGroup(null)}
          />
          {locationGroups.map((g) => (
            <GroupChip
              key={g.name}
              label={g.name}
              isOpen={g.isOpen}
              active={selectedGroup === g.name}
              onClick={() => onSelectGroup(selectedGroup === g.name ? null : g.name)}
            />
          ))}
        </div>
      )}

      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onFilter(value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
              activeFilter === value
                ? "bg-accent text-accent-contrast"
                : "bg-surface text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!loading && !error && totalItems > 0 && (
        <p className="mt-3 text-[12px] text-ink-faint">
          {items.length} of {totalItems} items{hiddenUnsafe > 0 ? ` · ${hiddenUnsafe} blocked by your food rules` : ""}
        </p>
      )}

      <div className="mt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[140px] rounded-[18px] skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[18px] bg-danger/10 px-4 py-6 text-center">
            <p className="text-[13px] font-semibold text-danger">{error}</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Check your internet connection and refresh.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center rounded-[22px] border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
            <span className="text-3xl">🍽️</span>
            <p className="mt-3 text-[14px] font-semibold text-ink">No items found</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Try a different filter or search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, i) => (
              <MealCard
                key={item.unique_key}
                item={item}
                index={i}
                onLog={onLog}
                onOpen={onOpen}
                isLogging={loggingId === item.unique_key}
                safety={safetyByKey.get(item.unique_key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupChip({
  label, isOpen, active, onClick,
}: {
  label: string; isOpen: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${
        active
          ? "border-accent bg-accent text-accent-contrast"
          : "border-line bg-surface text-ink-soft"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          label === "All" ? "bg-accent" : isOpen ? "bg-success" : "bg-ink-faint"
        }`}
      />
      {label}
    </button>
  );
}

function MapTabContent({
  locations,
  allItems,
  loading,
  locationIdByGroup,
  onLocationSelect,
  userLocation,
}: {
  locations:          DiningLocationsSnapshot | null;
  allItems:           FlatMenuItem[];
  loading:            boolean;
  locationIdByGroup:  Record<string, string>;
  onLocationSelect:   (locId: string) => void;
  userLocation?:      GeoPosition | null;
}) {
  const groups = useMemo(
    () => buildLocationGroups(locations ?? {}),
    [locations],
  );

  const coordsByGroup = useMemo(() => {
    const map: Record<string, { lat: number; lng: number } | null> = {};
    groups.forEach((g) => {
      const firstStation = g.stations[0];
      const loc = firstStation && locations?.[firstStation.id];
      map[g.name] = loc?.latitude && loc?.longitude
        ? { lat: loc.latitude, lng: loc.longitude }
        : null;
    });
    return map;
  }, [groups, locations]);

  const itemsByGroup = useMemo(() => {
    const map: Record<string, FlatMenuItem[]> = {};
    groups.forEach((g) => {
      const stationIds = new Set(g.stations.map((s) => s.id));
      map[g.name] = allItems.filter((i) => stationIds.has(i.location_id));
    });
    return map;
  }, [groups, allItems]);

  return (
    <div className="flex-1 pb-6">

      <div className="relative w-full overflow-hidden" style={{ height: "320px" }}>
        {loading ? (
          <div className="h-full w-full skeleton" />
        ) : (
          <DiningMap
            groups={groups}
            itemsByGroup={itemsByGroup}
            coordsByGroup={coordsByGroup}
            locationIdByGroup={locationIdByGroup}
            onLocationSelect={onLocationSelect}
            userLocation={userLocation}
            className="h-full w-full"
          />
        )}
      </div>

      <div className="px-5 pt-4">
        <h2 className="font-display text-[17px] font-extrabold text-ink">Dining Locations</h2>

        {loading ? (
          <div className="mt-3 flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-[16px] skeleton" />
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {groups.map((group) => {
              const locId = locationIdByGroup[group.name] ?? "";
              return (
                <div
                  key={group.name}
                  className="glass-panel rounded-[18px] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold text-ink">{group.name}</p>
                      {group.address && (
                        <p className="mt-0.5 text-[12px] text-ink-soft">{group.address}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        group.isOpen
                          ? "bg-carbs-soft text-carbs"
                          : "bg-surface-3 text-ink-faint"
                      }`}
                    >
                      {group.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>

                  {group.stations.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.stations.map((s) => (
                        <span
                          key={s.id}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            s.isOpen ? "bg-carbs-soft text-carbs" : "bg-surface-3 text-ink-faint"
                          }`}
                        >
                          {s.name.replace(group.name, "").replace(/[-_]/g, " ").trim() || s.name}
                          {s.hours ? ` · ${s.hours}` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    {(itemsByGroup[group.name]?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-ink-faint">
                        {itemsByGroup[group.name].length} items today
                      </p>
                    )}
                    {group.isOpen && locId && (
                      <button
                        onClick={() => onLocationSelect(locId)}
                        className="ml-auto rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-accent-contrast"
                      >
                        View menu →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
