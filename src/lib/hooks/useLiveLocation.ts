"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoPosition } from "@/lib/hooks/useGeolocation";

export type LocationStatus = "idle" | "locating" | "tracking" | "denied" | "unsupported" | "error";

export interface LiveLocation {
  position: GeoPosition | null;
  heading: number | null;
  status: LocationStatus;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useLiveLocation(autoStart = false): LiveLocation {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    setStatus((s) => (s === "tracking" || s === "locating" ? "idle" : s));
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError("This device can't share its location.");
      return;
    }
    if (watchRef.current !== null) return;
    setStatus("locating");
    setError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        if (typeof pos.coords.heading === "number" && !Number.isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }
        setStatus("tracking");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Location access is blocked. Enable it to get live directions.");
        } else {
          setStatus("error");
          setError(err.message || "Couldn't get your location.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, []);

  useEffect(() => {
    if (autoStart) start();
    return () => {
      if (watchRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [autoStart, start]);

  return { position, heading, status, error, start, stop };
}
