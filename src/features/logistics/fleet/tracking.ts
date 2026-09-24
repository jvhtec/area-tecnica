/**
 * Live driver tracking: pure helpers shared by the driver's sharing switch and
 * the logistics tracking map. No network, no React.
 */
import type { DriverAssignmentStatus, MyTransportAssignment } from "./fleetModel";
import { driverDisplayName } from "./fleetModel";

export type DriverLiveLocation = {
  driver_id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  heading_deg: number | null;
  speed_mps: number | null;
  recorded_at: string;
  assignment: {
    id: string;
    status: DriverAssignmentStatus;
    starts_at: string;
    ends_at: string;
    event_type: string | null;
    title: string | null;
    timezone: string;
    vehicle_name: string | null;
    vehicle_plate: string | null;
    destination_name: string | null;
    destination_lat: number | null;
    destination_lng: number | null;
  } | null;
};

export type GeoPoint = { latitude: number; longitude: number };

/** A position older than this is drawn greyed out and listed as "sin señal". */
export const STALE_AFTER_MINUTES = 10;

/** Drivers may share from this long before a transport starts until it ends. */
export const SHARING_LEAD_MINUTES = 120;

/** Client-side throttle: report when either threshold is crossed. */
export const REPORT_MIN_INTERVAL_MS = 30_000;
export const REPORT_MIN_DISTANCE_M = 50;

export const driverLocationName = (location: Pick<DriverLiveLocation, "first_name" | "last_name" | "nickname">): string =>
  driverDisplayName(location);

export const isStaleLocation = (recordedAt: string, nowIso: string, staleAfterMinutes = STALE_AFTER_MINUTES): boolean =>
  new Date(nowIso).getTime() - new Date(recordedAt).getTime() > staleAfterMinutes * 60_000;

/** "ahora mismo", "hace 3 min", "hace 2 h", "hace 1 día". */
export const describeLocationAge = (recordedAt: string, nowIso: string): string => {
  const seconds = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(recordedAt).getTime()) / 1000));
  if (seconds < 45) return "ahora mismo";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
};

/** Great-circle distance in metres (haversine). */
export const distanceMeters = (a: GeoPoint, b: GeoPoint): number => {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

/**
 * Whether a new fix is worth sending. The first fix always is; afterwards only
 * when enough time has passed or the driver has actually moved.
 */
export const shouldReportPosition = (
  previous: (GeoPoint & { reportedAt: number }) | null,
  next: GeoPoint,
  now: number,
  minIntervalMs = REPORT_MIN_INTERVAL_MS,
  minDistanceM = REPORT_MIN_DISTANCE_M,
): boolean => {
  if (!previous) return true;
  if (now - previous.reportedAt >= minIntervalMs) return true;
  return distanceMeters(previous, next) >= minDistanceM;
};

/**
 * The assignment a driver may currently share their position for: running, or
 * starting within the lead time. Declined transports never qualify. Returns the
 * earliest-starting match so an overlapping later run does not steal the label.
 */
export const currentSharingAssignment = (
  assignments: readonly MyTransportAssignment[],
  nowIso: string,
  leadMinutes = SHARING_LEAD_MINUTES,
): MyTransportAssignment | null => {
  const now = new Date(nowIso).getTime();
  const candidates = assignments
    .filter((assignment) => assignment.status !== "declined")
    .filter((assignment) => {
      const start = new Date(assignment.starts_at).getTime();
      const end = new Date(assignment.ends_at).getTime();
      return start - leadMinutes * 60_000 <= now && now < end;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return candidates[0] ?? null;
};
