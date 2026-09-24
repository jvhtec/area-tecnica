import { dataLayerClient } from "@/services/dataLayerClient";

import {
  UNAVAILABILITY_STATUSES,
  type DriverAssignment,
  type DriverAssignmentStatus,
  type DriverDetails,
  type DriverUnavailableDay,
  type FleetVehicle,
  type LicenseCategory,
  type LogisticsMatrixData,
  type MatrixDriver,
  type MatrixTransportEvent,
  type MyTransportAssignment,
  type UnavailabilityStatus,
  type VehicleType,
} from "./fleetModel";
import type { DriverLiveLocation } from "./tracking";

// The fleet tables and RPCs postdate the generated Supabase types, so calls go
// through these untyped seams and every payload is normalised field by field.
type RpcResult = { data: unknown; error: { message?: string } | null };
type UntypedRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

// `rpc` must stay bound to the client: SupabaseClient.prototype.rpc reads `this.rest`.
const rpc: UntypedRpc = (name, args) =>
  (dataLayerClient.rpc as unknown as UntypedRpc).call(dataLayerClient, name, args);

const fleetTable = "fleet_vehicles" as never;
const driverDetailsTable = "driver_details" as never;

const throwIfError = (error: { message?: string } | null, fallback: string) => {
  if (error) throw new Error(error.message || fallback);
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const strings = (value: unknown): string[] => asArray(value).filter((item): item is string => typeof item === "string");
const status = (value: unknown): DriverAssignmentStatus =>
  value === "confirmed" || value === "declined" ? value : "assigned";
const isUnavailabilityStatus = (value: unknown): value is UnavailabilityStatus =>
  typeof value === "string" && (UNAVAILABILITY_STATUSES as readonly string[]).includes(value);
const unavailableDays = (value: unknown): DriverUnavailableDay[] =>
  asArray(value).flatMap((item) => {
    const row = asRecord(item);
    const date = strOrNull(row.date);
    return date && isUnavailabilityStatus(row.status) ? [{ date, status: row.status }] : [];
  });

const toVehicle = (value: unknown): FleetVehicle => {
  const row = asRecord(value);
  return {
    id: str(row.id),
    name: str(row.name),
    license_plate: str(row.license_plate),
    vehicle_type: str(row.vehicle_type) as VehicleType,
    required_license: (str(row.required_license) || "C") as LicenseCategory,
    brand: strOrNull(row.brand),
    model: strOrNull(row.model),
    payload_kg: numOrNull(row.payload_kg),
    cargo_length_m: numOrNull(row.cargo_length_m),
    has_tail_lift: row.has_tail_lift === true,
    itv_expiry: strOrNull(row.itv_expiry),
    insurance_expiry: strOrNull(row.insurance_expiry),
    notes: strOrNull(row.notes),
    is_active: row.is_active !== false,
  };
};

const toDriver = (value: unknown): MatrixDriver => {
  const row = asRecord(value);
  return {
    id: str(row.id),
    first_name: strOrNull(row.first_name),
    last_name: strOrNull(row.last_name),
    nickname: strOrNull(row.nickname),
    department: strOrNull(row.department),
    phone: strOrNull(row.phone),
    license_categories: strings(row.license_categories),
    license_expiry: strOrNull(row.license_expiry),
    cap_expiry: strOrNull(row.cap_expiry),
    tachograph_card_expiry: strOrNull(row.tachograph_card_expiry),
    adr_certified: row.adr_certified === true,
    default_vehicle_id: strOrNull(row.default_vehicle_id),
    notes: strOrNull(row.notes),
    unavailable_days: unavailableDays(row.unavailable_days),
  };
};

const toEvent = (value: unknown): MatrixTransportEvent => {
  const row = asRecord(value);
  return {
    id: str(row.id),
    event_type: str(row.event_type),
    transport_type: str(row.transport_type),
    event_date: str(row.event_date),
    event_time: str(row.event_time) || "00:00:00",
    timezone: str(row.timezone) || "Europe/Madrid",
    title: strOrNull(row.title),
    color: strOrNull(row.color),
    job_id: strOrNull(row.job_id),
    job_title: strOrNull(row.job_title),
    license_plate: strOrNull(row.license_plate),
    transport_provider: strOrNull(row.transport_provider),
    loading_bay: strOrNull(row.loading_bay),
    notes: strOrNull(row.notes),
    transport_request_id: strOrNull(row.transport_request_id),
    origin: strOrNull(row.origin),
    destination: strOrNull(row.destination),
    location_name: strOrNull(row.location_name),
    location_address: strOrNull(row.location_address),
    departments: strings(row.departments),
  };
};

const toAssignment = (value: unknown): DriverAssignment => {
  const row = asRecord(value);
  return {
    id: str(row.id),
    logistics_event_id: str(row.logistics_event_id),
    driver_id: strOrNull(row.driver_id),
    vehicle_id: strOrNull(row.vehicle_id),
    starts_at: str(row.starts_at),
    ends_at: str(row.ends_at),
    status: status(row.status),
    notes: strOrNull(row.notes),
    responded_at: strOrNull(row.responded_at),
    decline_reason: strOrNull(row.decline_reason),
  };
};

const toMyAssignment = (value: unknown): MyTransportAssignment => {
  const row = asRecord(value);
  const vehicle = row.vehicle ? asRecord(row.vehicle) : null;
  return {
    id: str(row.id),
    status: status(row.status),
    starts_at: str(row.starts_at),
    ends_at: str(row.ends_at),
    notes: strOrNull(row.notes),
    responded_at: strOrNull(row.responded_at),
    decline_reason: strOrNull(row.decline_reason),
    event_id: str(row.event_id),
    event_type: str(row.event_type),
    transport_type: str(row.transport_type),
    event_date: str(row.event_date),
    event_time: str(row.event_time),
    timezone: str(row.timezone) || "Europe/Madrid",
    title: strOrNull(row.title),
    job_id: strOrNull(row.job_id),
    job_title: strOrNull(row.job_title),
    loading_bay: strOrNull(row.loading_bay),
    event_notes: strOrNull(row.event_notes),
    origin: strOrNull(row.origin),
    destination: strOrNull(row.destination),
    location_name: strOrNull(row.location_name),
    location_address: strOrNull(row.location_address),
    location_lat: numOrNull(row.location_lat),
    location_lng: numOrNull(row.location_lng),
    vehicle: vehicle
      ? {
          id: str(vehicle.id),
          name: str(vehicle.name),
          license_plate: str(vehicle.license_plate),
          vehicle_type: str(vehicle.vehicle_type) as VehicleType,
          has_tail_lift: vehicle.has_tail_lift === true,
        }
      : null,
  };
};

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

export async function fetchLogisticsMatrix(startKey: string, endKey: string): Promise<LogisticsMatrixData> {
  const { data, error } = await rpc("get_logistics_matrix", { p_start: startKey, p_end: endKey });
  throwIfError(error, "No se pudo cargar la matriz de logística");
  const payload = asRecord(data);
  return {
    drivers: asArray(payload.drivers).map(toDriver),
    vehicles: asArray(payload.vehicles).map(toVehicle),
    events: asArray(payload.events).map(toEvent),
    assignments: asArray(payload.assignments).map(toAssignment),
  };
}

export type AssignmentConflict = {
  assignment_id: string;
  kind: "driver" | "vehicle";
  starts_at: string;
  ends_at: string;
  title: string | null;
  timezone: string;
};

export type SaveDriverAssignmentInput = {
  eventId: string;
  driverId: string | null;
  vehicleId: string | null;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  assignmentId?: string | null;
  force?: boolean;
};

export type SaveDriverAssignmentResult =
  | { status: "conflict"; conflicts: AssignmentConflict[] }
  | {
      status: "saved";
      assignmentId: string;
      driverId: string | null;
      previousDriverId: string | null;
      materialChange: boolean;
    };

export async function saveDriverAssignment(input: SaveDriverAssignmentInput): Promise<SaveDriverAssignmentResult> {
  const { data, error } = await rpc("assign_transport_driver", {
    p_event_id: input.eventId,
    p_driver_id: input.driverId,
    p_vehicle_id: input.vehicleId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_notes: input.notes ?? null,
    p_assignment_id: input.assignmentId ?? null,
    p_force: input.force ?? false,
  });
  throwIfError(error, "No se pudo guardar la asignación");
  const payload = asRecord(data);
  if (payload.status === "conflict") {
    return {
      status: "conflict",
      conflicts: asArray(payload.conflicts).map((value) => {
        const row = asRecord(value);
        return {
          assignment_id: str(row.assignment_id),
          kind: row.kind === "vehicle" ? "vehicle" : "driver",
          starts_at: str(row.starts_at),
          ends_at: str(row.ends_at),
          title: strOrNull(row.title),
          timezone: str(row.timezone) || "Europe/Madrid",
        };
      }),
    };
  }
  const assignmentId = strOrNull(payload.assignment_id);
  if (!assignmentId) throw new Error("La asignación no devolvió un identificador válido");
  const result: SaveDriverAssignmentResult = {
    status: "saved",
    assignmentId,
    driverId: strOrNull(payload.driver_id),
    previousDriverId: strOrNull(payload.previous_driver_id),
    materialChange: payload.material_change !== false,
  };
  notifyAfterSave(result);
  return result;
}

export async function removeDriverAssignment(assignmentId: string): Promise<void> {
  const { data, error } = await rpc("remove_transport_driver_assignment", { p_assignment_id: assignmentId });
  throwIfError(error, "No se pudo quitar la asignación");
  const payload = asRecord(data);
  const driverId = strOrNull(payload.driver_id);
  if (driverId) {
    notifyDriverEvent("logistics.driver.removed", {
      // Part of the dedupe key: two removals for one driver must not collapse into one push.
      assignment_id: strOrNull(payload.assignment_id) ?? assignmentId,
      recipient_id: driverId,
      starts_at: strOrNull(payload.starts_at) ?? undefined,
      timezone: strOrNull(payload.timezone) ?? "Europe/Madrid",
      logistics_event_id: strOrNull(payload.logistics_event_id) ?? undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Driver self-service
// ---------------------------------------------------------------------------

export async function fetchMyTransportAssignments(fromKey?: string, toKey?: string): Promise<MyTransportAssignment[]> {
  const { data, error } = await rpc("get_my_transport_assignments", {
    p_from: fromKey ?? null,
    p_to: toKey ?? null,
  });
  throwIfError(error, "No se pudieron cargar tus transportes");
  return asArray(data).map(toMyAssignment);
}

export async function respondToTransportAssignment(
  assignmentId: string,
  response: "confirmed" | "declined",
  reason?: string | null,
): Promise<void> {
  const { error } = await rpc("respond_transport_assignment", {
    p_assignment_id: assignmentId,
    p_response: response,
    // Only meaningful on a refusal; the server clears it on confirm anyway.
    p_reason: response === "declined" ? reason?.trim() || null : null,
  });
  throwIfError(error, "No se pudo registrar tu respuesta");
  notifyDriverEvent(response === "confirmed" ? "logistics.driver.confirmed" : "logistics.driver.declined", {
    assignment_id: assignmentId,
  });
}

export async function fetchOwnDriverDetails(profileId: string): Promise<DriverDetails | null> {
  const { data, error } = await dataLayerClient
    .from(driverDetailsTable)
    .select("profile_id, license_categories, license_expiry, cap_expiry, tachograph_card_expiry, adr_certified, default_vehicle_id, notes")
    .eq("profile_id", profileId)
    .maybeSingle();
  throwIfError(error, "No se pudieron cargar tus datos de conductor");
  if (!data) return null;
  const row = asRecord(data);
  return {
    profile_id: str(row.profile_id),
    license_categories: strings(row.license_categories),
    license_expiry: strOrNull(row.license_expiry),
    cap_expiry: strOrNull(row.cap_expiry),
    tachograph_card_expiry: strOrNull(row.tachograph_card_expiry),
    adr_certified: row.adr_certified === true,
    default_vehicle_id: strOrNull(row.default_vehicle_id),
    notes: strOrNull(row.notes),
  };
}

// ---------------------------------------------------------------------------
// Fleet and driver details management
// ---------------------------------------------------------------------------

export type FleetVehicleInput = Omit<FleetVehicle, "id"> & { id?: string | null };

export async function saveFleetVehicle(input: FleetVehicleInput): Promise<void> {
  const row = {
    name: input.name.trim(),
    license_plate: input.license_plate.trim().toUpperCase(),
    vehicle_type: input.vehicle_type,
    required_license: input.required_license,
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    payload_kg: input.payload_kg,
    cargo_length_m: input.cargo_length_m,
    has_tail_lift: input.has_tail_lift,
    itv_expiry: input.itv_expiry || null,
    insurance_expiry: input.insurance_expiry || null,
    notes: input.notes?.trim() || null,
    is_active: input.is_active,
  };
  const { error } = input.id
    ? await dataLayerClient.from(fleetTable).update(row as never).eq("id", input.id)
    : await dataLayerClient.from(fleetTable).insert(row as never);
  if (error?.message?.includes("uq_fleet_vehicles_license_plate")) {
    throw new Error("Ya existe un vehículo con esa matrícula");
  }
  throwIfError(error, "No se pudo guardar el vehículo");
}

export async function deleteFleetVehicle(vehicleId: string): Promise<void> {
  const { error } = await dataLayerClient.from(fleetTable).delete().eq("id", vehicleId);
  if (error && (error as { code?: string }).code === "23503") {
    throw new Error("El vehículo tiene asignaciones. Desactívalo en lugar de eliminarlo.");
  }
  throwIfError(error, "No se pudo eliminar el vehículo");
}

export type DriverDetailsInput = Omit<DriverDetails, "profile_id"> & { profileId: string };

export async function saveDriverDetails(input: DriverDetailsInput): Promise<void> {
  const { error } = await dataLayerClient.from(driverDetailsTable).upsert(
    {
      profile_id: input.profileId,
      license_categories: input.license_categories,
      license_expiry: input.license_expiry || null,
      cap_expiry: input.cap_expiry || null,
      tachograph_card_expiry: input.tachograph_card_expiry || null,
      adr_certified: input.adr_certified,
      default_vehicle_id: input.default_vehicle_id || null,
      notes: input.notes?.trim() || null,
    } as never,
    { onConflict: "profile_id" },
  );
  throwIfError(error, "No se pudieron guardar los datos del conductor");
}

// ---------------------------------------------------------------------------
// Live location
// ---------------------------------------------------------------------------

export type ReportDriverLocationInput = {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  assignmentId?: string | null;
};

const finiteOrNull = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Sends one fix; resolves to the server timestamp it was recorded at. */
export async function reportDriverLocation(input: ReportDriverLocationInput): Promise<string> {
  const { data, error } = await rpc("report_driver_location", {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: finiteOrNull(input.accuracyM),
    p_heading_deg: finiteOrNull(input.headingDeg),
    p_speed_mps: finiteOrNull(input.speedMps),
    p_assignment_id: input.assignmentId ?? null,
  });
  throwIfError(error, "No se pudo enviar la posición");
  return strOrNull(asRecord(data).recorded_at) ?? new Date().toISOString();
}

/** Deletes the driver's stored position. */
export async function stopSharingDriverLocation(): Promise<void> {
  const { error } = await rpc("stop_sharing_driver_location");
  throwIfError(error, "No se pudo dejar de compartir la ubicación");
}

const toLiveLocation = (value: unknown): DriverLiveLocation | null => {
  const row = asRecord(value);
  const latitude = numOrNull(row.latitude);
  const longitude = numOrNull(row.longitude);
  const driverId = strOrNull(row.driver_id);
  const recordedAt = strOrNull(row.recorded_at);
  if (!driverId || !recordedAt || latitude === null || longitude === null) return null;
  const assignment = row.assignment ? asRecord(row.assignment) : null;
  return {
    driver_id: driverId,
    first_name: strOrNull(row.first_name),
    last_name: strOrNull(row.last_name),
    nickname: strOrNull(row.nickname),
    latitude,
    longitude,
    accuracy_m: numOrNull(row.accuracy_m),
    heading_deg: numOrNull(row.heading_deg),
    speed_mps: numOrNull(row.speed_mps),
    recorded_at: recordedAt,
    assignment: assignment && strOrNull(assignment.id)
      ? {
          id: str(assignment.id),
          status: status(assignment.status),
          starts_at: str(assignment.starts_at),
          ends_at: str(assignment.ends_at),
          event_type: strOrNull(assignment.event_type),
          title: strOrNull(assignment.title),
          timezone: str(assignment.timezone) || "Europe/Madrid",
          vehicle_name: strOrNull(assignment.vehicle_name),
          vehicle_plate: strOrNull(assignment.vehicle_plate),
          destination_name: strOrNull(assignment.destination_name),
          destination_lat: numOrNull(assignment.destination_lat),
          destination_lng: numOrNull(assignment.destination_lng),
        }
      : null,
  };
};

export async function fetchDriverLocations(): Promise<DriverLiveLocation[]> {
  const { data, error } = await rpc("get_driver_locations");
  throwIfError(error, "No se pudo cargar la ubicación de los conductores");
  return asArray(data).flatMap((row) => {
    const location = toLiveLocation(row);
    return location ? [location] : [];
  });
}

// ---------------------------------------------------------------------------
// Map preview (static-map edge function, any authenticated user)
// ---------------------------------------------------------------------------

export type StaticMapInput = { lat: number | null; lng: number | null; address: string | null };

/** A data URL for a small map centred on the venue, or null when it cannot be drawn. */
export async function fetchStaticMap(input: StaticMapInput): Promise<string | null> {
  const hasPoint = input.lat !== null && input.lng !== null;
  if (!hasPoint && !input.address) return null;
  const { data, error } = await dataLayerClient.functions.invoke("static-map", {
    body: {
      ...(hasPoint ? { lat: input.lat, lng: input.lng } : { address: input.address }),
      width: 640,
      height: 280,
      zoom: 14,
    },
  });
  if (error) throw new Error(error.message || "No se pudo cargar el mapa");
  const dataUrl = asRecord(data).dataUrl;
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") ? dataUrl : null;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type DriverPushEvent =
  | "logistics.driver.assigned"
  | "logistics.driver.updated"
  | "logistics.driver.removed"
  | "logistics.driver.confirmed"
  | "logistics.driver.declined";

/**
 * Fire-and-forget, like the other logistics pushes: the change is already
 * committed when the RPC returns, so a push failure must not surface as a failed
 * assignment. The push function resolves recipients and message text from the
 * assignment itself rather than trusting this body.
 */
function notifyDriverEvent(type: DriverPushEvent, body: Record<string, string | undefined>) {
  void dataLayerClient.functions
    .invoke("push", { body: { action: "broadcast", type, ...body } })
    .catch(() => undefined);
}

function notifyAfterSave(result: Extract<SaveDriverAssignmentResult, { status: "saved" }>) {
  if (result.previousDriverId && result.previousDriverId !== result.driverId) {
    notifyDriverEvent("logistics.driver.removed", {
      assignment_id: result.assignmentId,
      recipient_id: result.previousDriverId,
    });
  }
  if (!result.driverId) return;
  if (result.previousDriverId === result.driverId) {
    if (result.materialChange) {
      notifyDriverEvent("logistics.driver.updated", { assignment_id: result.assignmentId });
    }
    return;
  }
  notifyDriverEvent("logistics.driver.assigned", { assignment_id: result.assignmentId });
}
