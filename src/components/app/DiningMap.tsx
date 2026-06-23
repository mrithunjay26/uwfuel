"use client";

import { useEffect, useRef } from "react";
import type { LocationGroup, FlatMenuItem } from "@/lib/menu/flattenMenu";

interface DiningMapProps {
  groups: LocationGroup[];
  itemsByGroup: Record<string, FlatMenuItem[]>;
  coordsByGroup: Record<string, { lat: number; lng: number } | null>;
  locationIdByGroup: Record<string, string>;
  onLocationSelect?: (locationId: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
}

const UW_CENTER: [number, number] = [47.6553, -122.3035];
const UW_ZOOM = 15;

export function DiningMap({
  groups,
  itemsByGroup,
  coordsByGroup,
  locationIdByGroup,
  onLocationSelect,
  userLocation,
  className,
}: DiningMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const userMarkerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    async function init() {
      try {
        const L = await import("leaflet");
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        if (!containerRef.current) return;
        const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false })
          .setView(UW_CENTER, UW_ZOOM);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        groups.forEach((group) => {
          const coords = coordsByGroup[group.name];
          if (!coords) return;

          const items = itemsByGroup[group.name] ?? [];
          const topItems = items.slice(0, 5);
          const statusColor = group.isOpen ? "#22c55e" : "#9a97ac";
          const statusLabel = group.isOpen ? "Open now" : "Closed";
          const bgColor = group.isOpen ? "#7c6cf0" : "#9a97ac";
          const locId = locationIdByGroup[group.name] || "";

          const icon = L.divIcon({
            className: "",
            html: `<div style="background:${bgColor};color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,0.35);border:2px solid #fff;">🍽</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          const viewMenuBtn = group.isOpen && locId
            ? `<button
                onclick="window.__diningMapSelect && window.__diningMapSelect('${locId}')"
                style="margin-top:8px;width:100%;background:#7c6cf0;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:700;cursor:pointer;">
                View menu →
              </button>`
            : "";

          const popupHtml = `
            <div style="font-family:system-ui,sans-serif;min-width:190px;max-width:250px">
              <div style="font-weight:800;font-size:14px;margin-bottom:4px">${group.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};display:inline-block"></span>
                <span style="font-size:12px;font-weight:600;color:${statusColor}">${statusLabel}</span>
              </div>
              ${topItems.length > 0 ? `
                <div style="font-size:11px;font-weight:700;color:#6b6880;margin-bottom:4px">TODAY'S MENU</div>
                ${topItems.map(i => `
                  <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f0f0f0">
                    <span style="font-size:12px;font-weight:600">${i.name.slice(0, 26)}${i.name.length > 26 ? "…" : ""}</span>
                    <span style="font-size:11px;color:#888;margin-left:6px">${i.calories ? i.calories + " cal" : ""}</span>
                  </div>`).join("")}
              ` : `<div style="font-size:12px;color:#9a97ac">No menu data today</div>`}
              ${viewMenuBtn}
            </div>`;

          const marker = L.marker([coords.lat, coords.lng], { icon });
          marker.bindPopup(popupHtml, { maxWidth: 270, offset: [0, -8] });
          marker.addTo(map);
        });

        mapRef.current = map;
      } catch (e) {
        console.warn("Leaflet failed to load:", e);
      }
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    init();

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as Record<string, unknown>).__diningMapSelect = (locId: string) => {
      onLocationSelect?.(locId);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__diningMapSelect;
    };
  }, [onLocationSelect]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    import("leaflet").then((L) => {
      const map = mapRef.current as ReturnType<typeof L.map>;

      if (userMarkerRef.current) {
        (userMarkerRef.current as { remove: () => void }).remove();
        userMarkerRef.current = null;
      }

      const userIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative">
          <div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.3);animation:pulse 2s infinite"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
        title: "Your location",
      }).addTo(map);
      marker.bindPopup("<b>You are here</b>");
      userMarkerRef.current = marker;
    }).catch(() => {});
  }, [userLocation]);

  return (
    <div ref={containerRef} className={className} style={{ zIndex: 0 }} />
  );
}
