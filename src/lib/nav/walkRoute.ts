import { cacheRead, cacheWrite } from "@/lib/offline/cache";
import { haversineMetres } from "@/lib/geo/distance";

const OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
const ROUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WALK_METRES_PER_SEC = 1.35;

export interface LatLng { lat: number; lng: number }

export interface WalkStep {
  text: string;
  metres: number;
}

export interface WalkRoute {
  coords: [number, number][];
  metres: number;
  seconds: number;
  steps: WalkStep[];
  source: "osrm" | "direct";
}

function directRoute(from: LatLng, to: LatLng): WalkRoute {
  const metres = haversineMetres(from.lat, from.lng, to.lat, to.lng);
  return {
    coords: [[from.lat, from.lng], [to.lat, to.lng]],
    metres,
    seconds: metres / WALK_METRES_PER_SEC,
    steps: [],
    source: "direct",
  };
}

function keyFor(from: LatLng, to: LatLng): string {
  const r = (n: number) => n.toFixed(4);
  return `route:${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}`;
}

interface OsrmResponse {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: {
      steps?: {
        distance?: number;
        name?: string;
        maneuver?: { type?: string; modifier?: string };
      }[];
    }[];
  }[];
}

function describeStep(type: string | undefined, modifier: string | undefined, name: string): string {
  const where = name ? ` onto ${name}` : "";
  switch (type) {
    case "depart": return name ? `Head out along ${name}` : "Start walking";
    case "arrive": return "Arrive at your destination";
    case "roundabout":
    case "rotary": return `Take the roundabout${where}`;
    case "new name": return name ? `Continue onto ${name}` : "Continue straight";
    case "continue": return name ? `Continue on ${name}` : "Continue straight";
    default: {
      if (!modifier || modifier === "straight") return name ? `Continue on ${name}` : "Continue straight";
      const dir = modifier.replace("slight ", "slight ").replace("sharp ", "sharp ");
      return `Turn ${dir}${where}`;
    }
  }
}

export async function fetchWalkRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<WalkRoute> {
  const key = keyFor(from, to);
  const cached = cacheRead<WalkRoute & { _t?: number }>(key);
  if (cached && Array.isArray(cached.coords) && cached.coords.length > 1) return cached;

  const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}`
    + `?overview=full&geometries=geojson&steps=true&alternatives=false`;

  try {
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(7000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return directRoute(from, to);
    const data = (await res.json()) as OsrmResponse;
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !coordinates || coordinates.length < 2) return directRoute(from, to);

    const steps: WalkStep[] = (route?.legs?.[0]?.steps ?? [])
      .map((s) => ({
        text: describeStep(s.maneuver?.type, s.maneuver?.modifier, (s.name ?? "").trim()),
        metres: Math.round(s.distance ?? 0),
      }))
      .filter((s, i, arr) => s.text && (i === 0 || s.metres > 5 || i === arr.length - 1))
      .slice(0, 25);

    const out: WalkRoute = {
      coords: coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      metres: Math.round(route?.distance ?? 0),
      seconds: Math.round(route?.duration ?? 0),
      steps,
      source: "osrm",
    };
    cacheWrite(key, out);
    return out;
  } catch {
    return directRoute(from, to);
  }
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function walkMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

export function bearing(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export { ROUTE_TTL_MS };
