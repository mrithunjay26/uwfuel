"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Bike,
  Bus,
  CalendarCheck2,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Flame,
  Footprints,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Utensils,
} from "lucide-react";
import { useConfig }       from "@/lib/config/ConfigContext";
import { useUserDb }       from "@/lib/hooks/useUserDb";
import { useUserProfile }  from "@/lib/hooks/useUserProfile";
import { useClassSchedule } from "@/lib/hooks/useClassSchedule";
import { useActivePlan }   from "@/lib/hooks/useActivePlan";
import { usePlanRepo }     from "@/lib/hooks/usePlanRepo";
import {
  useGeolocation,
  haversineMetres,
  walkingMinutes,
} from "@/lib/hooks/useGeolocation";
import { callCohere } from "@/lib/ai/cohere";
import { extractJsonObject } from "@/lib/ai/json";
import { setActivePlan, clearActivePlan, savePlanToRepo, deletePlanFromRepo, logFoodItem } from "@/lib/db/userDb";
import {
  getDiningLocations,
  resolveMenuDate,
  getDiningMenu,
  todayPacificKey,
  type DiningLocation,
  type DiningLocationsSnapshot,
  type DiningMenuSnapshot,
} from "@/lib/firebase/dining";
import {
  flattenFullMenu,
  buildLocationGroups,
  buildLocationOpenMap,
  scoreMenuItem,
  filterMenuItems,
  type FlatMenuItem,
  type MenuFilter,
} from "@/lib/menu/flattenMenu";
import {
  dailyTargetCalories,
  formatMoney,
  estimateProteinGrams,
  estimateMacros,
} from "@/lib/utils/nutrition";
import {
  scheduleMealReminders,
  sendTestNotification,
  cancelMealReminders,
  requestNotificationPermission,
  notificationsGranted,
} from "@/lib/utils/notifications";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { MealRouteMap, type RoutePoint } from "@/components/app/MealRouteMap";
import type { ClassStop, MealPlan, PlanMeal, MealType } from "@/lib/db/types";
import type { PlanRepoItem } from "@/lib/hooks/usePlanRepo";

type PlanTab = "ai" | "manual";
const MEAL_COUNTS = [2, 3, 4, 5] as const;
type MealCount = typeof MEAL_COUNTS[number];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

interface ManualEntry {
  id:                   string;
  meal_type:            MealType;
  item_name:            string;
  location_name:        string;
  estimated_calories:   number;
  estimated_protein:    number;
  estimated_cost:       number;
  suggested_time:       string;
}

interface NearbyPick {
  item: FlatMenuItem;
  locationName: string;
  walkMin: number;
  distanceM: number;
  directionsUrl: string;
}

type TravelMode = "walking" | "bicycling" | "transit" | "driving";

interface ResolvedMealLocation {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  mapLat: number | null;
  mapLng: number | null;
}

interface MealRoute {
  destinationName: string;
  destinationParam: string;
  destination: RoutePoint | null;
  origin: RoutePoint | null;
  walkMin: number | null;
}

const TRAVEL_MODES: { id: TravelMode; label: string; Icon: typeof Footprints }[] = [
  { id: "walking", label: "Walk", Icon: Footprints },
  { id: "bicycling", label: "Bike", Icon: Bike },
  { id: "transit", label: "Transit", Icon: Bus },
  { id: "driving", label: "Drive", Icon: Car },
];

function mealDirectionsUrl(route: MealRoute, mode: TravelMode): string {
  const destination = encodeURIComponent(route.destinationParam);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${mode}`;
}

const MEAL_COLORS: Record<MealType, string> = {
  Breakfast: "text-peach",
  Lunch:     "text-carbs",
  Dinner:    "text-accent",
  Snack:     "text-protein",
};

const UW_CAMPUS_CENTER: RoutePoint = { lat: 47.6553, lng: -122.3035, label: "UW campus" };

const DINING_FALLBACK_COORDS: { tokens: string[]; lat: number; lng: number; label: string }[] = [
  { tokens: ["local", "point"], lat: 47.6557, lng: -122.3157, label: "Local Point" },
  { tokens: ["district", "market"], lat: 47.6556, lng: -122.3155, label: "District Market" },
  { tokens: ["center", "table"], lat: 47.6559, lng: -122.3168, label: "Center Table" },
  { tokens: ["cultivate"], lat: 47.6560, lng: -122.3169, label: "Cultivate" },
  { tokens: ["by", "george"], lat: 47.6566, lng: -122.3095, label: "By George" },
  { tokens: ["the", "8", "eight"], lat: 47.6604, lng: -122.3041, label: "The 8" },
  { tokens: ["orin"], lat: 47.6604, lng: -122.3041, label: "Orin's Place" },
  { tokens: ["husky", "den"], lat: 47.6554, lng: -122.3051, label: "Husky Den" },
  { tokens: ["hub"], lat: 47.6554, lng: -122.3051, label: "HUB" },
  { tokens: ["pagliacci"], lat: 47.6537, lng: -122.3175, label: "Pagliacci" },
  { tokens: ["mercer"], lat: 47.6537, lng: -122.3175, label: "Mercer Court Market" },
  { tokens: ["alder"], lat: 47.6531, lng: -122.3157, label: "Alder Commons" },
  { tokens: ["poplar"], lat: 47.6540, lng: -122.3160, label: "Poplar" },
  { tokens: ["elm"], lat: 47.6562, lng: -122.3172, label: "Elm Hall Market" },
  { tokens: ["maple"], lat: 47.6558, lng: -122.3166, label: "Maple Market" },
  { tokens: ["terry"], lat: 47.6562, lng: -122.3160, label: "Terry Market" },
];

const LOCATION_STOPWORDS = new Set(["the", "at", "uw", "cafe", "market", "dining", "hall", "and", "of", "court"]);

function locationTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !LOCATION_STOPWORDS.has(t));
}

function matchFallbackHall(query: string): RoutePoint | null {
  const qt = new Set(locationTokens(query));
  if (qt.size === 0) return null;
  let best: (typeof DINING_FALLBACK_COORDS)[number] | null = null;
  let bestScore = 0;
  for (const hall of DINING_FALLBACK_COORDS) {
    const shared = hall.tokens.filter((t) => qt.has(t)).length;
    if (shared > bestScore) { bestScore = shared; best = hall; }
  }
  return best && bestScore > 0 ? { lat: best.lat, lng: best.lng, label: best.label } : null;
}

const MIN_PICK_CALORIES = 150;
const CONDIMENT_WORDS = ["dip", "sauce", "dressing", "syrup", "spread", "condiment", "topping", "jam", "jelly", "butter", "mayo", "ketchup", "mustard", "side of", "packet", "creamer", "garnish"];

function isSubstantialFood(item: FlatMenuItem): boolean {
  if (item.is_beverage) return false;
  if (item.calories < MIN_PICK_CALORIES) return false;
  const name = item.name.toLowerCase();
  if (item.calories < 250 && CONDIMENT_WORDS.some((w) => name.includes(w))) return false;
  return true;
}

function parseClock(t: string): number {
  const m = (t || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function defaultTimeFor(type: MealType): string {
  switch (type) {
    case "Breakfast": return "8:00 AM";
    case "Dinner":    return "6:30 PM";
    case "Snack":     return "3:00 PM";
    case "Lunch":
    default:          return "12:00 PM";
  }
}

function to24h(t: string): string {
  try {
    const [time, ampm] = t.split(" ");
    const [h, m] = time.split(":").map(Number);
    const h24 = ampm === "PM" && h !== 12 ? h + 12 : ampm === "AM" && h === 12 ? 0 : h;
    return `${String(h24).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  } catch { return "12:00"; }
}

export default function PlanPage() {
  const { cohereKey, hasCohere, dailyBudget, setDailyBudget, remindersOn, setRemindersOn } = useConfig();
  const handle                  = useUserDb();
  const { profile }             = useUserProfile();
  const { todayStops }          = useClassSchedule();
  const { activePlan }          = useActivePlan();
  const today                   = todayPacificKey();
  const { plans: savedPlans, loading: plansLoading } = usePlanRepo(today);
  const {
    position: userGeo,
    loading: geoLoading,
    refresh: refreshGeo,
  } = useGeolocation(false);

  const budget = dailyBudget;

  const [planTab,      setPlanTab]      = useState<PlanTab>("ai");
  const [mealCount,    setMealCount]    = useState<MealCount>(3);
  const [customRequest, setCustomRequest] = useState("");
  const [nearbyOn,     setNearbyOn]     = useState(false);
  const [maxWalkMin,   setMaxWalkMin]   = useState(20);
  const [nearbyDiet,   setNearbyDiet]   = useState<MenuFilter>("all");
  const [showRepo,     setShowRepo]     = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [genError,     setGenError]     = useState<string | null>(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [loggedPick,   setLoggedPick]   = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setNotifGranted(notificationsGranted()); }, []);

  function stepBudget(delta: number) {
    const next = Math.max(3, Math.min(100, Math.round((budget + delta) * 100) / 100));
    setDailyBudget(next);
  }

  const [locations,  setLocations]  = useState<DiningLocationsSnapshot | null>(null);
  const [menuItems,  setMenuItems]  = useState<FlatMenuItem[]>([]);

  useEffect(() => {
    let gone = false;
    async function load() {
      try {
        const [locs, { dateKey }] = await Promise.all([getDiningLocations(), resolveMenuDate()]);
        if (gone) return;
        setLocations(locs);
        const menu = (await getDiningMenu(dateKey)) as DiningMenuSnapshot | null;
        if (gone) return;
        const locNames = Object.fromEntries(
          Object.entries(locs ?? {}).map(([id, l]) => [id, l.name]),
        );
        setMenuItems(flattenFullMenu(menu, locNames, buildLocationOpenMap(locs ?? {})));
      } catch {}
    }
    load();
    return () => { gone = true; };
  }, []);

  const phase      = profile?.phase ?? "maintain";
  const weight     = profile?.current_weight ?? 160;
  const weeklyRate = profile?.target_weekly_change_lbs ?? 0;
  const targetKcal = dailyTargetCalories(weight, weeklyRate);

  const nearbyPick = useMemo<NearbyPick | null>(() => {
    if (!userGeo || !locations || menuItems.length === 0) return null;

    const candidates = buildLocationGroups(locations)
      .filter((g) => g.isOpen)
      .flatMap((g) => {
        const loc = locations[g.stations[0]?.id];
        if (!loc?.latitude || !loc?.longitude) return [];
        const dist = haversineMetres(userGeo.lat, userGeo.lng, loc.latitude, loc.longitude);
        const stationIds = new Set(g.stations.map((s) => s.id));
        return [{ group: g, loc, dist, stationIds }];
      })
      .filter((c) => walkingMinutes(c.dist) <= maxWalkMin)
      .sort((a, b) => a.dist - b.dist);

    for (const cand of candidates.slice(0, 8)) {
      const pool = menuItems.filter(
        (i) =>
          cand.stationIds.has(i.location_id) &&
          i.available_now &&
          i.price > 0 &&
          i.price <= budget &&
          isSubstantialFood(i),
      );
      const dietPool = nearbyDiet === "all" ? pool : filterMenuItems(pool, nearbyDiet, "", false);
      const best = dietPool
        .sort((a, b) => scoreMenuItem(b, phase, budget) - scoreMenuItem(a, phase, budget))[0];

      if (best) {
        return {
          item: best,
          locationName: cand.group.name,
          walkMin: walkingMinutes(cand.dist),
          distanceM: Math.round(cand.dist),
          directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${userGeo.lat},${userGeo.lng}&destination=${cand.loc.latitude},${cand.loc.longitude}&travelmode=walking`,
        };
      }
    }
    return null;
  }, [userGeo, locations, menuItems, phase, budget, maxWalkMin, nearbyDiet]);

  useEffect(() => { setLoggedPick(false); }, [nearbyPick?.item.unique_key]);

  async function logNearbyPick() {
    if (!handle || !nearbyPick) return;
    const item = nearbyPick.item;
    const protein = item.protein_grams > 0
      ? item.protein_grams
      : estimateProteinGrams(item.name, item.description, item.calories);
    const macros = estimateMacros(item.calories, protein);
    await logFoodItem(handle.db, handle.uid, today, {
      name:          item.name,
      description:   item.description,
      calories:      item.calories,
      protein_grams: protein,
      carbs_grams:   (item.carbs_grams ?? 0) > 0 ? (item.carbs_grams as number) : macros.carbs,
      fat_grams:     (item.fat_grams ?? 0) > 0 ? (item.fat_grams as number) : macros.fat,
      price:         item.price,
      location_id:   item.location_id,
      location_name: item.location_name,
      is_custom:     false,
    });
    setLoggedPick(true);
  }

  const logMeal = useCallback(
    async (meal: PlanMeal) => {
      if (!handle) return;
      const protein = meal.estimated_protein || 0;
      const macros = estimateMacros(meal.estimated_calories, protein);
      await logFoodItem(handle.db, handle.uid, today, {
        name:          meal.item_name,
        description:   meal.location_name ? `From your ${meal.meal_type.toLowerCase()} plan` : "",
        calories:      meal.estimated_calories,
        protein_grams: protein,
        carbs_grams:   macros.carbs,
        fat_grams:     macros.fat,
        price:         meal.estimated_cost,
        location_id:   meal.location_id,
        location_name: meal.location_name,
        is_custom:     false,
      });
    },
    [handle, today],
  );

  const routeHints = useMemo(() => {
    if (!todayStops.length || !locations) return [];
    const openWithCoords = buildLocationGroups(locations)
      .filter((g) => g.isOpen)
      .flatMap((g) => {
        const loc = locations[g.stations[0]?.id];
        return loc?.latitude && loc?.longitude
          ? [{ name: g.name, lat: loc.latitude, lng: loc.longitude }]
          : [];
      });
    return todayStops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => {
        const nearest = openWithCoords
          .map((g) => ({
            name: g.name,
            walkMin: walkingMinutes(haversineMetres(s.lat!, s.lng!, g.lat, g.lng)),
          }))
          .sort((a, b) => a.walkMin - b.walkMin)[0];
        return nearest ? { stop: s, nearest } : null;
      })
      .filter((x): x is { stop: ClassStop; nearest: { name: string; walkMin: number } } => x !== null);
  }, [todayStops, locations]);

  const resolveMealLocation = useCallback(
    (meal: PlanMeal): ResolvedMealLocation | null => {
      if (!locations) return null;

      let loc: DiningLocation | null =
        meal.location_id && locations[meal.location_id] ? locations[meal.location_id] : null;

      if (!loc) {
        const q = (meal.location_name || "").toLowerCase().trim();
        if (q && q !== "uw dining") {
          const entries = Object.values(locations);
          loc =
            entries.find((l) => {
              const n = (l.name || "").toLowerCase();
              const g = (l.location_group || "").toLowerCase();
              return n === q || g === q || n.includes(q) || q.includes(n) || g.includes(q) || q.includes(g);
            }) ?? null;

          if (!loc) {
            const qt = locationTokens(q);
            let best: DiningLocation | null = null;
            let bestScore = 0;
            for (const l of entries) {
              const ct = locationTokens(`${l.name} ${l.location_group || ""}`);
              const shared = qt.filter((t) => ct.includes(t)).length;
              if (shared > bestScore) { bestScore = shared; best = l; }
            }
            if (best && bestScore > 0) loc = best;
          }
        }
      }

      if (!loc) return null;

      const lat = typeof loc.latitude === "number" ? loc.latitude : null;
      const lng = typeof loc.longitude === "number" ? loc.longitude : null;
      let mapLat = lat;
      let mapLng = lng;
      if (mapLat == null || mapLng == null) {
        const fb = matchFallbackHall(`${loc.location_group || ""} ${loc.name}`);
        if (fb) { mapLat = fb.lat; mapLng = fb.lng; }
      }

      return { name: loc.name, address: loc.address || null, lat, lng, mapLat, mapLng };
    },
    [locations],
  );

  const buildMealRoute = useCallback(
    (meal: PlanMeal): MealRoute | null => {
      const loc = resolveMealLocation(meal);
      if (!loc) return null;

      const destination: RoutePoint | null =
        loc.mapLat != null && loc.mapLng != null ? { lat: loc.mapLat, lng: loc.mapLng, label: loc.name } : null;

      const destinationParam =
        loc.lat != null && loc.lng != null
          ? `${loc.lat},${loc.lng}`
          : loc.address || `${loc.name}, University of Washington, Seattle, WA`;

      const geoNearCampus =
        userGeo &&
        haversineMetres(userGeo.lat, userGeo.lng, UW_CAMPUS_CENTER.lat, UW_CAMPUS_CENTER.lng) < 30_000;

      let origin: RoutePoint | null = null;
      if (geoNearCampus && userGeo) {
        origin = { lat: userGeo.lat, lng: userGeo.lng, label: "Your location" };
      } else {
        const mealMin = parseClock(meal.suggested_time);
        const stops = todayStops.filter((s) => s.lat != null && s.lng != null);
        let best: ClassStop | null = null;
        let bestDelta = Infinity;
        for (const s of stops) {
          const end = parseClock(s.end_time);
          const delta = mealMin >= 0 && end >= 0 ? mealMin - end : Infinity;
          if (delta >= 0 && delta < bestDelta) { bestDelta = delta; best = s; }
        }
        if (!best && stops.length) best = stops[0];
        if (best) origin = { lat: best.lat as number, lng: best.lng as number, label: best.building_label };
      }

      const walkMin =
        destination && origin
          ? walkingMinutes(haversineMetres(origin.lat, origin.lng, destination.lat, destination.lng))
          : null;

      return {
        destinationName: loc.name,
        destinationParam,
        destination,
        origin,
        walkMin,
      };
    },
    [resolveMealLocation, todayStops, userGeo],
  );

  const [manualMeals,  setManualMeals]  = useState<ManualEntry[]>([]);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [searchQ,        setSearchQ]        = useState("");
  const [manualMealType, setManualMealType] = useState<MealType>("Lunch");
  const [manualFilter,   setManualFilter]   = useState<"available" | "all" | "hi-protein" | "low-cal">("available");
  const [manualSort,     setManualSort]     = useState<"price" | "protein" | "calories">("price");

  const manualResults = useMemo(() => {
    let list = menuItems.filter((i) => !i.is_beverage);
    const q = searchQ.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.location_name.toLowerCase().includes(q) ||
          i.category_name.toLowerCase().includes(q),
      );
    }
    if (manualFilter === "available") list = list.filter((i) => i.available_now);
    else if (manualFilter === "hi-protein") list = list.filter((i) => i.protein_grams >= 20);
    else if (manualFilter === "low-cal") list = list.filter((i) => i.calories > 0 && i.calories < 450);
    list = [...list].sort((a, b) => {
      if (manualSort === "price") return (a.price || 999) - (b.price || 999);
      if (manualSort === "protein") return b.protein_grams - a.protein_grams;
      return b.calories - a.calories;
    });
    return list.slice(0, 60);
  }, [menuItems, searchQ, manualFilter, manualSort]);

  function addFromMenu(item: FlatMenuItem) {
    const protein = item.protein_grams > 0
      ? Math.round(item.protein_grams)
      : Math.round(estimateProteinGrams(item.name, item.description, item.calories));
    setManualMeals((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        meal_type: manualMealType,
        item_name: item.name,
        location_name: item.location_name,
        estimated_calories: Math.round(item.calories),
        estimated_protein: protein,
        estimated_cost: item.price,
        suggested_time: defaultTimeFor(manualMealType),
      },
    ]);
  }

  const [newMeal, setNewMeal] = useState<Omit<ManualEntry, "id">>({
    meal_type:          "Lunch",
    item_name:          "",
    location_name:      "",
    estimated_calories: 500,
    estimated_protein:  25,
    estimated_cost:     8,
    suggested_time:     "12:00 PM",
  });

  function addManualMeal() {
    if (!newMeal.item_name.trim()) return;
    setManualMeals((prev) => [
      ...prev,
      { id: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...newMeal },
    ]);
    setNewMeal({
      meal_type: "Lunch", item_name: "", location_name: "",
      estimated_calories: 500, estimated_protein: 25, estimated_cost: 8, suggested_time: "12:00 PM",
    });
    setShowAddForm(false);
  }

  async function saveManualPlan() {
    if (!handle || !manualMeals.length) return;
    const totals = manualMeals.reduce(
      (a, m) => ({
        calories: a.calories + m.estimated_calories,
        protein:  a.protein + m.estimated_protein,
        cost:     a.cost + m.estimated_cost,
      }),
      { calories: 0, protein: 0, cost: 0 },
    );
    const plan: MealPlan = {
      source:       "manual",
      title:        "My Manual Plan",
      summary:      `${manualMeals.length}-meal manual plan`,
      meals:        manualMeals.map((m): PlanMeal => ({
        meal_type:          m.meal_type,
        item_name:          m.item_name,
        location_id:        "",
        location_name:      m.location_name || "UW Dining",
        estimated_calories: m.estimated_calories,
        estimated_protein:  m.estimated_protein,
        estimated_cost:     m.estimated_cost,
        suggested_time:     m.suggested_time,
        reasoning:          "Manually added",
      })),
      daily_totals: totals,
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };
    const planId = await savePlanToRepo(handle.db, handle.uid, today, plan);
    await setActivePlan(handle.db, handle.uid, {
      plan_id:      planId,
      source:       "manual",
      title:        plan.title,
      date:         today,
      daily_totals: plan.daily_totals,
      meals:        plan.meals,
    });
    setManualMeals([]);
  }

  const buildPrompt = useCallback(() => {
    const budgetStr   = budget.toFixed(2);

    const candidates = menuItems
      .filter((i) => i.available_now && i.price > 0 && i.price <= budget && isSubstantialFood(i))
      .sort((a, b) => scoreMenuItem(b, phase, budget) - scoreMenuItem(a, phase, budget))
      .slice(0, 150);
    const sample = candidates
      .map((i) => `- ${i.name} @ ${i.location_name} — $${i.price.toFixed(2)}, ${i.calories} cal, ${Math.round(i.protein_grams)}g protein`)
      .join("\n");

    const nearbyCtx = nearbyOn && nearbyPick
      ? `User is near ${nearbyPick.locationName} (~${nearbyPick.walkMin} min walk). A good nearby option is ${nearbyPick.item.name} there.`
      : "";

    const classCtx = todayStops.length > 0
      ? `Today's classes: ${todayStops.map((s) => `${s.building_label} (${s.start_time}–${s.end_time})`).join("; ")}.`
      : "";

    const routeCtx = routeHints.length > 0
      ? `Routing: ${routeHints.map((r) => `after ${r.stop.building_label} (${r.stop.end_time}) → ${r.nearest.name} ~${r.nearest.walkMin} min walk`).join("; ")}.`
      : "";

    const requestCtx = customRequest.trim()
      ? `STUDENT'S SPECIAL REQUESTS — follow these closely (dietary needs, cuisines, allergies, dislikes, timing, etc.): ${customRequest.trim()}`
      : "";

    const system = `You are a UW Seattle campus nutrition AI that builds meal plans from a REAL menu.

━━━ HARD RULES ━━━
1. Choose ONLY items from the MENU list in the user message. Copy each item_name and location_name EXACTLY as written, character for character. NEVER invent, rename, paraphrase, merge, or guess items or locations (made-up places like "Pike Place" will be rejected).
2. Use each item's EXACT price from the list — NEVER change a price to make a plan fit.
3. The SUM of the chosen items' prices MUST be UNDER $${budgetStr}. Pick cheaper real items so the total fits.
4. If ${mealCount} meals can't fit under $${budgetStr}, return FEWER meals — never exceed the budget.
━━━━━━━━━━━━━━━━━

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "title": "string",
  "summary": "1–2 sentences describing why this plan fits the user's goals",
  "meals": [
    {
      "meal_type": "Breakfast" | "Lunch" | "Dinner" | "Snack",
      "item_name": "string",
      "location_name": "string",
      "estimated_calories": number,
      "estimated_protein": number,
      "estimated_cost": number,
      "suggested_time": "e.g. 8:00 AM",
      "reasoning": "string (1 sentence)"
    }
  ],
  "daily_totals": { "calories": number, "protein": number, "cost": number }
}`;

    const user = `HARD BUDGET CAP: $${budgetStr} TOTAL — DO NOT EXCEED.

Plan ${mealCount} meal(s) for today (${new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" })}).
Goal: ${phase} phase · ${targetKcal} kcal target · ${weight} lbs.
${requestCtx ? requestCtx + "\n" : ""}${nearbyCtx ? nearbyCtx + "\n" : ""}${classCtx ? classCtx + "\n" : ""}${routeCtx ? routeCtx + "\n" : ""}
MENU — choose ONLY from these real items and use their EXACT prices:
${sample || "(No menu items are available within this budget right now.)"}

Verify before submitting: every item and price is from the MENU above, and sum(estimated_cost) < $${budgetStr}. Prioritize high-protein for ${phase}.`;

    return [
      { role: "system" as const, content: system },
      { role: "user"   as const, content: user   },
    ];
  }, [budget, mealCount, menuItems, phase, weight, targetKcal, nearbyOn, nearbyPick, todayStops, routeHints, customRequest]);

  async function handleGenerate() {
    if (!handle || !cohereKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenerating(true);
    setGenError(null);

    try {
      const raw = await callCohere(cohereKey, buildPrompt(), { temperature: 0.6, signal: ctrl.signal });

      let p: {
        title?: string;
        summary?: string;
        meals?: Array<Partial<PlanMeal> & { meal_type?: string }>;
        daily_totals?: { calories?: number; protein?: number; cost?: number };
      };
      try {
        p = extractJsonObject(raw);
      } catch {
        throw new Error("AI returned invalid JSON. Please try again.");
      }

      const rawMeals = (p.meals || []) as Array<{
        meal_type?: string; item_name?: string; location_name?: string;
        estimated_calories?: number; estimated_protein?: number; estimated_cost?: number;
        suggested_time?: string; reasoning?: string;
      }>;

      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const byName = new Map<string, FlatMenuItem>();
      menuItems.forEach((i) => { const k = norm(i.name); if (k && !byName.has(k)) byName.set(k, i); });
      const matchItem = (name: string): FlatMenuItem | null => {
        const k = norm(name || "");
        if (!k) return null;
        if (byName.has(k)) return byName.get(k)!;
        return menuItems.find((i) => { const n = norm(i.name); return n && (n.includes(k) || k.includes(n)); }) || null;
      };

      let meals: PlanMeal[] = rawMeals.flatMap((m, i): PlanMeal[] => {
        const match = matchItem(m.item_name || "");
        if (!match) return [];
        return [{
          meal_type:          (MEAL_TYPES.includes(m.meal_type as MealType) ? m.meal_type : "Snack") as MealType,
          item_name:          match.name,
          location_id:        match.location_id,
          location_name:      match.location_name,
          estimated_calories: match.calories,
          estimated_protein:  Math.round(match.protein_grams),
          estimated_cost:     match.price,
          suggested_time:     m.suggested_time || `${8 + i * 4}:00 AM`,
          reasoning:          m.reasoning || "",
        }];
      });

      if (meals.length === 0) {
        throw new Error("The AI suggested items that aren't on today's menu. Tap Generate to try again.");
      }

      const droppedCount = rawMeals.length - meals.length;
      const sumCost = (arr: PlanMeal[]) => arr.reduce((s, m) => s + (m.estimated_cost || 0), 0);
      const originalCount = meals.length;
      while (meals.length > 1 && sumCost(meals) > budget) {
        let idx = 0;
        for (let j = 1; j < meals.length; j++) {
          if (meals[j].estimated_cost > meals[idx].estimated_cost) idx = j;
        }
        meals = meals.filter((_, j) => j !== idx);
      }
      const total = sumCost(meals);
      let budgetWarning: string | null = null;
      if (total > budget) {
        budgetWarning = `This plan is ${formatMoney(total)}, over your ${formatMoney(budget)} budget. Try regenerating or raising your budget.`;
      } else {
        const notes: string[] = [];
        if (meals.length < originalCount) {
          notes.push(`trimmed to ${meals.length} meal${meals.length === 1 ? "" : "s"} for your ${formatMoney(budget)} budget`);
        }
        if (droppedCount > 0) {
          notes.push(`skipped ${droppedCount} suggestion${droppedCount === 1 ? "" : "s"} not on today's menu`);
        }
        if (notes.length) budgetWarning = `Adjusted: ${notes.join(" and ")}.`;
      }

      const plan: MealPlan = {
        source:       "ai",
        title:        p.title   || `${mealCount}-Meal AI Plan`,
        summary:      p.summary || "",
        meals,
        daily_totals: {
          calories: meals.reduce((s, m) => s + m.estimated_calories, 0),
          protein:  meals.reduce((s, m) => s + m.estimated_protein,  0),
          cost:     parseFloat(total.toFixed(2)),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const planId = await savePlanToRepo(handle.db, handle.uid, today, plan);
      await setActivePlan(handle.db, handle.uid, {
        plan_id:      planId,
        source:       "ai",
        title:        plan.title,
        date:         today,
        daily_totals: plan.daily_totals,
        meals,
      });

      if (remindersOn && notifGranted) {
        await scheduleMealReminders(
          meals.map((m) => ({
            mealType:     m.meal_type,
            time:         to24h(m.suggested_time),
            locationName: m.location_name,
            itemName:     m.item_name,
          })),
        );
      }

      if (budgetWarning) setGenError(budgetWarning);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setGenError(err instanceof Error ? err.message : "Generation failed. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function activateSavedPlan(plan: PlanRepoItem) {
    if (!handle) return;
    await setActivePlan(handle.db, handle.uid, {
      plan_id:      plan.id,
      source:       plan.source,
      title:        plan.title,
      date:         today,
      daily_totals: plan.daily_totals,
      meals:        plan.meals,
    });
    setShowRepo(false);
  }

  async function deleteSavedPlan(plan: PlanRepoItem) {
    if (!handle) return;
    await deletePlanFromRepo(handle.db, handle.uid, today, plan.id).catch(() => {});
  }

  function editSavedPlan(plan: PlanRepoItem) {
    setManualMeals(
      (plan.meals ?? []).map((m): ManualEntry => ({
        id:                 `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        meal_type:          m.meal_type,
        item_name:          m.item_name,
        location_name:      m.location_name,
        estimated_calories: m.estimated_calories,
        estimated_protein:  m.estimated_protein,
        estimated_cost:     m.estimated_cost,
        suggested_time:     m.suggested_time,
      })),
    );
    setPlanTab("manual");
    setShowRepo(false);
  }

  async function handleClearPlan() {
    if (!handle) return;
    await clearActivePlan(handle.db, handle.uid);
    cancelMealReminders();
  }

  const remindersForPlan = useCallback(() => {
    if (!activePlan) return [];
    return activePlan.meals.map((m) => ({
      mealType:     m.meal_type,
      time:         to24h(m.suggested_time),
      locationName: m.location_name,
      itemName:     m.item_name,
    }));
  }, [activePlan]);

  async function handleToggleReminders() {
    if (!notifGranted) {
      const ok = await requestNotificationPermission();
      setNotifGranted(ok);
      if (!ok) return;
    }
    const next = !remindersOn;
    setRemindersOn(next);
    if (next) {
      await sendTestNotification();
      await scheduleMealReminders(remindersForPlan());
    } else {
      cancelMealReminders();
    }
  }

  useEffect(() => {
    if (remindersOn && notifGranted && activePlan) {
      scheduleMealReminders(remindersForPlan());
    }
  }, [remindersOn, notifGranted, activePlan, remindersForPlan]);

  function toggleNearby() {
    const next = !nearbyOn;
    setNearbyOn(next);
    if (next) refreshGeo();
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const manualTotal = manualMeals.reduce(
    (a, m) => ({ cal: a.cal + m.estimated_calories, cost: a.cost + m.estimated_cost }),
    { cal: 0, cost: 0 },
  );

  return (
    <div className="flex min-h-screen flex-col">

      <AuroraHeader
        title="Plan"
        subtitle={dateLabel}
        icon={<CalendarCheck2 className="size-[18px]" />}
        right={activePlan ? (
          <span className="rounded-full bg-success/20 px-2.5 py-1 text-[11px] font-bold text-success backdrop-blur-md">
            Plan active
          </span>
        ) : undefined}
      >
        <div className="glass-soft mt-3 flex gap-1 rounded-[16px] p-1">
          {(["ai", "manual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPlanTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2 text-[13px] font-bold transition ${
                planTab === t
                  ? "glass-strong text-ink shadow-[var(--shadow-sm)]"
                  : "text-ink-soft"
              }`}
            >
              {t === "ai"
                ? <><Sparkles className="size-3.5" /> AI Planner</>
                : <><Plus className="size-3.5" /> Manual</>}
            </button>
          ))}
        </div>
      </AuroraHeader>

      <div className="flex-1 px-5 pb-10 pt-4">

        {activePlan && (
          <section className="animate-pop mb-4 rounded-[22px] border border-success/30 bg-success/10 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-success">Today&apos;s active plan</p>
                <p className="mt-0.5 font-display text-[16px] font-extrabold text-ink">{activePlan.title}</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  {activePlan.daily_totals.calories} kcal · {activePlan.daily_totals.protein}g protein · {formatMoney(activePlan.daily_totals.cost)}
                </p>
              </div>
              <button
                onClick={handleClearPlan}
                className="shrink-0 text-[12px] font-semibold text-danger"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {activePlan.meals.map((meal, i) => (
                <MealRow key={i} meal={meal} route={buildMealRoute(meal)} onLog={logMeal} />
              ))}
            </div>
          </section>
        )}

        {planTab === "ai" && (
          <div className="flex flex-col gap-4">

            <section className="glass-panel rounded-[22px] p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-accent" />
                <p className="font-display text-[15px] font-bold text-ink">Daily budget cap</p>
                <span className="ml-auto text-[11px] font-semibold text-ink-soft">Hard limit for AI plans</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  onClick={() => stepBudget(-1)}
                  className="press grid size-9 place-items-center rounded-full bg-surface-2 text-ink-soft active:bg-surface-3"
                >
                  <Minus className="size-4" />
                </button>
                <div className="text-center">
                  <p className="font-display text-[28px] font-extrabold text-ink leading-none">
                    {formatMoney(budget)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">per day</p>
                </div>
                <button
                  onClick={() => stepBudget(1)}
                  className="press grid size-9 place-items-center rounded-full bg-surface-2 text-ink-soft active:bg-surface-3"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </section>

            <section className="glass-panel rounded-[22px] p-4">
              <p className="font-display text-[14px] font-bold text-ink">Meals per day</p>
              <div className="mt-2 flex gap-2">
                {MEAL_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setMealCount(n)}
                    className={`press flex-1 rounded-[12px] py-2.5 text-[15px] font-bold transition ${
                      mealCount === n ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-[22px] p-4">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-accent" />
                <p className="font-display text-[14px] font-bold text-ink">Custom requests</p>
                {customRequest.trim() && (
                  <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">On</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                Tell the AI anything — diet, allergies, cuisines, dislikes, timing. It&apos;ll factor this in.
              </p>
              <textarea
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. vegetarian, no nuts, prefer halal and spicy food, lighter dinner, more variety than usual…"
                className="mt-3 w-full resize-none rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Vegetarian", "High protein", "Halal", "More variety", "Spicy", "Quick & easy"].map((chip) => (
                  <button
                    key={chip}
                    onClick={() =>
                      setCustomRequest((prev) => {
                        const has = prev.toLowerCase().includes(chip.toLowerCase());
                        if (has) return prev;
                        return prev.trim() ? `${prev.trim()}, ${chip.toLowerCase()}` : chip;
                      })
                    }
                    className="press rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft active:bg-surface-3"
                  >
                    + {chip}
                  </button>
                ))}
                {customRequest && (
                  <button onClick={() => setCustomRequest("")} className="press rounded-full px-2.5 py-1 text-[11px] font-semibold text-danger">
                    Clear
                  </button>
                )}
              </div>
            </section>

            <section className="glass-panel rounded-[22px] p-4">
              <button onClick={toggleNearby} className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className={`size-4 ${nearbyOn ? "text-accent" : "text-ink-faint"}`} />
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-ink">Nearby pick</p>
                    <p className="text-[11px] text-ink-soft">
                      {nearbyOn ? "The closest good food to you, with directions" : "Find a specific dish near you"}
                    </p>
                  </div>
                </div>
                <div className={`relative h-6 w-11 rounded-full transition ${nearbyOn ? "bg-accent" : "bg-line-strong"}`}>
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{ left: nearbyOn ? "1.375rem" : "0.125rem" }}
                  />
                </div>
              </button>

              {nearbyOn && (
                <div className="mt-3">
                  <div className="mb-3 rounded-[14px] bg-surface-2 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                        <Footprints className="size-3.5 text-accent" /> Max walk
                      </span>
                      <span className="text-[12px] font-bold text-accent-ink">{maxWalkMin} min</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={45}
                      step={5}
                      value={maxWalkMin}
                      onChange={(e) => setMaxWalkMin(Number(e.target.value))}
                      className="mt-1.5 w-full accent-[var(--accent)]"
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                      <Utensils className="size-3" /> Diet preference
                    </p>
                    <div className="no-scrollbar -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1">
                      {([
                        ["all", "Any"],
                        ["hi-protein", "High protein"],
                        ["vegetarian", "Vegetarian"],
                        ["vegan", "Vegan"],
                        ["low-cal", "Low cal"],
                        ["halal", "Halal"],
                      ] as [MenuFilter, string][]).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setNearbyDiet(v)}
                          className={`press shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                            nearbyDiet === v ? "bg-accent text-accent-contrast" : "bg-surface text-ink-soft"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {geoLoading ? (
                    <div className="flex items-center gap-2 text-[12px] text-ink-soft">
                      <Loader2 className="size-3.5 animate-spin" /> Finding your location…
                    </div>
                  ) : nearbyPick ? (
                    <div className="animate-pop overflow-hidden rounded-[16px] border border-accent/20 bg-accent-soft/40">
                      <div className="flex items-start justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-accent-ink">
                            Closest match · {nearbyPick.locationName}
                          </p>
                          <p className="mt-0.5 truncate font-display text-[15px] font-extrabold text-ink">
                            {nearbyPick.item.name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-ink-soft">
                            <span className="flex items-center gap-0.5"><Flame className="size-3 text-flame" />{Math.round(nearbyPick.item.calories)}</span>
                            {nearbyPick.item.protein_grams > 0 && <span>{Math.round(nearbyPick.item.protein_grams)}g protein</span>}
                            <span>{formatMoney(nearbyPick.item.price)}</span>
                            <span className="flex items-center gap-0.5 text-accent-ink"><MapPin className="size-3" />{nearbyPick.walkMin} min walk</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 border-t border-accent/15 p-2.5">
                        <a
                          href={nearbyPick.directionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="press flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-accent py-2 text-[12px] font-bold text-accent-contrast"
                        >
                          <Navigation className="size-3.5" /> Directions
                        </a>
                        <button
                          onClick={logNearbyPick}
                          disabled={loggedPick || !handle}
                          className="press flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-surface py-2 text-[12px] font-bold text-ink disabled:opacity-60"
                        >
                          {loggedPick ? <><CheckCircle2 className="size-3.5 text-success" /> Logged</> : <><Plus className="size-3.5" /> Log it</>}
                        </button>
                      </div>
                    </div>
                  ) : !userGeo ? (
                    <button
                      onClick={refreshGeo}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-ink"
                    >
                      <RefreshCw className="size-3.5" /> Retry location
                    </button>
                  ) : (
                    <p className="text-[12px] text-ink-soft">
                      No open dining matched within {maxWalkMin} min{nearbyDiet !== "all" ? ` and your diet filter` : ""}. Try widening the walk radius or changing the diet filter.
                    </p>
                  )}
                </div>
              )}
            </section>

            {(todayStops.length > 0 || routeHints.length > 0) && (
              <section className="glass-panel rounded-[22px] p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-accent" />
                  <p className="font-display text-[14px] font-bold text-ink">Class routes</p>
                </div>

                {todayStops.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {todayStops.map((s) => (
                      <p key={s.id} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                        <Clock className="size-3 shrink-0" />
                        {s.building_label} · {s.start_time} to {s.end_time}
                      </p>
                    ))}
                  </div>
                )}

                {routeHints.length > 0 && (
                  <div className="glass-soft mt-3 flex flex-col gap-2 rounded-[14px] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">After class</p>
                    {routeHints.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-ink-soft">
                          After {r.stop.building_label} ({r.stop.end_time})
                        </span>
                        <span className="shrink-0 text-[12px] font-semibold text-ink">
                          {r.nearest.name} · {r.nearest.walkMin} min
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {routeHints.length === 0 && todayStops.some((s) => s.lat == null) && (
                  <p className="mt-2 text-[11px] text-ink-faint">
                    Add building coordinates in Profile → Class schedule to see walk times.
                  </p>
                )}
              </section>
            )}

            <section className="glass-panel rounded-[22px] p-4">
              <button onClick={handleToggleReminders} className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  {remindersOn && notifGranted
                    ? <Bell className="size-4 text-accent" />
                    : <BellOff className="size-4 text-ink-faint" />}
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-ink">Meal reminders</p>
                    <p className="text-[11px] text-ink-soft">
                      {notifGranted ? "30 min before each meal" : "Allow notifications to enable"}
                    </p>
                  </div>
                </div>
                <div className={`relative h-6 w-11 rounded-full transition ${remindersOn && notifGranted ? "bg-accent" : "bg-line-strong"}`}>
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{ left: remindersOn && notifGranted ? "1.375rem" : "0.125rem" }}
                  />
                </div>
              </button>
            </section>

            {profile && (
              <div className="glass-soft rounded-[16px] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Using your profile</p>
                <p className="mt-0.5 text-[13px] text-ink">
                  {profile.current_weight} lbs · {profile.phase} phase · {targetKcal} kcal target
                </p>
              </div>
            )}

            <section className="glass-panel overflow-hidden rounded-[22px]">
              <button
                onClick={() => setShowRepo(!showRepo)}
                className="flex w-full items-center justify-between px-4 py-3.5"
              >
                <span className="text-[14px] font-bold text-ink">Load saved plans</span>
                <div className="flex items-center gap-1.5 text-ink-soft">
                  {!plansLoading && savedPlans.length > 0 && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                      {savedPlans.length}
                    </span>
                  )}
                  {showRepo ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </button>

              {showRepo && (
                <div className="border-t border-line px-4 pb-4 pt-3">
                  {plansLoading ? (
                    <p className="text-[13px] text-ink-soft">Loading…</p>
                  ) : savedPlans.length === 0 ? (
                    <p className="text-[13px] text-ink-soft">No saved plans for today yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {savedPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex items-center gap-1 rounded-[12px] bg-surface-2 px-3 py-2.5"
                        >
                          <button
                            onClick={() => activateSavedPlan(plan)}
                            className="press min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-[13px] font-bold text-ink">{plan.title}</span>
                            <span className="block text-[11px] text-ink-soft">
                              {plan.daily_totals.calories} kcal · {formatMoney(plan.daily_totals.cost)} ·{" "}
                              {new Date(plan.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </button>
                          <button
                            onClick={() => editSavedPlan(plan)}
                            aria-label="Edit plan"
                            className="press grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:text-accent"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => deleteSavedPlan(plan)}
                            aria-label="Delete plan"
                            className="press grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {!hasCohere && (
              <div className="rounded-[16px] bg-peach-soft/70 px-4 py-3 backdrop-blur-md">
                <p className="text-[13px] font-bold text-ink">Add a Cohere AI key to generate plans</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  Go to Profile → AI key. Your key is only stored on this device.
                </p>
              </div>
            )}

            {genError && (
              <div className={`rounded-[14px] px-4 py-3 text-[13px] font-semibold ${
                genError.includes("over your") ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
              }`}>
                {genError}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || !hasCohere || !handle}
              className="press flex w-full items-center justify-center gap-2 rounded-[18px] bg-accent py-4 text-[15px] font-bold text-accent-contrast shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating… stay under {formatMoney(budget)}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {activePlan ? "Regenerate plan" : `Generate ${mealCount}-meal plan`}
                </>
              )}
            </button>

          </div>
        )}

        {planTab === "manual" && (
          <div className="flex flex-col gap-4">

            {manualMeals.length > 0 && (
              <section className="glass-panel rounded-[22px] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display text-[15px] font-bold text-ink">Your meals</p>
                  <p className="text-[12px] text-ink-soft">
                    {manualTotal.cal} kcal · {formatMoney(manualTotal.cost)}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {manualMeals.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold uppercase ${MEAL_COLORS[m.meal_type]}`}>
                            {m.meal_type}
                          </span>
                          <span className="text-[10px] text-ink-faint">{m.suggested_time}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] font-semibold text-ink">{m.item_name}</p>
                        <p className="text-[11px] text-ink-soft">{m.location_name || "N/A"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[12px] font-bold text-ink">{m.estimated_calories} cal</p>
                        <p className="text-[11px] text-ink-soft">{formatMoney(m.estimated_cost)}</p>
                      </div>
                      <button
                        onClick={() => setManualMeals((p) => p.filter((x) => x.id !== m.id))}
                        className="grid size-7 place-items-center rounded-full text-ink-faint active:bg-danger/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {manualTotal.cost > budget && (
                  <p className="mt-2 text-[11px] font-semibold text-danger">
                    ⚠ Over your {formatMoney(budget)} budget by {formatMoney(manualTotal.cost - budget)}
                  </p>
                )}

                <button
                  onClick={saveManualPlan}
                  disabled={!handle}
                  className="press mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3 text-[14px] font-bold text-accent-contrast disabled:opacity-50"
                >
                  <CalendarCheck2 className="size-4" />
                  Save as today&apos;s plan
                </button>
              </section>
            )}

            <section className="glass-panel rounded-[22px] p-4">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-accent" />
                <p className="font-display text-[15px] font-bold text-ink">Search dining options</p>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                Pick real items from today&apos;s menu, sorted by price, protein, or calories.
              </p>

              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search food or location…"
                  className="w-full rounded-[12px] border border-line bg-surface-2 py-2.5 pl-9 pr-3 text-[13px] text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="mt-2.5 flex gap-1.5">
                {MEAL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setManualMealType(t)}
                    className={`flex-1 rounded-[10px] py-1.5 text-[11px] font-bold transition ${
                      manualMealType === t ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto">
                {([["available", "Open now"], ["all", "All"], ["hi-protein", "Hi-protein"], ["low-cal", "Low cal"]] as const).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setManualFilter(v)}
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      manualFilter === v ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {l}
                  </button>
                ))}
                <span className="ml-1 shrink-0 text-[10px] font-semibold text-ink-faint">sort</span>
                {([["price", "$"], ["protein", "Pro"], ["calories", "Cal"]] as const).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setManualSort(v)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      manualSort === v ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="thin-scrollbar mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {manualResults.length === 0 ? (
                  <p className="py-5 text-center text-[12px] text-ink-faint">
                    {menuItems.length === 0 ? "Loading menu…" : "No matches. Try a different search or filter."}
                  </p>
                ) : (
                  manualResults.map((it) => (
                    <div key={it.unique_key} className="flex items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{it.name}</p>
                        <p className="truncate text-[11px] text-ink-soft">
                          {it.location_name}{it.available_now ? "" : " · closed"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-ink-soft">
                        <p className="font-bold text-ink">{it.price > 0 ? `$${it.price.toFixed(2)}` : "N/A"}</p>
                        <p>{Math.round(it.calories)} cal · {Math.round(it.protein_grams)}g</p>
                      </div>
                      <button
                        onClick={() => addFromMenu(it)}
                        aria-label={`Add ${it.name}`}
                        className="press grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            {showAddForm ? (
              <section className="glass-panel rounded-[22px] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display text-[15px] font-bold text-ink">Add a custom item</p>
                  <button onClick={() => setShowAddForm(false)} className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-soft">
                    <ChevronUp className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex gap-1.5">
                  {MEAL_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewMeal((p) => ({ ...p, meal_type: t }))}
                      className={`flex-1 rounded-[10px] py-1.5 text-[11px] font-bold transition ${
                        newMeal.meal_type === t
                          ? "bg-accent text-accent-contrast"
                          : "bg-surface-2 text-ink-soft"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <label className="mt-3 block text-[12px] font-semibold text-ink-soft">Item name</label>
                <input
                  type="text"
                  value={newMeal.item_name}
                  onChange={(e) => setNewMeal((p) => ({ ...p, item_name: e.target.value }))}
                  placeholder="e.g. Teriyaki Chicken Bowl"
                  className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                />

                <label className="mt-2.5 block text-[12px] font-semibold text-ink-soft">Location (optional)</label>
                <input
                  type="text"
                  value={newMeal.location_name}
                  onChange={(e) => setNewMeal((p) => ({ ...p, location_name: e.target.value }))}
                  placeholder="e.g. Alder Hall Dining"
                  className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                />

                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "estimated_calories", label: "Cal",     min: 0, max: 2000, step: 50 },
                      { key: "estimated_protein",  label: "Protein g", min: 0, max: 100, step: 5  },
                      { key: "estimated_cost",     label: "Cost $",  min: 0, max: 50,  step: 0.5 },
                    ] as const
                  ).map(({ key, label, min, max, step }) => (
                    <div key={key}>
                      <label className="block text-[11px] font-semibold text-ink-soft">{label}</label>
                      <input
                        type="number"
                        value={newMeal[key]}
                        min={min} max={max} step={step}
                        onChange={(e) => setNewMeal((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                        className="mt-1 w-full rounded-[10px] border border-line bg-surface-2 px-2 py-1.5 text-center text-[13px] text-ink outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>

                <label className="mt-2.5 block text-[12px] font-semibold text-ink-soft">Suggested time</label>
                <input
                  type="text"
                  value={newMeal.suggested_time}
                  onChange={(e) => setNewMeal((p) => ({ ...p, suggested_time: e.target.value }))}
                  placeholder="e.g. 12:00 PM"
                  className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                />

                <button
                  onClick={addManualMeal}
                  disabled={!newMeal.item_name.trim()}
                  className="press mt-3 flex w-full items-center justify-center gap-2 rounded-[13px] bg-accent py-3 text-[14px] font-bold text-accent-contrast disabled:opacity-50"
                >
                  <Plus className="size-4" /> Add meal
                </button>
              </section>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="press flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-line-strong py-3 text-[13px] font-bold text-ink-soft"
              >
                <Plus className="size-4" />
                Add a custom item (not on the menu)
              </button>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function MealRow({
  meal,
  route,
  onLog,
}: {
  meal: PlanMeal;
  route?: MealRoute | null;
  onLog?: (meal: PlanMeal) => Promise<void>;
}) {
  const [showMap, setShowMap] = useState(false);
  const [mode, setMode] = useState<TravelMode>("walking");
  const [logState, setLogState] = useState<"idle" | "logging" | "logged">("idle");

  async function handleLog() {
    if (!onLog || logState !== "idle") return;
    setLogState("logging");
    try {
      await onLog(meal);
      setLogState("logged");
    } catch {
      setLogState("idle");
    }
  }

  return (
    <div className="glass-soft rounded-[12px] px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wide ${MEAL_COLORS[meal.meal_type] ?? "text-ink-soft"}`}>
              {meal.meal_type}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-ink-faint">
              <Clock className="size-2.5" /> {meal.suggested_time}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] font-bold text-ink">{meal.item_name}</p>
          <p className="text-[11px] text-ink-soft">{meal.location_name}</p>
          {meal.reasoning && (
            <p className="mt-0.5 text-[10px] italic text-ink-faint">{meal.reasoning}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-bold text-ink">{meal.estimated_calories} cal</p>
          <p className="text-[11px] text-ink-soft">{formatMoney(meal.estimated_cost)}</p>
        </div>
      </div>

      {onLog && (
        <button
          onClick={handleLog}
          disabled={logState !== "idle"}
          className={`press mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12px] font-bold transition disabled:opacity-80 ${
            logState === "logged" ? "bg-success/15 text-success" : "bg-surface-2 text-ink"
          }`}
        >
          {logState === "logged" ? (
            <><CheckCircle2 className="size-3.5" /> Added to journal</>
          ) : logState === "logging" ? (
            <><Loader2 className="size-3.5 animate-spin" /> Logging…</>
          ) : (
            <><Plus className="size-3.5" /> Log to journal</>
          )}
        </button>
      )}

      {route && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-1">
            {TRAVEL_MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                aria-label={`${label} directions`}
                className={`flex flex-1 items-center justify-center gap-1 rounded-[9px] py-1.5 text-[10px] font-bold transition ${
                  mode === id ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"
                }`}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={mealDirectionsUrl(route, mode)}
              target="_blank"
              rel="noreferrer"
              className="press flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-accent py-2 text-[12px] font-bold text-accent-contrast"
            >
              <Navigation className="size-3.5" />
              Directions
              {route.walkMin != null && mode === "walking" ? ` · ${route.walkMin} min walk` : ""}
            </a>
            {route.destination && (
              <button
                onClick={() => setShowMap((s) => !s)}
                aria-label={showMap ? "Hide map" : "Show map"}
                className="press flex shrink-0 items-center gap-1 rounded-[10px] bg-surface-2 px-3 py-2 text-[12px] font-bold text-ink-soft"
              >
                <MapPin className="size-3.5 text-accent" />
                {showMap ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            )}
          </div>

          {showMap && route.destination && (
            <div className="overflow-hidden rounded-[12px] border border-line" style={{ height: "150px" }}>
              <MealRouteMap origin={route.origin} destination={route.destination} className="h-full w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
