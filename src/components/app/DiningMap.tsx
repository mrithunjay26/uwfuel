"use client";

import { useEffect, useRef } from "react";
import { diningStatus } from "@/lib/dining/status";
import type { LocationGroup, FlatMenuItem } from "@/lib/menu/flattenMenu";
import { tileConfig } from "@/lib/map/tiles";

interface DiningMapProps {
  groups: LocationGroup[];
  itemsByGroup: Record<string, FlatMenuItem[]>;
  coordsByGroup: Record<string, { lat: number; lng: number } | null>;
  locationIdByGroup: Record<string, string>;
  onLocationSelect?: (locationId: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
  scrollZoom?: boolean;
  zoomControl?: boolean;
}

const UW_CENTER: [number, number] = [47.6553, -122.3035];
const UW_ZOOM = 15;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function DiningMap({
  groups,
  itemsByGroup,
  coordsByGroup,
  locationIdByGroup,
  onLocationSelect,
  userLocation,
  className,
  scrollZoom = false,
  zoomControl = true,
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
        const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: scrollZoom })
          .setView(UW_CENTER, UW_ZOOM);

        const tiles = tileConfig();
        L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom }).addTo(map);
        if (zoomControl) L.control.zoom({ position: "bottomright" }).addTo(map);

        const now = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", hour12: false })
          .formatToParts(new Date())
          .reduce<Record<string, string>>((acc, p) => { if (p.type !== "literal") acc[p.type] = p.value; return acc; }, {});
        const nowMin = (parseInt(now.hour ?? "0", 10) || 0) * 60 + (parseInt(now.minute ?? "0", 10) || 0);

        groups.forEach((group) => {
          const coords = coordsByGroup[group.name];
          if (!coords) return;

          const items = itemsByGroup[group.name] ?? [];
          const topItems = items.slice(0, 5);
          const hoursText = (group.stations.find((sta) => sta.isOpen) ?? group.stations[0])?.hours;
          const st = diningStatus(hoursText || undefined, nowMin);
          const openish = st.state === "unknown" ? group.isOpen : (st.state === "open" || st.state === "closing_soon");
          const statusColor = st.state === "open" ? "#22c55e" : st.state === "closing_soon" ? "#e0883f" : "#9a97ac";
          const statusLabel = st.state === "unknown" ? (group.isOpen ? "Open now" : "Closed") : st.label;
          const bgColor = openish ? "#7c6cf0" : "#9a97ac";
          const locId = locationIdByGroup[group.name] || "";
          const name = escapeHtml(group.name);
          const directions = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=walking`;

          const icon = L.divIcon({
            className: "",
            html: `<div style="background:${bgColor};color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,0.35);border:2px solid #fff;">🍽</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          const viewMenuBtn = openish && locId
            ? `<button
                onclick="window.__diningMapSelect && window.__diningMapSelect('${locId}')"
                style="margin-top:8px;width:100%;background:#f1f0fb;color:#4f3fd0;border:none;border-radius:10px;padding:7px 0;font-size:12px;font-weight:700;cursor:pointer;">
                See the full menu
              </button>`
            : "";

          const popupHtml = `
            <div style="font-family:system-ui,sans-serif;min-width:200px;max-width:250px">
              <div style="font-weight:800;font-size:14px;margin-bottom:6px">${name}</div>
              <a href="${directions}" target="_blank" rel="noreferrer"
                 style="display:flex;align-items:center;justify-content:center;gap:6px;background:#6c5cf2;color:#fff;border-radius:10px;padding:8px 0;font-size:12px;font-weight:700;text-decoration:none;margin-bottom:8px">
                ➜ Walk me there
              </a>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};display:inline-block"></span>
                <span style="font-size:12px;font-weight:600;color:${statusColor}">${statusLabel}</span>
              </div>
              ${topItems.length > 0 ? `
                <div style="font-size:11px;font-weight:700;color:#6b6880;margin-bottom:4px">ON THE MENU TODAY</div>
                ${topItems.map((i) => `
                  <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f0f0f0">
                    <span style="font-size:12px;font-weight:600">${escapeHtml(i.name.slice(0, 26))}${i.name.length > 26 ? "…" : ""}</span>
                    <span style="font-size:11px;color:#888;margin-left:6px">${i.calories ? i.calories + " cal" : ""}</span>
                  </div>`).join("")}
              ` : `<div style="font-size:12px;color:#9a97ac">No menu today</div>`}
              ${viewMenuBtn}
            </div>`;

          const marker = L.marker([coords.lat, coords.lng], { icon });
          marker.bindPopup(popupHtml, { maxWidth: 270, offset: [0, -8] });
          marker.addTo(map);
        });

        mapRef.current = map;
        setTimeout(() => { if (mapRef.current === map) map.invalidateSize(); }, 120);
      } catch {}
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
        html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
        title: "You",
      }).addTo(map);
      marker.bindPopup("<b>You're here</b>");
      userMarkerRef.current = marker;
    }).catch(() => {});
  }, [userLocation]);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
