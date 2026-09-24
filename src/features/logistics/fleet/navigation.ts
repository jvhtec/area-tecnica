/**
 * Navigation helpers for the driver dashboard: deep links into the map apps a
 * driver actually has on the phone, and the "starts in…" line for the next run.
 * Pure functions — no network, no React.
 */
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

import { normalizeTransportTimezone } from "./fleetModel";

export type NavigationTarget = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  name: string | null;
};

export type NavigationLinks = {
  /** Google Maps directions from the device's current position, driving mode. */
  google: string;
  /** Waze with navigation started. */
  waze: string;
  /** Apple Maps directions, driving mode. Offered on Apple devices only. */
  apple: string;
  /** Google Maps route from the planned origin, when the transport request names one. */
  route: string | null;
};

const coordinates = (target: NavigationTarget): string | null =>
  target.lat !== null && target.lng !== null && Number.isFinite(target.lat) && Number.isFinite(target.lng)
    ? `${target.lat},${target.lng}`
    : null;

/** Free-text fallback for a target with no coordinates. */
export const navigationQuery = (target: NavigationTarget): string | null => {
  const address = target.address?.trim();
  const name = target.name?.trim();
  if (address && name && !address.toLowerCase().includes(name.toLowerCase())) return `${name}, ${address}`;
  return address || name || null;
};

/** Null when there is nothing to navigate to (no coordinates, address or name). */
export const buildNavigationLinks = (target: NavigationTarget, origin?: string | null): NavigationLinks | null => {
  const point = coordinates(target);
  const query = navigationQuery(target);
  const destination = point ?? query;
  if (!destination) return null;
  const encoded = encodeURIComponent(destination);
  const plannedOrigin = origin?.trim();
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
    waze: point
      ? `https://waze.com/ul?ll=${encodeURIComponent(point)}&navigate=yes`
      : `https://waze.com/ul?q=${encoded}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${encoded}&dirflg=d`,
    route: plannedOrigin
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(plannedOrigin)}&destination=${encoded}&travelmode=driving`
      : null,
  };
};

/** iPhone/iPad/Mac: the driver most likely has Apple Maps installed. */
export const isAppleDevice = (userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean =>
  /iPhone|iPad|iPod|Macintosh/i.test(userAgent);

/**
 * "En curso", "Empieza en 45 min", "Empieza en 2 h 15 min", or, further out,
 * "Empieza el jueves 2 de octubre a las 07:00" in the transport's timezone.
 * "Finalizado" once the window is over.
 */
export const describeTimeUntil = (
  startsAt: string,
  endsAt: string,
  nowIso: string,
  timezone?: string | null,
): string => {
  const now = new Date(nowIso).getTime();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (end <= now) return "Finalizado";
  if (start <= now) return "En curso";
  const minutes = Math.round((start - now) / 60_000);
  if (minutes < 60) return `Empieza en ${Math.max(minutes, 1)} min`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `Empieza en ${hours} h ${rest} min` : `Empieza en ${hours} h`;
  }
  const when = formatInTimeZone(startsAt, normalizeTransportTimezone(timezone), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
  return `Empieza el ${when}`;
};
