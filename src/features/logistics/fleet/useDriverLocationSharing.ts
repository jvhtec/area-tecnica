import { useCallback, useEffect, useRef, useState } from "react";

import { reportDriverLocation, stopSharingDriverLocation } from "./fleetApi";
import type { MyTransportAssignment } from "./fleetModel";
import { currentSharingAssignment, shouldReportPosition, type GeoPoint } from "./tracking";

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
    return "No has dado permiso de ubicación. Actívalo en los ajustes del teléfono para compartirla.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) return "El teléfono no consigue posicionarse ahora mismo.";
  return "La ubicación tarda demasiado en llegar.";
};

/**
 * Opt-in position sharing for a driver. Positions are sent only while
 * `currentSharingAssignment` finds a transport that is running or starting
 * within the lead time, so an enabled switch outside working hours sends
 * nothing. Turning the switch off deletes the stored position server-side.
 *
 * Web limitation: the browser stops delivering fixes when the app is in the
 * background or the screen is off. The card tells the driver to keep it open.
 */
export function useDriverLocationSharing(assignments: readonly MyTransportAssignment[], nowIso: string) {
  const [enabled, setEnabled] = useState<boolean>(readStoredPreference);
  const [state, setState] = useState<SharingState>({ status: "off", error: null, lastReportedAt: null, assignment: null });
  const lastReportRef = useRef<(GeoPoint & { reportedAt: number }) | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const assignment = currentSharingAssignment(assignments, nowIso);
  const assignmentId = assignment?.id ?? null;
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const toggle = useCallback((next: boolean) => {
    setEnabled(next);
    writeStoredPreference(next);
    if (!next) {
      lastReportRef.current = null;
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

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const now = Date.now();
        if (!shouldReportPosition(lastReportRef.current, point, now)) return;
        lastReportRef.current = { ...point, reportedAt: now };
        void reportDriverLocation({
          ...point,
          accuracyM: position.coords.accuracy,
          headingDeg: position.coords.heading,
          speedMps: position.coords.speed,
          assignmentId,
        })
          .then((reportedAt) => {
            setState((current) => ({ ...current, status: "active", error: null, lastReportedAt: reportedAt }));
          })
          .catch((error: unknown) => {
            // Keep watching: a dropped request is not a reason to stop sharing.
            const message = error instanceof Error ? error.message : "No se pudo enviar la posición";
            setState((current) => ({ ...current, error: message }));
          });
      },
      (error) => {
        setState((current) => ({ ...current, status: "error", error: geolocationErrorMessage(error) }));
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (watchIdRef.current === watchId) watchIdRef.current = null;
    };
  }, [enabled, supported, assignment, assignmentId]);

  return { enabled, toggle, ...state };
}
