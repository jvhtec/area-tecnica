import type { UnknownRecord } from "@/features/tour-ops/tourSchedulingNormalizers";
import {
  asArray,
  displayName,
  isRecord,
  normalizeComparison,
  serializeRoomAllocation,
  textOrNull,
} from "@/features/tour-ops/tourSchedulingNormalizers";
import type {
  TourOpsAccommodation,
  TourOpsModel,
  TourOpsProgramDay,
  TourOpsRoomAssignment,
  TourOpsTimelineEvent,
  TourOpsTravelSegment
} from "@/features/tour-ops/types";
import type { Json } from "@/integrations/supabase/types";
import { dataLayerClient } from "@/services/dataLayerClient";

const client = dataLayerClient;

const toJson = (value: unknown): Json => {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJson(entry)]));
  }
  return null;
};

export type TourOpsHojaMutationResult = {
  id?: string | null;
  opsId?: string | null;
  hojaRowId?: string | null;
  hojaDocumentVersion?: number | null;
  hojaStatus?: string | null;
  approvalInvalidated: boolean;
};

const parseHojaMutationResult = (value: unknown): TourOpsHojaMutationResult => {
  const row = isRecord(value) ? value : {};
  return {
    id: textOrNull(row.id),
    opsId: textOrNull(row.ops_id),
    hojaRowId: textOrNull(row.hoja_row_id),
    hojaDocumentVersion: typeof row.hoja_document_version === "number" ? row.hoja_document_version : null,
    hojaStatus: textOrNull(row.hoja_status ?? row.status),
    approvalInvalidated: Boolean(row.approval_invalidated),
  };
};

export async function saveTimelineEvent(input: Partial<TourOpsTimelineEvent> & { tourId: string; date: string; title: string }) {
  const payload = {
    tour_id: input.tourId,
    event_type: input.eventType || "other",
    title: input.title,
    description: input.description || null,
    date: input.date,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    timezone: input.timezone || "Europe/Madrid",
    all_day: Boolean(input.allDay),
    location_id: input.locationId || null,
    location_details: input.locationDetails || null,
    departments: input.departments || [],
    visible_to_crew: input.visibleToCrew !== false,
    metadata: toJson(input.metadata || {}),
  };

  if (input.id) {
    const { error } = await client.from("tour_timeline_events").update(payload).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await client.from("tour_timeline_events").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function saveProgramSchedule(input: {
  hojaDeRutaId: string;
  expectedHojaVersion: number;
  program: TourOpsProgramDay[];
}) {
  const { data, error } = await client.rpc("save_tour_ops_hoja_program", {
    p_hoja_id: input.hojaDeRutaId,
    p_expected_version: input.expectedHojaVersion,
    p_program: toJson(input.program),
  });
  if (error) throw error;
  return parseHojaMutationResult(data);
}

export async function deleteTimelineEvent(id: string) {
  const { error } = await client.from("tour_timeline_events").delete().eq("id", id);
  if (error) throw error;
}

export const normalizeDbTimestamp = (date: string | null | undefined, timeOrTimestamp: string | null | undefined) => {
  if (!timeOrTimestamp) return null;
  if (timeOrTimestamp.includes("T")) return timeOrTimestamp;
  if (!date) return null;
  return `${date}T${timeOrTimestamp.length === 5 ? `${timeOrTimestamp}:00` : timeOrTimestamp}`;
};

export const normalizeHojaTransportationType = (value: string | null | undefined) => {
  const raw = normalizeComparison(value);
  if (raw === "plane") return "plane";
  if (raw === "train") return "train";
  if (raw === "rv") return "RV";
  if (raw === "sleeper_bus" || raw === "bus" || raw === "autobus") return "sleeper_bus";
  return "van";
};

export const hojaTravelPayloadFromSegment = (input: Partial<TourOpsTravelSegment>) => ({
  transportation_type: normalizeHojaTransportationType(input.transportationType),
  pickup_address: input.fromLabel && input.fromLabel !== "Origen" ? input.fromLabel : null,
  pickup_time: input.departureTime || null,
  departure_time: input.departureTime || null,
  arrival_time: input.arrivalTime || null,
  flight_train_number: input.carrierName || null,
  driver_name: textOrNull((input.vehicleDetails as UnknownRecord | null)?.driverName),
  driver_phone: textOrNull((input.vehicleDetails as UnknownRecord | null)?.driverPhone),
  plate_number: textOrNull((input.vehicleDetails as UnknownRecord | null)?.plateNumber),
  notes: input.routeNotes || null,
});

export const hojaTransportPayloadFromSegment = (input: Partial<TourOpsTravelSegment>) => ({
  transport_type: input.transportationType || "furgoneta",
  date_time: input.departureTime || null,
  return_date_time: input.arrivalTime || null,
  company: input.carrierName || null,
  driver_name: textOrNull((input.vehicleDetails as UnknownRecord | null)?.driverName),
  driver_phone: textOrNull((input.vehicleDetails as UnknownRecord | null)?.driverPhone),
  license_plate: textOrNull((input.vehicleDetails as UnknownRecord | null)?.plateNumber),
});

export const opsTravelPayloadFromSegment = (input: Partial<TourOpsTravelSegment> & { tourId: string }) => ({
  tour_id: input.tourId,
  from_tour_date_id: input.fromTourDateId || null,
  to_tour_date_id: input.toTourDateId || null,
  from_location_id: input.fromLocationId || null,
  to_location_id: input.toLocationId || null,
  transportation_type: input.transportationType || "bus",
  departure_time: input.departureTime || null,
  arrival_time: input.arrivalTime || null,
  carrier_name: input.carrierName || null,
  vehicle_details: toJson(input.source === "hoja"
    ? {
        ...(isRecord(input.vehicleDetails) ? input.vehicleDetails : {}),
        hojaSourceId: input.id,
        hojaSourceTable: input.sourceTable,
        hojaDeRutaId: input.hojaDeRutaId,
      }
    : input.vehicleDetails || {}),
  distance_km: input.distanceKm ?? null,
  estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
  route_notes: input.routeNotes || null,
  stops: toJson(input.stops || []),
  crew_manifest: toJson(input.crewManifest || []),
  luggage_truck: Boolean(input.luggageTruck),
  status: input.status || "planned",
});

export async function saveTravelSegment(input: Partial<TourOpsTravelSegment> & {
  tourId: string;
  expectedHojaVersions?: Record<string, number>;
}) {
  if (input.source === "legacy") {
    throw new Error("Migra primero el viaje legacy antes de editarlo");
  }

  const source = input.source === "hoja" ? "hoja" : "normalized";
  const opsPayload = opsTravelPayloadFromSegment(input);
  const hojaPayload = input.sourceTable === "hoja_de_ruta_transport"
    ? hojaTransportPayloadFromSegment(input)
    : hojaTravelPayloadFromSegment(input);

  const { data, error } = await client.rpc("save_tour_ops_travel", {
    p_tour_id: input.tourId,
    p_source: source,
    p_segment_id: source === "normalized" ? input.id || null : null,
    p_hoja_id: input.hojaDeRutaId || null,
    p_hoja_row_id: source === "hoja" ? input.id || null : null,
    p_hoja_source_table: input.sourceTable || "hoja_de_ruta_travel_arrangements",
    p_expected_hoja_versions: toJson(input.expectedHojaVersions || {}),
    p_expected_ops_updated_at: source === "normalized" ? input.updatedAt || null : null,
    p_ops_payload: toJson(opsPayload),
    p_hoja_payload: toJson(hojaPayload),
  });
  if (error) throw error;
  return parseHojaMutationResult(data);
}

export async function deleteTravelSegment(input: {
  id: string;
  expectedHojaVersions?: Record<string, number>;
  updatedAt?: string | null;
}) {
  const { data, error } = await client.rpc("delete_tour_ops_travel", {
    p_segment_id: input.id,
    p_expected_hoja_versions: toJson(input.expectedHojaVersions || {}),
    p_expected_ops_updated_at: input.updatedAt || null,
  });
  if (error) throw error;
  return parseHojaMutationResult(data);
}

export const opsAccommodationPayloadFromHotel = (input: Partial<TourOpsAccommodation> & { tourId: string }) => ({
  tour_id: input.tourId,
  tour_date_id: input.tourDateId || null,
  hotel_name: input.hotelName || "Hotel",
  hotel_address: input.hotelAddress || null,
  location_id: input.locationId || null,
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
  check_in_date: input.checkInDate || null,
  check_out_date: input.checkOutDate || input.checkInDate || null,
  confirmation_number: input.confirmationNumber || null,
  room_allocation: toJson(serializeRoomAllocation(input.roomAllocation)),
  rooms_booked: input.roomsBooked ?? serializeRoomAllocation(input.roomAllocation).length,
  notes: input.notes || null,
  status: "planned",
});

export const hojaAccommodationPayloadFromHotel = (input: Partial<TourOpsAccommodation>) => ({
  hotel_name: input.hotelName || "Hotel",
  address: input.hotelAddress || null,
  check_in: input.checkInDate || null,
  check_out: input.checkOutDate || input.checkInDate || null,
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
});

export const hojaStaffStorageLookup = async (hojaId: string) => {
  const { data, error } = await client
    .from("hoja_de_ruta_staff")
    .select("id, technician_id, name, surname1, surname2, position")
    .eq("hoja_de_ruta_id", hojaId);
  if (error) throw error;

  const byValue = new Map<string, string>();
  asArray<UnknownRecord>(data).forEach((member) => {
    const canonicalId = textOrNull(member.id);
    if (!canonicalId) return;
    [textOrNull(member.id), textOrNull(member.technician_id)]
      .filter(Boolean)
      .forEach((key) => byValue.set(key as string, canonicalId));
    const name = displayName(member.name, member.surname1, member.surname2);
    if (name) byValue.set(name, canonicalId);
  });
  return byValue;
};

export const buildHojaRoomAssignmentRows = (
  accommodationId: string,
  rooms: TourOpsRoomAssignment[] | undefined | null,
  staffValueLookup: Map<string, string>,
) => {
  const resolveStaffId = (value: unknown, rawValue: unknown, name: unknown) => {
    const normalizedValue = textOrNull(value);
    const raw = textOrNull(rawValue);
    const normalizedName = textOrNull(name);
    if (normalizedValue && staffValueLookup.has(normalizedValue)) return staffValueLookup.get(normalizedValue);
    if (raw && staffValueLookup.has(raw)) return staffValueLookup.get(raw);
    if (normalizedName && staffValueLookup.has(normalizedName)) return staffValueLookup.get(normalizedName);
    return null;
  };

  return asArray<TourOpsRoomAssignment>(rooms)
    .filter((room) =>
      room.roomType ||
      room.roomNumber ||
      room.staffMember1Id ||
      room.staffMember2Id ||
      room.staffMember1Name ||
      room.staffMember2Name
    )
    .map((room, sortOrder) => {
      const staff1Id = resolveStaffId(room.staffMember1Id, room.rawStaffMember1Id, room.staffMember1Name);
      const staff2Id = resolveStaffId(room.staffMember2Id, room.rawStaffMember2Id, room.staffMember2Name);
      return {
        id: room.id || crypto.randomUUID(),
        accommodation_id: accommodationId,
        room_type: room.roomType || "single",
        room_number: room.roomNumber || "",
        staff_member1_hoja_staff_id: staff1Id,
        staff_member2_hoja_staff_id: staff2Id,
        // These text columns are no longer identity fields. They only retain a
        // current free-text occupant when no canonical Hoja staff row exists.
        staff_member1_id: staff1Id
          ? null
          : textOrNull(room.staffMember1Name) ?? textOrNull(room.staffMember1Id) ?? textOrNull(room.rawStaffMember1Id),
        staff_member2_id: staff2Id
          ? null
          : textOrNull(room.staffMember2Name) ?? textOrNull(room.staffMember2Id) ?? textOrNull(room.rawStaffMember2Id),
        sort_order: sortOrder,
      };
    });
};

export async function saveAccommodation(input: Partial<TourOpsAccommodation> & {
  tourId: string;
  expectedHojaVersions?: Record<string, number>;
}) {
  const isLegacyHotelInfo = Boolean(input.id?.startsWith("hotel-info:"));
  if (isLegacyHotelInfo) throw new Error("Migra primero el alojamiento legacy antes de editarlo");

  // See above: rebuild from narrowed locals so the NOT NULL columns type as `string`.
  const { check_in_date, check_out_date, ...restPayload } = opsAccommodationPayloadFromHotel(input);
  if (!check_in_date || !check_out_date) {
    throw new Error("Check-in y check-out son obligatorios");
  }
  const payload = { ...restPayload, check_in_date, check_out_date };

  const source = input.source === "hoja" ? "hoja" : "normalized";
  const rooms = input.hojaDeRutaId
    ? buildHojaRoomAssignmentRows(
        input.id || crypto.randomUUID(),
        input.roomAllocation,
        await hojaStaffStorageLookup(input.hojaDeRutaId),
      )
    : [];

  const { data, error } = await client.rpc("save_tour_ops_accommodation", {
    p_tour_id: input.tourId,
    p_source: source,
    p_accommodation_id: source === "normalized" ? input.id || null : null,
    p_hoja_id: input.hojaDeRutaId || null,
    p_hoja_row_id: source === "hoja" ? input.id || null : null,
    p_expected_hoja_versions: toJson(input.expectedHojaVersions || {}),
    p_expected_ops_updated_at: source === "normalized" ? input.updatedAt || null : null,
    p_ops_payload: toJson(payload),
    p_hoja_payload: toJson(hojaAccommodationPayloadFromHotel(input)),
    p_rooms: toJson(rooms),
  });
  if (error) throw error;
  return parseHojaMutationResult(data);
}

export async function deleteAccommodation(input: {
  id: string;
  source?: TourOpsAccommodation["source"];
  hojaDeRutaId?: string | null;
  expectedHojaVersions?: Record<string, number>;
  updatedAt?: string | null;
}) {
  const { data, error } = await client.rpc("delete_tour_ops_accommodation", {
    p_source: input.source === "hoja" ? "hoja" : "normalized",
    p_accommodation_id: input.id,
    p_hoja_id: input.hojaDeRutaId || null,
    p_expected_hoja_versions: toJson(input.expectedHojaVersions || {}),
    p_expected_ops_updated_at: input.source === "hoja" ? null : input.updatedAt || null,
  });
  if (error) throw error;
  return parseHojaMutationResult(data);
}

export async function migrateLegacyTravelPlan(model: TourOpsModel) {
  const legacySegments = model.travelSegments.filter((segment) => segment.source === "legacy");
  if (legacySegments.length === 0) return 0;

  const dateById = new Map(model.dates.map((date) => [date.id, date]));
  const rows = legacySegments.map((segment) => {
    const fromDate = segment.fromTourDateId ? dateById.get(segment.fromTourDateId) : null;
    const toDate = segment.toTourDateId ? dateById.get(segment.toTourDateId) : null;
    const departureAnchorDate = fromDate?.date ?? toDate?.date ?? model.tour.startDate;
    const arrivalAnchorDate = toDate?.date ?? fromDate?.date ?? model.tour.startDate;

    return {
      tour_id: model.tour.id,
      from_tour_date_id: segment.fromTourDateId,
      to_tour_date_id: segment.toTourDateId,
      from_location_id: segment.fromLocationId,
      to_location_id: segment.toLocationId,
      transportation_type: segment.transportationType,
      departure_time: normalizeDbTimestamp(departureAnchorDate, segment.departureTime),
      arrival_time: normalizeDbTimestamp(arrivalAnchorDate, segment.arrivalTime),
      carrier_name: segment.carrierName,
      vehicle_details: toJson(segment.vehicleDetails ?? {}),
      distance_km: segment.distanceKm,
      estimated_duration_minutes: segment.estimatedDurationMinutes,
      route_notes: segment.routeNotes,
      stops: toJson(segment.stops),
      crew_manifest: toJson(segment.crewManifest),
      luggage_truck: segment.luggageTruck,
      status: segment.status ?? "planned",
    };
  });

  const { error } = await client.from("tour_travel_segments").insert(rows);
  if (error) throw error;

  return rows.length;
}
