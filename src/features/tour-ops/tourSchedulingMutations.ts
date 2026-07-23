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

export async function saveProgramSchedule(input: { hojaDeRutaId: string; program: TourOpsProgramDay[] }) {
  const { error } = await client
    .from("hoja_de_ruta")
    .update({
      program_schedule_json: toJson(input.program),
      last_modified: new Date().toISOString(),
    })
    .eq("id", input.hojaDeRutaId);
  if (error) throw error;
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

export const getHojaForTourDate = async (
  tourDateId: string | null | undefined,
): Promise<{ id: string; tourDateId: string | null } | null> => {
  if (!tourDateId) return null;
  const { data, error } = await client
    .from("hoja_de_ruta")
    .select("id, tour_date_id")
    .eq("tour_date_id", tourDateId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, tourDateId: data.tour_date_id } : null;
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

export const upsertOpsTravelFromHoja = async (input: Partial<TourOpsTravelSegment> & { tourId: string }) => {
  if (!input.id) return false;
  const payload = opsTravelPayloadFromSegment(input);
  const { data: existing, error: existingError } = await client
    .from("tour_travel_segments")
    .select("id")
    .eq("tour_id", input.tourId)
    .contains("vehicle_details", { hojaSourceId: input.id })
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await client.from("tour_travel_segments").update(payload).eq("id", existing.id);
    if (error) throw error;
    return true;
  }

  const { error } = await client.from("tour_travel_segments").insert(payload);
  if (error) throw error;
  return true;
};

export const hojaTravelRowMatchesPayload = (row: UnknownRecord, payload: UnknownRecord) =>
  normalizeComparison(row.transportation_type) === normalizeComparison(payload.transportation_type) &&
  normalizeComparison(row.pickup_address) === normalizeComparison(payload.pickup_address) &&
  normalizeComparison(row.departure_time) === normalizeComparison(payload.departure_time) &&
  normalizeComparison(row.arrival_time) === normalizeComparison(payload.arrival_time) &&
  normalizeComparison(row.flight_train_number) === normalizeComparison(payload.flight_train_number) &&
  normalizeComparison(row.notes) === normalizeComparison(payload.notes);

export const syncSegmentToHoja = async (input: Partial<TourOpsTravelSegment>) => {
  const targetDateId = input.toTourDateId || input.fromTourDateId;
  const hoja = await getHojaForTourDate(targetDateId);
  if (!hoja?.id) return false;

  const payload = {
    hoja_de_ruta_id: hoja.id,
    ...hojaTravelPayloadFromSegment(input),
  };

  const linkedHojaSourceId = textOrNull((input.vehicleDetails as UnknownRecord | null)?.hojaSourceId);
  if (linkedHojaSourceId) {
    const { data: existingLinked, error: existingLinkedError } = await client
      .from("hoja_de_ruta_travel_arrangements")
      .select("id, transportation_type, pickup_address, departure_time, arrival_time, flight_train_number, notes")
      .eq("id", linkedHojaSourceId)
      .maybeSingle();
    if (existingLinkedError) throw existingLinkedError;
    if (existingLinked && hojaTravelRowMatchesPayload(existingLinked, payload)) return false;

    const { error } = await client
      .from("hoja_de_ruta_travel_arrangements")
      .update(payload)
      .eq("id", linkedHojaSourceId);
    if (error) throw error;
    return true;
  }

  const { data: existing, error: existingError } = await client
    .from("hoja_de_ruta_travel_arrangements")
    .select("id, transportation_type, pickup_address, departure_time, arrival_time, flight_train_number, notes")
    .eq("hoja_de_ruta_id", hoja.id);
  if (existingError) throw existingError;

  const alreadyExists = asArray<UnknownRecord>(existing).some((row) => hojaTravelRowMatchesPayload(row, payload));
  if (alreadyExists) return false;

  const { error } = await client.from("hoja_de_ruta_travel_arrangements").insert(payload);
  if (error) throw error;
  return true;
};

export async function saveTravelSegment(input: Partial<TourOpsTravelSegment> & { tourId: string }) {
  if (input.source === "hoja" && input.id) {
    const payload = hojaTravelPayloadFromSegment(input);
    const table = input.sourceTable === "hoja_de_ruta_transport"
      ? "hoja_de_ruta_transport"
      : "hoja_de_ruta_travel_arrangements";

    await upsertOpsTravelFromHoja(input);

    if (table === "hoja_de_ruta_transport") {
      const { error } = await client
        .from("hoja_de_ruta_transport")
        .update({
          transport_type: input.transportationType || "furgoneta",
          date_time: input.departureTime || null,
          return_date_time: input.arrivalTime || null,
          company: input.carrierName || null,
          driver_name: textOrNull((input.vehicleDetails as UnknownRecord | null)?.driverName),
          driver_phone: textOrNull((input.vehicleDetails as UnknownRecord | null)?.driverPhone),
          license_plate: textOrNull((input.vehicleDetails as UnknownRecord | null)?.plateNumber),
        })
        .eq("id", input.id);
      if (error) throw error;
      return input.id;
    }

    const { error } = await client.from("hoja_de_ruta_travel_arrangements").update(payload).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }

  const payload = opsTravelPayloadFromSegment(input);

  if (input.id && input.source !== "legacy") {
    const { error } = await client.from("tour_travel_segments").update(payload).eq("id", input.id);
    if (error) throw error;
    await syncSegmentToHoja(input);
    return input.id;
  }

  const { data, error } = await client.from("tour_travel_segments").insert(payload).select("id").single();
  if (error) throw error;
  await syncSegmentToHoja({ ...input, id: data.id as string, source: "normalized" });
  return data.id as string;
}

export async function deleteTravelSegment(id: string) {
  const { error } = await client.from("tour_travel_segments").delete().eq("id", id);
  if (error) throw error;
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
    .select("id, name, surname1, surname2, position")
    .eq("hoja_de_ruta_id", hojaId);
  if (error) throw error;

  const byValue = new Map<string, string>();
  asArray<UnknownRecord>(data).forEach((member, index) => {
    const indexValue = String(index);
    [textOrNull(member.id), textOrNull(member.technician_id)]
      .filter(Boolean)
      .forEach((key) => byValue.set(key as string, indexValue));
    const name = displayName(member.name, member.surname1, member.surname2);
    if (name) byValue.set(name, indexValue);
  });
  return byValue;
};

export const replaceHojaRoomAssignments = async (
  accommodationId: string,
  hojaId: string | null | undefined,
  rooms: TourOpsRoomAssignment[] | undefined | null,
) => {
  const serializedRooms = serializeRoomAllocation(rooms);
  const { error: deleteError } = await client
    .from("hoja_de_ruta_room_assignments")
    .delete()
    .eq("accommodation_id", accommodationId);
  if (deleteError) throw deleteError;
  if (serializedRooms.length === 0) return;

  const staffValueLookup = hojaId ? await hojaStaffStorageLookup(hojaId) : new Map<string, string>();
  const staffValue = (value: unknown, rawValue: unknown) => {
    const normalizedValue = textOrNull(value);
    const raw = textOrNull(rawValue);
    if (normalizedValue && staffValueLookup.has(normalizedValue)) return staffValueLookup.get(normalizedValue);
    if (raw && staffValueLookup.has(raw)) return staffValueLookup.get(raw);
    return normalizedValue ?? raw;
  };

  const rows = asArray<TourOpsRoomAssignment>(rooms)
    .filter((room) => room.roomType || room.roomNumber || room.staffMember1Id || room.staffMember2Id)
    .map((room) => ({
      accommodation_id: accommodationId,
      room_type: room.roomType || "single",
      room_number: room.roomNumber || "",
      staff_member1_id: staffValue(room.staffMember1Id, room.rawStaffMember1Id) ?? null,
      staff_member2_id: staffValue(room.staffMember2Id, room.rawStaffMember2Id) ?? null,
    }));
  if (rows.length === 0) return;

  const { error } = await client.from("hoja_de_ruta_room_assignments").insert(rows);
  if (error) throw error;
};

export const findSimilarOpsAccommodation = async (input: Partial<TourOpsAccommodation> & { tourId: string }) => {
  if (!input.tourDateId || !input.hotelName) return null;
  const { data, error } = await client
    .from("tour_accommodations")
    .select("id")
    .eq("tour_id", input.tourId)
    .eq("tour_date_id", input.tourDateId)
    .ilike("hotel_name", input.hotelName)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
};

export const upsertOpsAccommodationFromHoja = async (input: Partial<TourOpsAccommodation> & { tourId: string }) => {
  const payload = opsAccommodationPayloadFromHotel(input);
  if (!payload.check_in_date || !payload.check_out_date) return false;

  const existing = await findSimilarOpsAccommodation(input);
  if (existing?.id) {
    const { error } = await client.from("tour_accommodations").update(payload).eq("id", existing.id);
    if (error) throw error;
    return true;
  }

  const { error } = await client.from("tour_accommodations").insert(payload);
  if (error) throw error;
  return true;
};

export const syncAccommodationToHoja = async (input: Partial<TourOpsAccommodation>) => {
  const hoja = await getHojaForTourDate(input.tourDateId);
  if (!hoja?.id) return false;

  const payload = {
    hoja_de_ruta_id: hoja.id,
    ...hojaAccommodationPayloadFromHotel(input),
  };

  const { data: existing, error: existingError } = await client
    .from("hoja_de_ruta_accommodations")
    .select("id, hotel_name")
    .eq("hoja_de_ruta_id", hoja.id)
    .ilike("hotel_name", payload.hotel_name)
    .limit(1);
  if (existingError) throw existingError;

  const existingRow = existing?.[0];
  if (existingRow?.id) {
    const { error } = await client.from("hoja_de_ruta_accommodations").update(payload).eq("id", existingRow.id);
    if (error) throw error;
    await replaceHojaRoomAssignments(existingRow.id, hoja.id, input.roomAllocation);
    return true;
  }

  const { data, error } = await client.from("hoja_de_ruta_accommodations").insert(payload).select("id").single();
  if (error) throw error;
  await replaceHojaRoomAssignments(data.id as string, hoja.id, input.roomAllocation);
  return true;
};

export async function saveAccommodation(input: Partial<TourOpsAccommodation> & { tourId: string }) {
  const isLegacyHotelInfo = Boolean(input.id?.startsWith("hotel-info:"));

  if (input.source === "hoja" && input.id && !isLegacyHotelInfo) {
    await upsertOpsAccommodationFromHoja(input);
    const { error } = await client
      .from("hoja_de_ruta_accommodations")
      .update(hojaAccommodationPayloadFromHotel(input))
      .eq("id", input.id);
    if (error) throw error;
    await replaceHojaRoomAssignments(input.id, input.hojaDeRutaId, input.roomAllocation);
    return input.id;
  }

  const payload = opsAccommodationPayloadFromHotel(input);
  if (!payload.check_in_date || !payload.check_out_date) {
    throw new Error("Check-in y check-out son obligatorios");
  }

  if (input.id && !isLegacyHotelInfo) {
    const { error } = await client.from("tour_accommodations").update(payload).eq("id", input.id);
    if (error) throw error;
    await syncAccommodationToHoja(input);
    return input.id;
  }

  const { data, error } = await client.from("tour_accommodations").insert(payload).select("id").single();
  if (error) throw error;
  await syncAccommodationToHoja({ ...input, id: data.id as string, source: "normalized" });
  return data.id as string;
}

export async function deleteAccommodation(input: { id: string; source?: TourOpsAccommodation["source"] }) {
  const table = input.source === "hoja" ? "hoja_de_ruta_accommodations" : "tour_accommodations";
  const { error } = await client.from(table).delete().eq("id", input.id);
  if (error) throw error;
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

export const similarTravelExists = (segment: TourOpsTravelSegment, candidates: TourOpsTravelSegment[], source: TourOpsTravelSegment["source"]) =>
  candidates.some((candidate) =>
    candidate.source === source &&
    candidate.fromTourDateId === segment.fromTourDateId &&
    candidate.toTourDateId === segment.toTourDateId &&
    normalizeComparison(candidate.transportationType) === normalizeComparison(segment.transportationType) &&
    normalizeComparison(candidate.departureTime) === normalizeComparison(segment.departureTime) &&
    normalizeComparison(candidate.arrivalTime) === normalizeComparison(segment.arrivalTime)
  );

export const similarAccommodationExists = (
  accommodation: TourOpsAccommodation,
  candidates: TourOpsAccommodation[],
  source: TourOpsAccommodation["source"],
) =>
  candidates.some((candidate) =>
    candidate.source === source &&
    candidate.tourDateId === accommodation.tourDateId &&
    normalizeComparison(candidate.hotelName) === normalizeComparison(accommodation.hotelName) &&
    normalizeComparison(candidate.checkInDate) === normalizeComparison(accommodation.checkInDate) &&
    normalizeComparison(candidate.checkOutDate) === normalizeComparison(accommodation.checkOutDate)
  );

export async function syncHojaRutaOpsData(model: TourOpsModel) {
  const dateById = new Map(model.dates.map((date) => [date.id, date]));
  let insertedTravelSegments = 0;
  let insertedHojaTravelRows = 0;
  let insertedAccommodations = 0;
  let insertedHojaAccommodations = 0;

  const hojaTravelToNormalize = model.travelSegments.filter((segment) =>
    segment.source === "hoja" && !similarTravelExists(segment, model.travelSegments, "normalized")
  );
  if (hojaTravelToNormalize.length > 0) {
    const rows = hojaTravelToNormalize.map((segment) => {
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
        vehicle_details: toJson({
          ...(isRecord(segment.vehicleDetails) ? segment.vehicleDetails : {}),
          hojaSourceId: segment.id,
          hojaSourceTable: segment.sourceTable,
          hojaDeRutaId: segment.hojaDeRutaId,
        }),
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
    insertedTravelSegments = rows.length;
  }

  const normalizedTravelToHoja = model.travelSegments.filter((segment) =>
    segment.source === "normalized" && !similarTravelExists(segment, model.travelSegments, "hoja")
  );
  for (const segment of normalizedTravelToHoja) {
    if (await syncSegmentToHoja(segment)) {
      insertedHojaTravelRows += 1;
    }
  }

  const hojaHotelsToNormalize = model.accommodations.filter((hotel) =>
    hotel.source === "hoja" && !similarAccommodationExists(hotel, model.accommodations, "normalized")
  );
  if (hojaHotelsToNormalize.length > 0) {
    const rows = hojaHotelsToNormalize.map((hotel) => {
      const date = hotel.tourDateId ? dateById.get(hotel.tourDateId) : null;
      const checkIn = hotel.checkInDate ?? date?.date ?? model.tour.startDate;
      const checkOut = hotel.checkOutDate ?? checkIn;
      return {
        tour_id: model.tour.id,
        tour_date_id: hotel.tourDateId,
        hotel_name: hotel.hotelName,
        hotel_address: hotel.hotelAddress,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        check_in_date: checkIn,
        check_out_date: checkOut,
        room_allocation: toJson(serializeRoomAllocation(hotel.roomAllocation)),
        rooms_booked: hotel.roomsBooked ?? hotel.roomAllocation.length,
        notes: hotel.notes,
        status: "planned",
      };
    }).filter((row) => row.check_in_date && row.check_out_date);
    if (rows.length > 0) {
      const { error } = await client.from("tour_accommodations").insert(rows);
      if (error) throw error;
      insertedAccommodations = rows.length;
    }
  }

  const normalizedHotelsToHoja = model.accommodations.filter((hotel) =>
    hotel.source === "normalized" && hotel.tourDateId && !similarAccommodationExists(hotel, model.accommodations, "hoja")
  );
  for (const hotel of normalizedHotelsToHoja) {
    const hoja = await getHojaForTourDate(hotel.tourDateId);
    if (!hoja?.id) continue;
    const { data: existing, error: existingError } = await client
      .from("hoja_de_ruta_accommodations")
      .select("id, hotel_name, check_in, check_out")
      .eq("hoja_de_ruta_id", hoja.id);
    if (existingError) throw existingError;
    const exists = asArray<UnknownRecord>(existing).some((row) =>
      normalizeComparison(row.hotel_name) === normalizeComparison(hotel.hotelName) &&
      normalizeComparison(row.check_in) === normalizeComparison(hotel.checkInDate) &&
      normalizeComparison(row.check_out) === normalizeComparison(hotel.checkOutDate)
    );
    if (exists) continue;
    const { error } = await client.from("hoja_de_ruta_accommodations").insert({
      hoja_de_ruta_id: hoja.id,
      hotel_name: hotel.hotelName,
      address: hotel.hotelAddress,
      check_in: hotel.checkInDate,
      check_out: hotel.checkOutDate,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
    });
    if (error) throw error;
    insertedHojaAccommodations += 1;
  }

  return {
    insertedTravelSegments,
    insertedHojaTravelRows,
    insertedAccommodations,
    insertedHojaAccommodations,
  };
}
