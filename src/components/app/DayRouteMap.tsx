"use client";

import { useEffect, useMemo, useRef } from "react";

export interface DayRoutePoint {
  lat: number;
  lng: number;
  label: string;
  time?: string;
}

interface DayRouteMapProps {
  points: DayRoutePoint[];
  color?: string;
  className?: string;
}

export function DayRouteMap({ points, color = "#6c5cf2", className }: DayRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  const pointsKey = useMemo(
    () => points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)},${p.label}`).join("|"),
    [points],
  );

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const latlngs: [number, number][] = points.map((p) => [p.lat, p.lng]);

      points.forEach((p, i) => {
        const isFirst = i === 0;
        const isLast = i === points.length - 1;
        const ring = isFirst ? "#2fa861" : isLast ? "#df4d57" : color;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${i + 1}. ${p.label}</b>${p.time ? `<br/>${p.time}` : ""}`);
      });

      if (latlngs.length >= 2) {
        L.polyline(latlngs, { color, weight: 3, opacity: 0.85, dashArray: "6 8" }).addTo(map);
        map.fitBounds(latlngs, { padding: [34, 34], maxZoom: 16 });
      } else {
        map.setView(latlngs[0], 16);
      }

      mapRef.current = map;
    }

    init();

    return () => {
      cancelled = true;
      if (map) { map.remove(); }
      mapRef.current = null;
    };
  }, [pointsKey, points, color]);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
