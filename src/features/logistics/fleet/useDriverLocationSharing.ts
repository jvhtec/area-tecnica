import { useCallback, useEffect, useRef, useState } from "react";

import { reportDriverLocation, stopSharingDriverLocation, type ReportDriverLocationInput } from "./fleetApi";
import type { MyTransportAssignment } from "./fleetModel";
import { currentSharingAssignment, shouldReportPosition, type GeoPoint } from "./tracking";
import { useScreenWakeLock } from "./useScreenWakeLock";

const STORAGE_KEY = "conductor.shareLocation";

export type SharingStatus =
  /** Switch off. */
  | "off"
  /** Switch on, but no transport is running or about to; nothing is sent. */
  | "waiting"
  /** Switch on and positions are being sent. */
  | "active"
  /** The browser has no geolocation at all. */
  | "unsupported"
  /** The driver refused the permission, or the device could not get a fix. */
  | "error";

type SharingState = {
  status: SharingStatus;
  error: string | null;
  lastReportedAt: string | null;
  /** The transport positions are attached to while active. */
  assignment: MyTransportAssignment | null;
};

const readStoredPreference = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
};

const writeStoredPreference = (enabled: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the switch just does not survive a reload.
  }
};

const geolocationErrorMessage = (error: GeolocationPositionError): string => {
  if (error.code === error.PERMISSION_DENIED) {
    return "No has dado permiso de ubicación. Actívalo en los ajustes del navegador para compartirla.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) return "El teléfono no consigue posicionarse ahora mismo.";
  return "La ubicación tarda demasiado en llegar.";
};

const toReport = (position: GeolocationPosition, assignmentId: string): ReportDriverLocationInput => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracyM: position.coords.accuracy,
  headingDeg: position.coords.heading,
  speedMps: position.coords.speed,
  assignmentId,
});

/**
 * Opt-in position sharing for a driver using the PWA. Positions are sent only
 * while `currentSharingAssignment` finds a transport that is running or starting
 * within the lead time, so an enabled switch outside working hours sends nothing.
 * Turning the switch off deletes the stored position server-side.
 *
 * PWA realities this works around:
 * - the browser stops delivering fixes while the tab is hidden or the screen is
 *   off, so the screen is kept awake while active (`useScreenWakeLock`) and a
 *   fresh fix is sent the moment the page becomes visible again;
 * - a fix that fails to upload (tunnel, no coverage) is kept and re-sent when
 *   the connection is back or on the next fix, whichever comes first.
 */
export function useDriverLocationSharing(assignments: readonly MyTransportAssignment[], nowIso: string) {
  const [enabled, setEnabled] = useState<boolean>(readStoredPreference);
  const [state, setState] = useState<SharingState>({ status: "off", error: null, lastReportedAt: null, assignment: null });
  const lastReportRef = useRef<(GeoPoint & { reportedAt: number }) | null>(null);
  const pendingRef = useRef<ReportDriverLocationInput | null>(null);

  const assignment = currentSharingAssignment(assignments, nowIso);
  const assignmentId = assignment?.id ?? null;
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const active = enabled && supported && assignmentId !== null;
  const wakeLock = useScreenWakeLock(active);

  const toggle = useCallback((next: boolean) => {
    setEnabled(next);
    writeStoredPreference(next);
    if (!next) {
      lastReportRef.current = null;
      pendingRef.current = null;
      void stopSharingDriverLocation().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "off", error: null, lastReportedAt: null, assignment: null });
      return;
    }
    if (!supported) {
      setState({ status: "unsupported", error: null, lastReportedAt: null, assignment: null });
      return;
    }
    if (!assignmentId) {
      setState((current) => ({ ...current, status: "waiting", error: null, assignment: null }));
      return;
    }

    setState((current) => ({ ...current, status: "active", error: null, assignment }));

    const send = (report: ReportDriverLocationInput) => {
      pendingRef.current = null;
      void reportDriverLocation(report)
        .then((reportedAt) => {
          setState((current) => ({ ...current, status: "active", error: null, lastReportedAt: reportedAt }));
        })
        .catch((error: unknown) => {
          // Keep watching and keep the fix: it goes out when the connection is back.
          pendingRef.current = report;
          const message = navigator.onLine === false
            ? "Sin conexión: la última posición se enviará al recuperar la cobertura."
            : error instanceof Error ? error.message : "No se pudo enviar la posición";
          setState((current) => ({ ...current, error: message }));
        });
    };

    const handleFix = (position: GeolocationPosition, force = false) => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const now = Date.now();
      if (!force && !shouldReportPosition(lastReportRef.current, point, now)) return;
      lastReportRef.current = { ...point, reportedAt: now };
      send(toReport(position, assignmentId));
    };

    const onFixError = (error: GeolocationPositionError) => {
      setState((current) => ({ ...current, status: "error", error: geolocationErrorMessage(error) }));
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => handleFix(position),
      onFixError,
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );

    // Back in the foreground: the watch may have been suspended, so send a fresh fix now.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (position) => handleFix(position, true),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
    };
    const onOnline = () => {
      if (pendingRef.current) send(pendingRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, supported, assignment, assignmentId]);

  return { enabled, toggle, wakeLockSupported: wakeLock.supported, wakeLockHeld: wakeLock.held, ...state };
}
