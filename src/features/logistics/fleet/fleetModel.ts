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

export const VEHICLE_TYPES = ["trailer", "9m", "8m", "6m", "4m", "furgoneta", "rv", "sleeper_bus"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  trailer: "Tráiler",
  "9m": "Camión 9 m",
  "8m": "Camión 8 m",
  "6m": "Camión 6 m",
  "4m": "Camión 4 m",
  furgoneta: "Furgoneta",
  rv: "Autocaravana",
  sleeper_bus: "Autobús cama",
};

/**
 * Licence the vehicle form pre-selects when a type is chosen. Only the
 * unambiguous case: a sleeper bus carries far more than 16 passengers, so it
 * needs a D licence (D+E when it tows a trailer). A D-family licence the user
 * already picked is kept, and other types keep whatever was selected.
 */
export const suggestedLicenseForVehicleType = (type: VehicleType, current: LicenseCategory): LicenseCategory =>
  type === "sleeper_bus" && !current.startsWith("D") ? "D" : current;

export type DriverAssignmentStatus = "assigned" | "confirmed" | "declined";

export const DRIVER_ASSIGNMENT_STATUS_LABELS: Record<DriverAssignmentStatus, string> = {
  assigned: "Pendiente",
  confirmed: "Confirmado",
  declined: "Rechazado",
};

export const TRANSPORT_EVENT_TYPE_LABELS: Record<string, string> = {
  load: "Carga",
  unload: "Descarga",
  crew_transfer: "Traslado de personal",
};

/** A transport that moves people rather than gear (logistics_event_type `crew_transfer`). */
export const isCrewTransfer = (event: { event_type: string }): boolean => event.event_type === "crew_transfer";

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
  has_tail_lift: boolean;
  /** ISO date (yyyy-MM-dd). Inspección Técnica de Vehículos. */
  itv_expiry: string | null;
  /** ISO date (yyyy-MM-dd). */
  insurance_expiry: string | null;
  notes: string | null;
  is_active: boolean;
  /** Sleeper buses only: berth counts the bus can be set up with, ascending. */
  berth_layouts: number[];
  /** Seats for passengers besides the driver; null when unknown. */
  passenger_seats: number | null;
};

export const UNAVAILABILITY_STATUSES = ["vacation", "travel", "sick", "day_off", "unavailable", "warehouse"] as const;
export type UnavailabilityStatus = (typeof UNAVAILABILITY_STATUSES)[number];

export const UNAVAILABILITY_LABELS: Record<UnavailabilityStatus, string> = {
  vacation: "Vacaciones",
  travel: "Viaje",
  sick: "Baja",
  day_off: "Día libre",
  unavailable: "No disponible",
  warehouse: "Almacén",
};

export type DriverUnavailableDay = { date: string; status: UnavailabilityStatus };

export type MatrixDriver = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  department: string | null;
  /** Only present for admin/management (the RPC returns null to read-only viewers). */
  phone: string | null;
  license_categories: string[];
  license_expiry: string | null;
  cap_expiry: string | null;
  tachograph_card_expiry: string | null;
  adr_certified: boolean;
  default_vehicle_id: string | null;
  notes: string | null;
  /** Days in the queried range the driver cannot work (availability rows + approved vacations). */
  unavailable_days: DriverUnavailableDay[];
};

export type MatrixTransportEvent = {
  id: string;
  event_type: string;
  transport_type: string;
  event_date: string;
  event_time: string;
  /** Optional local end of the transport (yyyy-MM-dd / HH:mm:ss), both or neither. */
  end_date: string | null;
  end_time: string | null;
  timezone: string;
  title: string | null;
  color: string | null;
  job_id: string | null;
  job_title: string | null;
  license_plate: string | null;
  transport_provider: string | null;
  /** Sleeper buses only: berths this run provides. */
  berth_count: number | null;
  /** People assigned to the event's job who have not declined (null without a job). */
  job_crew_count: number | null;
  /** Crew transfers only: people travelling. */
  passenger_count: number | null;
  /** Crew transfers only: the pick-up point (its name comes through `origin`). */
  origin_location_id: string | null;
  loading_bay: string | null;
  notes: string | null;
  transport_request_id: string | null;
  origin: string | null;
  destination: string | null;
  location_name: string | null;
  location_address: string | null;
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
  /** What the driver said when declining, if anything. */
  decline_reason: string | null;
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
  decline_reason: string | null;
  event_id: string;
  event_type: string;
  transport_type: string;
  event_date: string;
  event_time: string;
  end_date: string | null;
  end_time: string | null;
  /** Crew transfers only: people travelling. */
  passenger_count: number | null;
  timezone: string;
  title: string | null;
  job_id: string | null;
  job_title: string | null;
  loading_bay: string | null;
  event_notes: string | null;
  origin: string | null;
  destination: string | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  /** Crew transfers only: where the crew is picked up (punto de encuentro). */
  pickup_name: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  vehicle: Pick<FleetVehicle, "id" | "name" | "license_plate" | "vehicle_type" | "has_tail_lift"> | null;
};

export type DriverDetails = {
  profile_id: string;
  license_categories: string[];
  license_expiry: string | null;
  cap_expiry: string | null;
  tachograph_card_expiry: string | null;
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

/**
 * A transport handled by an outside company (a hired truck or sleeper bus, a client
 * pick-up) needs no driver from our own staff. Sector-Pro is the company itself.
 */
export const isExternallyHandledTransport = (event: Pick<MatrixTransportEvent, "transport_provider">): boolean =>
  Boolean(event.transport_provider) && event.transport_provider !== "sector_pro";

/** Most berths the vehicle can be set up with (0 when none are configured). */
export const maxBerths = (vehicle: Pick<FleetVehicle, "berth_layouts">): number =>
  vehicle.berth_layouts.length > 0 ? Math.max(...vehicle.berth_layouts) : 0;

/** "16 literas" or "12 / 14 / 16 literas"; null when none are configured. */
export const formatBerthLayouts = (layouts: readonly number[]): string | null =>
  layouts.length > 0 ? `${[...layouts].sort((a, b) => a - b).join(" / ")} literas` : null;

export const MAX_BERTH_LAYOUTS = 6;
export const MAX_BERTHS_PER_BUS = 40;

/**
 * Parses what the vehicle form accepts for berth layouts: numbers separated by
 * commas, slashes or spaces ("16", "12, 14, 16"). Returns the sorted distinct
 * values, or an error message in Spanish.
 */
export const parseBerthLayouts = (input: string): { layouts: number[] } | { error: string } => {
  const parts = input.split(/[\s,;/]+/).filter((part) => part.length > 0);
  const values: number[] = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isInteger(value) || value < 1 || value > MAX_BERTHS_PER_BUS) {
      return { error: `"${part}" no es un número de literas válido (1–${MAX_BERTHS_PER_BUS})` };
    }
    values.push(value);
  }
  const layouts = [...new Set(values)].sort((a, b) => a - b);
  if (layouts.length > MAX_BERTH_LAYOUTS) {
    return { error: `Como máximo ${MAX_BERTH_LAYOUTS} configuraciones de literas` };
  }
  return { layouts };
};

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

export type DriverVehicleWarning =
  | "license_missing"
  | "license_expired"
  | "cap_expired"
  | "tachograph_expired"
  | "vehicle_itv_expired"
  | "vehicle_insurance_expired"
  | "driver_unavailable";

export const DRIVER_WARNING_LABELS: Record<DriverVehicleWarning, string> = {
  license_missing: "El conductor no tiene el permiso requerido por el vehículo",
  license_expired: "El permiso de conducir estará caducado ese día",
  cap_expired: "El CAP estará caducado ese día",
  tachograph_expired: "La tarjeta de tacógrafo estará caducada ese día",
  vehicle_itv_expired: "La ITV del vehículo estará caducada ese día",
  vehicle_insurance_expired: "El seguro del vehículo estará caducado ese día",
  driver_unavailable: "El conductor no está disponible ese día",
};

const PROFESSIONAL_LICENSES: readonly string[] = ["C1", "C1+E", "C", "C+E", "D1", "D1+E", "D", "D+E"];

type WarningDriver = Pick<MatrixDriver, "license_categories" | "license_expiry" | "cap_expiry"> &
  Partial<Pick<MatrixDriver, "tachograph_card_expiry" | "unavailable_days">>;
type WarningVehicle = Pick<FleetVehicle, "required_license"> &
  Partial<Pick<FleetVehicle, "itv_expiry" | "insurance_expiry">>;

/**
 * Soft checks shown before assigning — the server does not enforce them, since
 * licence and document data may simply not have been entered yet.
 */
export const driverVehicleWarnings = (
  driver: WarningDriver | null | undefined,
  vehicle: WarningVehicle | null | undefined,
  dayKey: string,
): DriverVehicleWarning[] => {
  const warnings: DriverVehicleWarning[] = [];
  if (driver) {
    if (vehicle && driver.license_categories.length > 0 && !driverCoversLicense(driver.license_categories, vehicle.required_license)) {
      warnings.push("license_missing");
    }
    if (driver.license_expiry && driver.license_expiry < dayKey) warnings.push("license_expired");
    const professional = vehicle ? PROFESSIONAL_LICENSES.includes(vehicle.required_license) : false;
    if (professional && driver.cap_expiry && driver.cap_expiry < dayKey) warnings.push("cap_expired");
    if (professional && driver.tachograph_card_expiry && driver.tachograph_card_expiry < dayKey) {
      warnings.push("tachograph_expired");
    }
    if (driver.unavailable_days?.some((day) => day.date === dayKey)) warnings.push("driver_unavailable");
  }
  if (vehicle) {
    if (vehicle.itv_expiry && vehicle.itv_expiry < dayKey) warnings.push("vehicle_itv_expired");
    if (vehicle.insurance_expiry && vehicle.insurance_expiry < dayKey) warnings.push("vehicle_insurance_expired");
  }
  return warnings;
};

// ---------------------------------------------------------------------------
// Document expiry
// ---------------------------------------------------------------------------

export type DocumentStatus = "expired" | "expiring" | "valid";

/** Days ahead within which a document counts as "expiring soon". */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

/** Null when there is no date on record. */
export const documentStatus = (expiryKey: string | null | undefined, todayKey: string): DocumentStatus | null => {
  if (!expiryKey) return null;
  if (expiryKey < todayKey) return "expired";
  return expiryKey <= addMadridCalendarDays(todayKey, DOCUMENT_EXPIRY_WARNING_DAYS) ? "expiring" : "valid";
};

/** dayKey → status for quick cell lookups. */
export const unavailabilityByDay = (
  driver: Pick<MatrixDriver, "unavailable_days"> | null | undefined,
): Map<string, UnavailabilityStatus> =>
  new Map((driver?.unavailable_days ?? []).map((day) => [day.date, day.status]));

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

/**
 * Transports on each day that still have no driver who has not declined. Runs an
 * outside company handles (a hired bus, a carrier) are not ours to cover.
 */
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
    if (covered.has(event.id) || isExternallyHandledTransport(event)) continue;
    counts.set(event.event_date, (counts.get(event.event_date) ?? 0) + 1);
  }
  return counts;
};

/** One line per non-declined assignment: "Ana Conductora · Tráiler 1", with its status. */
export type EventDriverSummary = { assignmentId: string; label: string; status: DriverAssignmentStatus };

/** eventId → who is driving it (and with what), for calendar cards outside the matrix. */
export const summarizeDriversByEvent = (
  data: Pick<LogisticsMatrixData, "drivers" | "vehicles" | "assignments">,
): Map<string, EventDriverSummary[]> => {
  const driversById = new Map(data.drivers.map((driver) => [driver.id, driver]));
  const vehiclesById = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const summaries = new Map<string, EventDriverSummary[]>();
  for (const assignment of [...data.assignments].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    if (assignment.status === "declined") continue;
    const driver = assignment.driver_id ? driversById.get(assignment.driver_id) : null;
    const vehicle = assignment.vehicle_id ? vehiclesById.get(assignment.vehicle_id) : null;
    const label = [driver ? driverDisplayName(driver) : null, vehicle ? vehicle.name : null]
      .filter((part): part is string => Boolean(part))
      .join(" · ");
    if (!label) continue;
    const list = summaries.get(assignment.logistics_event_id) ?? [];
    list.push({ assignmentId: assignment.id, label, status: assignment.status });
    summaries.set(assignment.logistics_event_id, list);
  }
  return summaries;
};

/**
 * Driver assignments still waiting for the driver's answer whose window starts
 * within `horizonHours` of `nowIso` — the ones dispatch should chase.
 */
export const countPendingConfirmations = (
  assignments: readonly DriverAssignment[],
  nowIso: string,
  horizonHours = 48,
): number => {
  const horizon = new Date(new Date(nowIso).getTime() + horizonHours * 60 * 60 * 1000).toISOString();
  return assignments.filter(
    (assignment) =>
      assignment.driver_id !== null
      && assignment.status === "assigned"
      && assignment.ends_at > nowIso
      && assignment.starts_at <= horizon,
  ).length;
};

/**
 * Default window for a new assignment: from the transport's local time until its
 * end when it has one (a crew transfer keeping the van for days), else two hours.
 */
export const defaultAssignmentWindow = (
  event: Pick<MatrixTransportEvent, "event_date" | "event_time"> &
    Partial<Pick<MatrixTransportEvent, "end_date" | "end_time">>,
): { start: string; end: string } => {
  const start = `${event.event_date}T${event.event_time.slice(0, 5)}`;
  if (event.end_date && event.end_time) {
    return { start, end: `${event.end_date}T${event.end_time.slice(0, 5)}` };
  }
  const [hours, minutes] = event.event_time.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + 120;
  const endDayKey = endMinutes >= 24 * 60 ? addMadridCalendarDays(event.event_date, 1) : event.event_date;
  const wrapped = endMinutes % (24 * 60);
  const end = `${endDayKey}T${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  return { start, end };
};

/**
 * "12/06 08:00 → 15/06 20:00" for a transport with an end, "08:00" otherwise.
 * Local wall-clock values straight from the event, no timezone conversion.
 */
export const formatTransportSpan = (
  event: Pick<MatrixTransportEvent, "event_date" | "event_time"> &
    Partial<Pick<MatrixTransportEvent, "end_date" | "end_time">>,
): string => {
  const time = event.event_time.slice(0, 5);
  if (!event.end_date || !event.end_time) return time;
  const day = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  const endTime = event.end_time.slice(0, 5);
  return event.end_date === event.event_date
    ? `${time}–${endTime}`
    : `${day(event.event_date)} ${time} → ${day(event.end_date)} ${endTime}`;
};

/**
 * When the chosen vehicle cannot seat a crew transfer's passengers (the job crew
 * when no count was given): `{ needed, available }`, else null. Sleeper buses
 * are checked on berths instead (berthShortfall), and a vehicle without seats
 * entered is not second-guessed.
 */
export const seatShortfall = (
  vehicle: Pick<FleetVehicle, "vehicle_type" | "passenger_seats"> | null,
  event: Pick<MatrixTransportEvent, "event_type" | "passenger_count" | "job_crew_count">,
): { needed: number; available: number } | null => {
  if (!vehicle || !isCrewTransfer(event) || vehicle.vehicle_type === "sleeper_bus" || !vehicle.passenger_seats) return null;
  const needed = event.passenger_count ?? event.job_crew_count;
  if (!needed) return null;
  return vehicle.passenger_seats < needed ? { needed, available: vehicle.passenger_seats } : null;
};
