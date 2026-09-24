/**
 * Logistics matrix domain model: drivers (conductores), the own fleet and the
 * driver/vehicle assignments on scheduled transports (logistics_events).
 *
 * Pure types and helpers only — no network. See fleetApi.ts for the RPC calls
 * and supabase/migrations/20260924100500_logistics_fleet_and_driver_assignments.sql
 * for the server contract.
 */
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

import { MADRID_TIMEZONE, addMadridCalendarDays } from "@/utils/timezoneUtils";

export const LICENSE_CATEGORIES = ["B", "B+E", "C1", "C1+E", "C", "C+E", "D1", "D1+E", "D", "D+E"] as const;
export type LicenseCategory = (typeof LICENSE_CATEGORIES)[number];

export const VEHICLE_TYPES = ["trailer", "9m", "8m", "6m", "4m", "furgoneta", "rv"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  trailer: "Tráiler",
  "9m": "Camión 9 m",
  "8m": "Camión 8 m",
  "6m": "Camión 6 m",
  "4m": "Camión 4 m",
  furgoneta: "Furgoneta",
  rv: "Autocaravana",
};

export type DriverAssignmentStatus = "assigned" | "confirmed" | "declined";

export const DRIVER_ASSIGNMENT_STATUS_LABELS: Record<DriverAssignmentStatus, string> = {
  assigned: "Pendiente",
  confirmed: "Confirmado",
  declined: "Rechazado",
};

export const TRANSPORT_EVENT_TYPE_LABELS: Record<string, string> = {
  load: "Carga",
  unload: "Descarga",
};

export type FleetVehicle = {
  id: string;
  name: string;
  license_plate: string;
  vehicle_type: VehicleType;
  required_license: LicenseCategory;
  brand: string | null;
  model: string | null;
  payload_kg: number | null;
  cargo_length_m: number | null;
  notes: string | null;
  is_active: boolean;
};

export type MatrixDriver = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  department: string | null;
  license_categories: string[];
  license_expiry: string | null;
  cap_expiry: string | null;
  adr_certified: boolean;
  default_vehicle_id: string | null;
  notes: string | null;
};

export type MatrixTransportEvent = {
  id: string;
  event_type: string;
  transport_type: string;
  event_date: string;
  event_time: string;
  timezone: string;
  title: string | null;
  color: string | null;
  job_id: string | null;
  job_title: string | null;
  license_plate: string | null;
  transport_provider: string | null;
  loading_bay: string | null;
  notes: string | null;
  transport_request_id: string | null;
  origin: string | null;
  destination: string | null;
  location_name: string | null;
  departments: string[];
};

export type DriverAssignment = {
  id: string;
  logistics_event_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  starts_at: string;
  ends_at: string;
  status: DriverAssignmentStatus;
  notes: string | null;
  responded_at: string | null;
};

export type LogisticsMatrixData = {
  drivers: MatrixDriver[];
  vehicles: FleetVehicle[];
  events: MatrixTransportEvent[];
  assignments: DriverAssignment[];
};

/** A driver's own view of one assignment (get_my_transport_assignments). */
export type MyTransportAssignment = {
  id: string;
  status: DriverAssignmentStatus;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  responded_at: string | null;
  event_id: string;
  event_type: string;
  transport_type: string;
  event_date: string;
  event_time: string;
  timezone: string;
  title: string | null;
  job_title: string | null;
  loading_bay: string | null;
  event_notes: string | null;
  origin: string | null;
  destination: string | null;
  location_name: string | null;
  location_address: string | null;
  vehicle: Pick<FleetVehicle, "id" | "name" | "license_plate" | "vehicle_type"> | null;
};

export type DriverDetails = {
  profile_id: string;
  license_categories: string[];
  license_expiry: string | null;
  cap_expiry: string | null;
  adr_certified: boolean;
  default_vehicle_id: string | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const driverDisplayName = (driver: Pick<MatrixDriver, "first_name" | "last_name" | "nickname">): string => {
  const first = driver.first_name?.trim() || driver.nickname?.trim() || "";
  const full = [first, driver.last_name?.trim() || ""].filter((part) => part.length > 0).join(" ");
  return full || "Sin nombre";
};

export const vehicleTypeLabel = (type: string | null | undefined): string =>
  type && type in VEHICLE_TYPE_LABELS ? VEHICLE_TYPE_LABELS[type as VehicleType] : type || "—";

export const vehicleLabel = (vehicle: Pick<FleetVehicle, "name" | "license_plate">): string =>
  `${vehicle.name} · ${vehicle.license_plate}`;

export const transportEventTitle = (event: Pick<MatrixTransportEvent, "title" | "job_title" | "event_type">): string =>
  event.title?.trim() || event.job_title?.trim() || TRANSPORT_EVENT_TYPE_LABELS[event.event_type] || "Transporte";

export const normalizeTransportTimezone = (timezone: string | null | undefined): string =>
  timezone?.trim() || MADRID_TIMEZONE;

export const formatTransportTime = (iso: string, timezone?: string | null): string =>
  formatInTimeZone(iso, normalizeTransportTimezone(timezone), "HH:mm");

export const formatTransportDateKey = (iso: string, timezone?: string | null): string =>
  formatInTimeZone(iso, normalizeTransportTimezone(timezone), "yyyy-MM-dd");

export const formatMadridTime = (iso: string): string => formatTransportTime(iso, MADRID_TIMEZONE);

export const formatMadridDayLabel = (iso: string): string =>
  formatInTimeZone(iso, MADRID_TIMEZONE, "EEEE d 'de' MMMM", { locale: es });

// ---------------------------------------------------------------------------
// Licences
// ---------------------------------------------------------------------------

// Categories each licence also entitles its holder to drive (Reglamento General
// de Conductores). Any professional category presupposes a B licence.
const LICENSE_IMPLIES: Record<LicenseCategory, readonly LicenseCategory[]> = {
  B: [],
  "B+E": ["B"],
  C1: ["B"],
  "C1+E": ["C1", "B+E", "B"],
  C: ["C1", "B"],
  "C+E": ["C", "C1", "C1+E", "B+E", "B"],
  D1: ["B"],
  "D1+E": ["D1", "B+E", "B"],
  D: ["D1", "B"],
  "D+E": ["D", "D1", "D1+E", "B+E", "B"],
};

const isLicenseCategory = (value: string): value is LicenseCategory =>
  (LICENSE_CATEGORIES as readonly string[]).includes(value);

export const driverCoversLicense = (categories: readonly string[], required: string): boolean => {
  if (!isLicenseCategory(required)) return true;

  const granted = new Set<LicenseCategory>();
  for (const held of categories) {
    if (!isLicenseCategory(held)) continue;
    granted.add(held);
    for (const implied of LICENSE_IMPLIES[held]) granted.add(implied);
  }

  // Art. 5.2.f: C+E also grants D+E when the holder already has D.
  // D+E then carries its ordinary D1+E/B+E implications.
  if (granted.has("C+E") && granted.has("D")) {
    granted.add("D+E");
    for (const implied of LICENSE_IMPLIES["D+E"]) granted.add(implied);
  }

  return granted.has(required);
};

export type DriverVehicleWarning = "license_missing" | "license_expired" | "cap_expired";

export const DRIVER_WARNING_LABELS: Record<DriverVehicleWarning, string> = {
  license_missing: "El conductor no tiene el permiso requerido por el vehículo",
  license_expired: "El permiso de conducir estará caducado ese día",
  cap_expired: "El CAP estará caducado ese día",
};

/**
 * Soft checks shown before assigning — the server does not enforce them, since
 * licence data may simply not have been entered yet.
 */
export const driverVehicleWarnings = (
  driver: Pick<MatrixDriver, "license_categories" | "license_expiry" | "cap_expiry"> | null | undefined,
  vehicle: Pick<FleetVehicle, "required_license"> | null | undefined,
  dayKey: string,
): DriverVehicleWarning[] => {
  if (!driver) return [];
  const warnings: DriverVehicleWarning[] = [];
  if (vehicle && driver.license_categories.length > 0 && !driverCoversLicense(driver.license_categories, vehicle.required_license)) {
    warnings.push("license_missing");
  }
  if (driver.license_expiry && driver.license_expiry < dayKey) warnings.push("license_expired");
  const professional = vehicle
    ? ["C1", "C1+E", "C", "C+E", "D1", "D1+E", "D", "D+E"].includes(vehicle.required_license)
    : false;
  if (professional && driver.cap_expiry && driver.cap_expiry < dayKey) warnings.push("cap_expired");
  return warnings;
};

// ---------------------------------------------------------------------------
// Matrix layout
// ---------------------------------------------------------------------------

/** Monday of the Madrid week containing `dayKey`. */
export const startOfMadridWeek = (dayKey: string): string => {
  const weekday = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
  return addMadridCalendarDays(dayKey, -((weekday + 6) % 7));
};

/** Madrid day keys from `start` to `end`, inclusive. */
export const buildDayKeys = (startKey: string, endKey: string): string[] => {
  const keys: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey && keys.length < 400) {
    keys.push(cursor);
    cursor = addMadridCalendarDays(cursor, 1);
  }
  return keys;
};

/** Every local transport day an assignment window touches (a long haul spans several). */
export const assignmentDayKeys = (
  assignment: Pick<DriverAssignment, "starts_at" | "ends_at">,
  timezone: string = MADRID_TIMEZONE,
): string[] => {
  const first = formatTransportDateKey(assignment.starts_at, timezone);
  // The window is half-open: a run ending exactly at local midnight does not occupy the next day.
  const lastInstant = new Date(new Date(assignment.ends_at).getTime() - 1).toISOString();
  const last = formatTransportDateKey(lastInstant, timezone);
  return buildDayKeys(first, last < first ? first : last);
};

export type MatrixRowKey = "driver_id" | "vehicle_id";

/** rowId → dayKey → assignments on that row and day, ordered by start time. */
export const groupAssignmentsByRowAndDay = (
  assignments: readonly DriverAssignment[],
  rowKey: MatrixRowKey,
  timezoneByEvent: ReadonlyMap<string, string> = new Map(),
): Map<string, Map<string, DriverAssignment[]>> => {
  const grouped = new Map<string, Map<string, DriverAssignment[]>>();
  const ordered = [...assignments].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const assignment of ordered) {
    const rowId = assignment[rowKey];
    if (!rowId) continue;
    let byDay = grouped.get(rowId);
    if (!byDay) {
      byDay = new Map();
      grouped.set(rowId, byDay);
    }
    for (const dayKey of assignmentDayKeys(
      assignment,
      timezoneByEvent.get(assignment.logistics_event_id) ?? MADRID_TIMEZONE,
    )) {
      const list = byDay.get(dayKey) ?? [];
      list.push(assignment);
      byDay.set(dayKey, list);
    }
  }
  return grouped;
};

const overlaps = (a: Pick<DriverAssignment, "starts_at" | "ends_at">, b: Pick<DriverAssignment, "starts_at" | "ends_at">) =>
  a.starts_at < b.ends_at && b.starts_at < a.ends_at;

/**
 * Assignment ids that double-book a driver or a vehicle. Declined rows no longer
 * hold their slot, mirroring assign_transport_driver's conflict check.
 */
export const findDoubleBookedAssignmentIds = (assignments: readonly DriverAssignment[]): Set<string> => {
  const conflicted = new Set<string>();
  const active = assignments.filter((assignment) => assignment.status !== "declined");
  for (const rowKey of ["driver_id", "vehicle_id"] as const) {
    const byRow = new Map<string, DriverAssignment[]>();
    for (const assignment of active) {
      const rowId = assignment[rowKey];
      if (!rowId) continue;
      byRow.set(rowId, [...(byRow.get(rowId) ?? []), assignment]);
    }
    for (const rows of byRow.values()) {
      const sorted = [...rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length && sorted[j].starts_at < sorted[i].ends_at; j++) {
          if (overlaps(sorted[i], sorted[j])) {
            conflicted.add(sorted[i].id);
            conflicted.add(sorted[j].id);
          }
        }
      }
    }
  }
  return conflicted;
};

/** Transports on each day that still have no driver who has not declined. */
export const countUncoveredTransportsByDay = (
  events: readonly MatrixTransportEvent[],
  assignments: readonly DriverAssignment[],
): Map<string, number> => {
  const covered = new Set(
    assignments
      .filter((assignment) => assignment.driver_id && assignment.status !== "declined")
      .map((assignment) => assignment.logistics_event_id),
  );
  const counts = new Map<string, number>();
  for (const event of events) {
    if (covered.has(event.id)) continue;
    counts.set(event.event_date, (counts.get(event.event_date) ?? 0) + 1);
  }
  return counts;
};

/** Default window for a new assignment: the transport's local time, two hours long. */
export const defaultAssignmentWindow = (
  event: Pick<MatrixTransportEvent, "event_date" | "event_time">,
): { start: string; end: string } => {
  const start = `${event.event_date}T${event.event_time.slice(0, 5)}`;
  const [hours, minutes] = event.event_time.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + 120;
  const endDayKey = endMinutes >= 24 * 60 ? addMadridCalendarDays(event.event_date, 1) : event.event_date;
  const wrapped = endMinutes % (24 * 60);
  const end = `${endDayKey}T${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  return { start, end };
};
