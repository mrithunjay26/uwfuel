"use client";

import { useEffect, useRef, useState } from "react";
import { fanOutOffsets } from "@/lib/geo/fanOut";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { DayEvent } from "@/lib/schedule/dayPlan";
import type { GeoPosition } from "@/lib/hooks/useGeolocation";
import { CAMPUS_CENTER } from "@/lib/campus/buildings";
import { tileConfig } from "@/lib/map/tiles";

const KIND_COLOR: Record<string, string> = {
  class: "#6c5cf2",
  meal: "#f0883e",
  workout: "#22c55e",
  study: "#9a97ac",
  home: "#d8558f",
  gym: "#059669",
  club: "#a855f7",
  activity: "#0ea5e9",
};

const KIND_GLYPH: Record<string, string> = {
  class: "🎓",
  meal: "🍽",
  workout: "🏋",
  study: "📚",
  home: "🏠",
  gym: "💪",
  club: "🎭",
  activity: "📌",
};

interface CampusRouteMapProps {
  stops: DayEvent[];
  activeIndex: number;
  user: GeoPosition | null;
  routeCoords?: [number, number][] | null;
  follow?: boolean;
  className?: string;
  onSelectStop?: (index: number) => void;
  zoomControl?: boolean;
  scrollZoom?: boolean;
  focusActive?: boolean;
  padTop?: number;
  padBottom?: number;
}

export function CampusRouteMap({
  stops,
  activeIndex,
  user,
  routeCoords,
  follow = true,
  className,
  onSelectStop,
  zoomControl = true,
  scrollZoom = false,
  focusActive = false,
  padTop = 40,
  padBottom = 40,
}: CampusRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const stopsLayerRef = useRef<LayerGroup | null>(null);
  const routeLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const fittedSigRef = useRef("");
  const selectRef = useRef(onSelectStop);
  selectRef.current = onSelectStop;
  const [ready, setReady] = useState(false);

  const stopsSig = stops.filter((s) => s.place).map((s) => s.id).join("|");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: scrollZoom,
        attributionControl: false,
      }).setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 15);

      const tiles = tileConfig();
      L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom }).addTo(map);
      if (zoomControl) L.control.zoom({ position: "bottomright" }).addTo(map);

      stopsLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);

      resizeTimer = setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        stopsLayerRef.current = null;
        routeLayerRef.current = null;
        userLayerRef.current = null;
      }
      fittedSigRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = stopsLayerRef.current;
    if (!ready || !map || !layer) return;

    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();

      const located = stops.filter((s) => s.place);
      const fanned = fanOutOffsets(located.map((s) => s.place));
      located.forEach((stop, i) => {
        const place = stop.place!;
        const spread = fanned.get(i);
        const markerLat = spread ? spread[0] : place.lat;
        const markerLng = spread ? spread[1] : place.lng;
        const isActive = stops.indexOf(stop) === activeIndex;
        const color = KIND_COLOR[stop.kind] ?? "#6c5cf2";
        const size = isActive ? 40 : 32;
        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:${size}px;height:${size}px">
            <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};
              display:flex;align-items:center;justify-content:center;font-size:${isActive ? 16 : 13}px;
              border:${isActive ? 3 : 2}px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);
              ${isActive ? "outline:3px solid rgba(108,92,242,.35);" : ""}">${KIND_GLYPH[stop.kind] ?? "📍"}</div>
            <div style="position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 3px;
              border-radius:8px;background:#fff;color:${color};font:700 10px/16px system-ui;
              text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">${i + 1}</div>
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([markerLat, markerLng], { icon, zIndexOffset: isActive ? 500 : 0 })
          .bindPopup(
            `<div style="font-family:system-ui,sans-serif;min-width:150px">
              <div style="font-weight:800;font-size:13px">${stop.title}</div>
              <div style="font-size:11px;color:#6b6880;margin-top:2px">${place.label}</div>
            </div>`,
            { offset: [0, -8] },
          )
          .addTo(layer);
        marker.on("click", () => selectRef.current?.(stops.indexOf(stop)));
      });

      if (located.length > 1) {
        L.polyline(
          located.map((s) => [s.place!.lat, s.place!.lng] as [number, number]),
          { color: "#6c5cf2", weight: 2, opacity: 0.35, dashArray: "6 8" },
        ).addTo(layer);
      }

      if (!focusActive && located.length > 0 && fittedSigRef.current !== stopsSig) {
        fittedSigRef.current = stopsSig;
        const bounds = L.latLngBounds(located.map((s) => [s.place!.lat, s.place!.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
    })();

    return () => { cancelled = true; };
  }, [ready, stops, stopsSig, activeIndex, focusActive]);

  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!ready || !layer) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      if (!routeCoords || routeCoords.length < 2) return;
      L.polyline(routeCoords, { color: "#6c5cf2", weight: 5, opacity: 0.9, lineCap: "round" }).addTo(layer);
      L.polyline(routeCoords, { color: "#fff", weight: 2, opacity: 0.7, dashArray: "1 10", lineCap: "round" }).addTo(layer);
    })();
    return () => { cancelled = true; };
  }, [ready, routeCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusActive || follow) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const stop = stops[activeIndex];
      if (routeCoords && routeCoords.length > 1) {
        map.fitBounds(L.latLngBounds(routeCoords), {
          paddingTopLeft: [32, padTop],
          paddingBottomRight: [32, padBottom],
          maxZoom: 18,
        });
      } else if (stop?.place) {
        map.setView([stop.place.lat, stop.place.lng], Math.max(map.getZoom(), 17), { animate: true });
      }
    })();
    return () => { cancelled = true; };
  }, [ready, focusActive, follow, activeIndex, routeCoords, stops, padTop, padBottom]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = userLayerRef.current;
    if (!ready || !map || !layer || !user) return;

    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();

      if (user.accuracy && user.accuracy < 500) {
        L.circle([user.lat, user.lng], {
          radius: user.accuracy,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
          weight: 1,
          opacity: 0.3,
        }).addTo(layer);
      }

      L.marker([user.lat, user.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,.25)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        zIndexOffset: 1000,
      }).addTo(layer);

      if (follow) map.panTo([user.lat, user.lng], { animate: true });
    })();

    return () => { cancelled = true; };
  }, [ready, user, follow]);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
