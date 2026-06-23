"use client";

import { useEffect, useRef } from "react";

interface ClassLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  onClear: () => void;
  className?: string;
}

const UW_CENTER: [number, number] = [47.6553, -122.3035];
const ZOOM = 16;

function round6(n: number) { return Math.round(n * 1e6) / 1e6; }

export function ClassLocationPicker({
  lat,
  lng,
  onChange,
  onClear,
  className,
}: ClassLocationPickerProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<unknown>(null);
  const markerRef     = useRef<unknown>(null);

  const onChangeRef = useRef(onChange);
  const onClearRef  = useRef(onClear);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onClearRef.current  = onClear;  }, [onClear]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    async function init() {
      const L = await import("leaflet");
      if (!containerRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const center: [number, number] = lat && lng ? [lat, lng] : UW_CENTER;
      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false })
        .setView(center, ZOOM);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (lat && lng) {
        const m = L.marker([lat, lng], { draggable: true }).addTo(map);
        m.on("dragend", () => {
          const p = m.getLatLng();
          onChangeRef.current(round6(p.lat), round6(p.lng));
        });
        markerRef.current = m;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        const newLat = round6(e.latlng.lat);
        const newLng = round6(e.latlng.lng);

        if (markerRef.current) {
          (markerRef.current as ReturnType<typeof L.marker>).setLatLng([newLat, newLng]);
        } else {
          const m = L.marker([newLat, newLng], { draggable: true }).addTo(map);
          m.on("dragend", () => {
            const p = m.getLatLng();
            onChangeRef.current(round6(p.lat), round6(p.lng));
          });
          markerRef.current = m;
        }
        onChangeRef.current(newLat, newLng);
      });

      mapRef.current = map;
    }

    init();

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current  = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />;
}
