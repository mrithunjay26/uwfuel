"use client";

import { useEffect, useRef } from "react";

export interface RoutePoint {
  lat: number;
  lng: number;
  label: string;
}

interface MealRouteMapProps {
  origin?: RoutePoint | null;
  destination: RoutePoint;
  color?: string;
  className?: string;
}

export function MealRouteMap({ origin, destination, color = "#6c5cf2", className }: MealRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    async function init() {
      const L = await import("leaflet");
      if (!containerRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const startIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const foodIcon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">🍽</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      L.marker([destination.lat, destination.lng], { icon: foodIcon }).addTo(map).bindPopup(destination.label);

      if (origin) {
        L.marker([origin.lat, origin.lng], { icon: startIcon }).addTo(map).bindPopup(origin.label);
        L.polyline(
          [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ],
          { color, weight: 3, opacity: 0.9, dashArray: "7 7" },
        ).addTo(map);
        map.fitBounds(
          [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ],
          { padding: [26, 26], maxZoom: 17 },
        );
      } else {
        map.setView([destination.lat, destination.lng], 16);
      }

      mapRef.current = map;
    }

    init();

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
