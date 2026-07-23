import { dataLayerClient } from "@/services/dataLayerClient";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { formatInTimeZone } from "date-fns-tz";
import type {
  TourGuestLink,
  TourOpsAccommodation,
  TourOpsAllowedSections,
  TourOpsContact,
  TourOpsCrewMember,
  TourOpsDate,
  TourOpsDocument,
  TourOpsHealthIssue,
  TourOpsLocation,
  TourOpsModel,
  TourOpsProgramDay,
  TourOpsProjection,
  TourOpsRoomAssignment,
  TourOpsSyncStatus,
  TourOpsTimelineEvent,
  TourOpsTravelSegment,
} from "@/features/tour-ops/types";
import { DEFAULT_TOUR_OPS_SECTIONS } from "@/features/tour-ops/types";

export type UnknownRecord = Record<string, unknown>;

export const TOUR_SELECT = `
  id,
  name,
  description,
  color,
  status,
  start_date,
  end_date,
  default_timezone,
  tour_contacts,
  tour_settings,
  scheduling_preferences,
  travel_plan,
  tour_dates (
    id,
    date,
    start_date,
    end_date,
    tour_date_type,
    rehearsal_days,
    is_tour_pack_only,
    location_id,
    flex_folders_created,
    location:locations (
      id,
      name,
      formatted_address,
      latitude,
      longitude
    )
  )
`;

export const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const asArray = <T = UnknownRecord>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const firstRelation = (value: unknown): UnknownRecord | null => {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
};

export const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const textOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

export const displayName = (...parts: unknown[]) =>
  parts.map(textOrNull).filter(Boolean).join(" ").trim() || null;

export const objectOrEmpty = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

export const normalizeSections = (value?: Partial<TourOpsAllowedSections> | null): TourOpsAllowedSections => ({
  ...DEFAULT_TOUR_OPS_SECTIONS,
  ...(isRecord(value) ? value : {}),
});

export const normalizeTourOpsLocation = (value: unknown): TourOpsLocation | null => {
  const location = firstRelation(value);
  if (!location) return null;

  return {
    id: textOrNull(location.id),
    name: textOrNull(location.name),
    formattedAddress: textOrNull(location.formatted_address) ?? textOrNull(location.address),
    latitude: toNumber(location.latitude),
    longitude: toNumber(location.longitude),
  };
};

export const normalizeProgramDays = (value: unknown): TourOpsProgramDay[] =>
  asArray(value)
    .filter(isRecord)
    .map((day) => ({
      label: textOrNull(day.label),
      date: textOrNull(day.date),
      rows: asArray(day.rows)
        .filter(isRecord)
        .map((row) => ({
          time: textOrNull(row.time),
          item: textOrNull(row.item),
          dept: textOrNull(row.dept ?? row.department),
          notes: textOrNull(row.notes),
        }))
        .filter((row) => row.time || row.item || row.dept || row.notes),
    }))
    .filter((day) => day.rows.length > 0 || day.label);

export const normalizeContacts = (value: unknown, projection: TourOpsProjection): TourOpsContact[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((contact, index) => ({
    id: textOrNull(contact.id) ?? `contact-${index}`,
    name: textOrNull(contact.name) ?? "Contacto",
    role: textOrNull(contact.role),
    phone: projection === "management" || contact.isPrimary ? textOrNull(contact.phone) : null,
    email: projection === "management" || contact.isPrimary ? textOrNull(contact.email) : null,
    company: textOrNull(contact.company),
    notes: projection === "management" ? textOrNull(contact.notes) : null,
    isPrimary: Boolean(contact.isPrimary),
  }));
};

export const profileName = (profile: UnknownRecord | null | undefined, fallback?: string | null) => {
  const fullName = textOrNull(profile?.full_name);
  if (fullName) return fullName;
  const parts = [profile?.first_name, profile?.last_name].map(textOrNull).filter(Boolean);
  return parts.join(" ").trim() || fallback || "Sin nombre";
};

export const roleFromAssignment = (assignment: UnknownRecord): string | null =>
  textOrNull(assignment.role) ??
  textOrNull(assignment.sound_role) ??
  textOrNull(assignment.lights_role) ??
  textOrNull(assignment.video_role) ??
  textOrNull(assignment.production_role);

export const normalizeTourAssignment = (assignment: UnknownRecord): TourOpsCrewMember => {
  const profile = firstRelation(assignment.profiles ?? assignment.technician);
  const fallbackName = textOrNull(assignment.external_technician_name);
  return {
    id: textOrNull(assignment.technician_id) ?? `external:${fallbackName ?? textOrNull(assignment.id) ?? crypto.randomUUID()}`,
    name: profileName(profile, fallbackName),
    department: textOrNull(assignment.department),
    role: roleFromAssignment(assignment),
    phone: textOrNull(profile?.phone),
    email: textOrNull(profile?.email),
    source: "tour",
  };
};

export const normalizeJobAssignment = (assignment: UnknownRecord): TourOpsCrewMember => {
  const profile = firstRelation(assignment.profiles ?? assignment.technician);
  const fallbackName = textOrNull(assignment.external_technician_name);
  return {
    id: textOrNull(assignment.technician_id) ?? `external:${fallbackName ?? textOrNull(assignment.id) ?? crypto.randomUUID()}`,
    name: profileName(profile, fallbackName),
    department: textOrNull(profile?.department),
    role: roleFromAssignment(assignment),
    phone: textOrNull(profile?.phone),
    email: textOrNull(profile?.email),
    source: "job",
  };
};

export const dedupeCrew = (crew: TourOpsCrewMember[], projection: TourOpsProjection): TourOpsCrewMember[] => {
  const byKey = new Map<string, TourOpsCrewMember>();
  crew.forEach((member) => {
    const key = member.id.startsWith("external:")
      ? `external:${member.name.trim().toLowerCase()}`
      : member.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...member,
        phone: projection === "guest" ? null : member.phone,
        email: projection === "guest" ? null : member.email,
      });
      return;
    }

    const mergeUnique = (left: string | null, right: string | null) => {
      const values = [left, right]
        .map(textOrNull)
        .filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
      return values.length ? values.join(" / ") : null;
    };

    byKey.set(key, {
      ...existing,
      department: mergeUnique(existing.department, member.department),
      role: mergeUnique(existing.role, member.role),
      phone: existing.phone ?? (projection === "guest" ? null : member.phone),
      email: existing.email ?? (projection === "guest" ? null : member.email),
      source: existing.source === "job" || member.source === "job" ? "job" : "tour",
    });
  });
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const normalizeTimelineEvent = (event: UnknownRecord): TourOpsTimelineEvent => ({
  id: textOrNull(event.id) ?? crypto.randomUUID(),
  tourId: textOrNull(event.tour_id) ?? "",
  eventType: textOrNull(event.event_type) ?? "other",
  title: textOrNull(event.title) ?? "Evento",
  description: textOrNull(event.description),
  date: textOrNull(event.date) ?? textOrNull(event.event_date) ?? "",
  startTime: textOrNull(event.start_time),
  endTime: textOrNull(event.end_time),
  timezone: textOrNull(event.timezone),
  allDay: Boolean(event.all_day),
  locationId: textOrNull(event.location_id),
  locationDetails: textOrNull(event.location_details),
  departments: asArray<string>(event.departments).filter(Boolean),
  visibleToCrew: event.visible_to_crew !== false,
  metadata: objectOrEmpty(event.metadata),
});

export const formatTravelLabel = (
  tourDateId: string | null,
  locationId: string | null,
  dateById: Map<string, UnknownRecord>,
  locationById: Map<string, TourOpsLocation>,
  fallback: string,
) => {
  const date = tourDateId ? dateById.get(tourDateId) : null;
  const dateLocation = normalizeTourOpsLocation(date?.location ?? date?.locations);
  if (dateLocation?.name) return dateLocation.name;
  const location = locationId ? locationById.get(locationId) : null;
  return location?.name || fallback;
};

export const normalizeTravelSegment = (
  row: UnknownRecord,
  dateById: Map<string, UnknownRecord>,
  locationById: Map<string, TourOpsLocation>,
  source: "normalized" | "legacy" | "hoja" = "normalized",
): TourOpsTravelSegment => {
  const fromTourDateId = textOrNull(row.from_tour_date_id ?? row.fromDateId);
  const toTourDateId = textOrNull(row.to_tour_date_id ?? row.toDateId);
  const fromLocationId = textOrNull(row.from_location_id ?? firstRelation(row.fromLocation)?.id);
  const toLocationId = textOrNull(row.to_location_id ?? firstRelation(row.toLocation)?.id);
  const vehicleDetails = isRecord(row.vehicle_details) ? row.vehicle_details : null;

  return {
    id: textOrNull(row.id) ?? crypto.randomUUID(),
    tourId: textOrNull(row.tour_id) ?? "",
    fromTourDateId,
    toTourDateId,
    fromLocationId,
    toLocationId,
    fromLabel:
      textOrNull(row.from_label) ??
      textOrNull(vehicleDetails?.pickupAddress) ??
      formatTravelLabel(fromTourDateId, fromLocationId, dateById, locationById, row.fromType === "home" ? "Base" : "Origen"),
    toLabel: textOrNull(row.to_label) ?? formatTravelLabel(toTourDateId, toLocationId, dateById, locationById, row.toType === "home" ? "Base" : "Destino"),
    transportationType: textOrNull(row.transportation_type ?? row.transportType) ?? "bus",
    departureTime: textOrNull(row.departure_time ?? row.departureTime),
    arrivalTime: textOrNull(row.arrival_time ?? row.arrivalTime),
    carrierName: textOrNull(row.carrier_name ?? row.carrierName),
    vehicleDetails,
    distanceKm: toNumber(row.distance_km ?? row.distance),
    estimatedDurationMinutes: toNumber(row.estimated_duration_minutes ?? row.duration),
    routeNotes: textOrNull(row.route_notes ?? row.notes),
    stops: asArray(row.stops),
    crewManifest: asArray(row.crew_manifest ?? row.crewManifest),
    luggageTruck: Boolean(row.luggage_truck),
    status: textOrNull(row.status),
    source,
    syncStatus: source === "legacy" ? "legacy" : source === "hoja" ? "imported" : "needs_sync",
    hojaDeRutaId: textOrNull(row.hoja_de_ruta_id) ?? textOrNull(vehicleDetails?.hojaDeRutaId),
    sourceTable: textOrNull(row.source_table) as TourOpsTravelSegment["sourceTable"] | undefined,
  };
};

type HojaStaffReference = {
  id: string | null;
  technicianId: string | null;
  index: string;
  name: string | null;
};

export const buildHojaStaffLookup = (rows: UnknownRecord[]) => {
  const grouped = new Map<string, HojaStaffReference[]>();
  rows.forEach((row) => {
    const hojaId = textOrNull(row.hoja_de_ruta_id);
    if (!hojaId) return;
    const members = grouped.get(hojaId) ?? [];
    members.push({
      id: textOrNull(row.id),
      technicianId: textOrNull(row.technician_id),
      index: String(members.length),
      name: displayName(row.name, row.surname1, row.surname2) ?? textOrNull(row.position),
    });
    grouped.set(hojaId, members);
  });

  const lookup = new Map<string, Map<string, HojaStaffReference>>();
  grouped.forEach((members, hojaId) => {
    const byKey = new Map<string, HojaStaffReference>();
    members.forEach((member) => {
      [member.index, member.id, member.technicianId].filter(Boolean).forEach((key) => {
        byKey.set(key as string, member);
      });
    });
    lookup.set(hojaId, byKey);
  });
  return lookup;
};

export const normalizeRoomAssignment = (
  row: UnknownRecord,
  staffLookup?: Map<string, HojaStaffReference>,
): TourOpsRoomAssignment => {
  const rawStaffMember1Id = textOrNull(row.staff_member1_id ?? row.staffMember1Id ?? row.rawStaffMember1Id);
  const rawStaffMember2Id = textOrNull(row.staff_member2_id ?? row.staffMember2Id ?? row.rawStaffMember2Id);
  const staff1 = rawStaffMember1Id ? staffLookup?.get(rawStaffMember1Id) : null;
  const staff2 = rawStaffMember2Id ? staffLookup?.get(rawStaffMember2Id) : null;

  return {
    id: textOrNull(row.id),
    roomType: textOrNull(row.room_type ?? row.roomType),
    roomNumber: textOrNull(row.room_number ?? row.roomNumber),
    staffMember1Id: staff1?.technicianId ?? staff1?.id ?? rawStaffMember1Id,
    staffMember2Id: staff2?.technicianId ?? staff2?.id ?? rawStaffMember2Id,
    staffMember1Name: staff1?.name ?? textOrNull(row.staff_member1_name ?? row.staffMember1Name ?? row.occupant1Name),
    staffMember2Name: staff2?.name ?? textOrNull(row.staff_member2_name ?? row.staffMember2Name ?? row.occupant2Name),
    rawStaffMember1Id,
    rawStaffMember2Id,
  };
};

export const normalizeRoomAssignments = (value: unknown, staffLookup?: Map<string, HojaStaffReference>) =>
  asArray<UnknownRecord>(value).map((row) => normalizeRoomAssignment(row, staffLookup));

export const serializeRoomAllocation = (rooms: TourOpsRoomAssignment[] | undefined | null) =>
  asArray<TourOpsRoomAssignment>(rooms)
    .filter((room) =>
      room.roomType ||
      room.roomNumber ||
      room.staffMember1Id ||
      room.staffMember2Id ||
      room.staffMember1Name ||
      room.staffMember2Name
    )
    .map((room) => ({
      id: room.id ?? undefined,
      room_type: room.roomType || "single",
      room_number: room.roomNumber || "",
      staff_member1_id: room.staffMember1Id || room.rawStaffMember1Id || null,
      staff_member2_id: room.staffMember2Id || room.rawStaffMember2Id || null,
      staff_member1_name: room.staffMember1Name || null,
      staff_member2_name: room.staffMember2Name || null,
    }));

export const normalizeAccommodation = (
  row: UnknownRecord,
  staffLookup?: Map<string, HojaStaffReference>,
): TourOpsAccommodation => {
  const roomAllocation = normalizeRoomAssignments(row.room_allocation ?? row.hoja_de_ruta_room_assignments, staffLookup);
  return {
    id: textOrNull(row.id) ?? crypto.randomUUID(),
    tourDateId: textOrNull(row.tour_date_id),
    hojaDeRutaId: textOrNull(row.hoja_de_ruta_id),
    locationId: textOrNull(row.location_id),
    hotelName: textOrNull(row.hotel_name) ?? "Hotel",
    hotelAddress: textOrNull(row.hotel_address ?? row.address),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    checkInDate: textOrNull(row.check_in_date),
    checkOutDate: textOrNull(row.check_out_date),
    confirmationNumber: textOrNull(row.confirmation_number),
    roomAllocation,
    roomsBooked: toNumber(row.rooms_booked) ?? (roomAllocation.length || null),
    notes: textOrNull(row.notes),
    source: row.source === "hoja" ? "hoja" : "normalized",
    syncStatus: row.source === "hoja" ? "imported" : "needs_sync",
  };
};

export const normalizeHojaAccommodation = (
  row: UnknownRecord,
  hojaById: Map<string, UnknownRecord>,
  hojaStaffLookupById: Map<string, Map<string, HojaStaffReference>>,
): TourOpsAccommodation => {
  const hoja = hojaById.get(textOrNull(row.hoja_de_ruta_id) ?? "");
  const hojaId = textOrNull(row.hoja_de_ruta_id) ?? "";
  return normalizeAccommodation({
    ...row,
    source: "hoja",
    tour_date_id: hoja?.tour_date_id,
    hotel_address: row.address,
    check_in_date: row.check_in,
    check_out_date: row.check_out,
    room_allocation: row.hoja_de_ruta_room_assignments,
  }, hojaStaffLookupById.get(hojaId));
};

export const normalizeHojaHotelInfo = (hoja: UnknownRecord): TourOpsAccommodation[] => {
  const hojaId = textOrNull(hoja.id);
  const hotelInfo = hoja.hotel_info;
  if (!hojaId || hotelInfo == null) return [];

  const fromObject = (value: UnknownRecord, index: number) => normalizeAccommodation({
    id: `hotel-info:${hojaId}:${index}`,
    source: "hoja",
    hoja_de_ruta_id: hojaId,
    tour_date_id: textOrNull(hoja.tour_date_id),
    hotel_name:
      value.hotel_name ??
      value.hotelName ??
      value.name ??
      value.hotel ??
      "Alojamiento hoja de ruta",
    hotel_address: value.hotel_address ?? value.address,
    check_in_date: value.check_in_date ?? value.check_in ?? value.checkIn,
    check_out_date: value.check_out_date ?? value.check_out ?? value.checkOut,
    confirmation_number: value.confirmation_number ?? value.confirmation,
    room_allocation: value.room_allocation ?? value.rooms,
    rooms_booked: value.rooms_booked ?? asArray(value.rooms).length,
    notes: value.notes,
    latitude: value.latitude ?? (isRecord(value.coordinates) ? value.coordinates.lat : null),
    longitude: value.longitude ?? (isRecord(value.coordinates) ? value.coordinates.lng : null),
  });

  if (Array.isArray(hotelInfo)) {
    return hotelInfo.filter(isRecord).map(fromObject);
  }

  if (isRecord(hotelInfo)) {
    const nested = hotelInfo.accommodations ?? hotelInfo.hotels ?? hotelInfo.rooms;
    if (Array.isArray(nested)) {
      return nested.filter(isRecord).map(fromObject);
    }
    return [fromObject(hotelInfo, 0)];
  }

  const notes = textOrNull(hotelInfo);
  return notes
    ? [normalizeAccommodation({
        id: `hotel-info:${hojaId}:0`,
        source: "hoja",
        hoja_de_ruta_id: hojaId,
        tour_date_id: textOrNull(hoja.tour_date_id),
        hotel_name: "Alojamiento hoja de ruta",
        check_in_date: textOrNull(hoja.event_dates) ?? textOrNull(hoja.date),
        check_out_date: textOrNull(hoja.event_dates) ?? textOrNull(hoja.date),
        notes,
      })]
    : [];
};

export const normalizeHojaTravelArrangement = (
  row: UnknownRecord,
  hojaById: Map<string, UnknownRecord>,
  dateById: Map<string, UnknownRecord>,
  locationById: Map<string, TourOpsLocation>,
): TourOpsTravelSegment => {
  const hoja = hojaById.get(textOrNull(row.hoja_de_ruta_id) ?? "");
  const tourDateId = textOrNull(hoja?.tour_date_id);
  const venueName = textOrNull(hoja?.venue_name) ?? formatTravelLabel(tourDateId, null, dateById, locationById, "Venue");
  const pickupAddress = textOrNull(row.pickup_address);
  const details = [textOrNull(row.flight_train_number), textOrNull(row.driver_name), textOrNull(row.driver_phone), textOrNull(row.plate_number)]
    .filter(Boolean)
    .join(" · ");

  return normalizeTravelSegment(
    {
      ...row,
      source_table: "hoja_de_ruta_travel_arrangements",
      tour_id: textOrNull(hoja?.tour_id),
      to_tour_date_id: tourDateId,
      from_label: pickupAddress,
      to_label: venueName,
      transportation_type: row.transportation_type,
      carrier_name: textOrNull(row.flight_train_number) ?? textOrNull(row.driver_name),
      departure_time: textOrNull(row.departure_time) ?? textOrNull(row.pickup_time),
      arrival_time: row.arrival_time,
      route_notes: [textOrNull(row.notes), details].filter(Boolean).join(" · "),
      vehicle_details: {
        pickupAddress,
        pickupTime: textOrNull(row.pickup_time),
        flightTrainNumber: textOrNull(row.flight_train_number),
        driverName: textOrNull(row.driver_name),
        driverPhone: textOrNull(row.driver_phone),
        plateNumber: textOrNull(row.plate_number),
      },
    },
    dateById,
    locationById,
    "hoja",
  );
};

export const normalizeHojaTransport = (
  row: UnknownRecord,
  hojaById: Map<string, UnknownRecord>,
  dateById: Map<string, UnknownRecord>,
  locationById: Map<string, TourOpsLocation>,
): TourOpsTravelSegment => {
  const hoja = hojaById.get(textOrNull(row.hoja_de_ruta_id) ?? "");
  const tourDateId = textOrNull(hoja?.tour_date_id);
  const venueName = textOrNull(hoja?.venue_name) ?? formatTravelLabel(tourDateId, null, dateById, locationById, "Venue");
  const categories = asArray<string>(row.logistics_categories).join(", ");
  const notes = [
    textOrNull(row.company),
    textOrNull(row.driver_name),
    textOrNull(row.driver_phone),
    textOrNull(row.license_plate),
    categories || null,
  ].filter(Boolean).join(" · ");

  return normalizeTravelSegment(
    {
      ...row,
      source_table: "hoja_de_ruta_transport",
      tour_id: textOrNull(hoja?.tour_id),
      to_tour_date_id: tourDateId,
      from_label: textOrNull(row.company) ?? "Logística",
      to_label: venueName,
      transportation_type: textOrNull(row.transport_type) ?? "truck",
      departure_time: row.date_time,
      arrival_time: row.return_date_time,
      carrier_name: textOrNull(row.company),
      route_notes: notes,
      vehicle_details: {
        driverName: textOrNull(row.driver_name),
        driverPhone: textOrNull(row.driver_phone),
        plateNumber: textOrNull(row.license_plate),
        hasReturn: Boolean(row.has_return),
        logisticsCategories: asArray(row.logistics_categories),
      },
      luggage_truck: true,
    },
    dateById,
    locationById,
    "hoja",
  );
};

export const normalizeDocument = (row: UnknownRecord): TourOpsDocument => ({
  id: textOrNull(row.id) ?? crypto.randomUUID(),
  tourId: textOrNull(row.tour_id) ?? "",
  fileName: textOrNull(row.file_name) ?? "Documento",
  filePath: textOrNull(row.file_path) ?? "",
  fileType: textOrNull(row.file_type),
  uploadedAt: textOrNull(row.uploaded_at),
  visibleToTech: Boolean(row.visible_to_tech),
  visibleToGuest: Boolean(row.visible_to_guest),
});

export const buildDateHealth = (date: TourOpsDate): TourOpsHealthIssue[] => {
  const issues: TourOpsHealthIssue[] = [];
  const prefix = date.location?.name || date.venueName || date.date;

  if (!date.location?.name) {
    issues.push({
      id: `${date.id}:venue`,
      severity: "critical",
      label: "Venue sin configurar",
      detail: `${prefix} no tiene ubicacion asociada.`,
      tourDateId: date.id,
    });
  }
  if (date.location?.name && (date.location.latitude == null || date.location.longitude == null)) {
    issues.push({
      id: `${date.id}:venue-coordinates`,
      severity: "warning",
      label: "Venue sin coordenadas",
      detail: `${prefix} no tiene coordenadas para mapa, rutas y calculos de distancia.`,
      tourDateId: date.id,
    });
  }
  if (!date.jobId) {
    issues.push({
      id: `${date.id}:job`,
      severity: "warning",
      label: "Sin trabajo vinculado",
      detail: `${prefix} no tiene job vinculado para asignaciones.`,
      tourDateId: date.id,
    });
  }
  if (!date.hojaDeRutaId) {
    issues.push({
      id: `${date.id}:hoja`,
      severity: "info",
      label: "Sin Hoja de Ruta vinculada",
      detail: `${prefix} guardara datos de operaciones, pero no podra sincronizar day sheet hasta que exista Hoja de Ruta.`,
      tourDateId: date.id,
    });
  }
  if (date.program.length === 0) {
    issues.push({
      id: `${date.id}:program`,
      severity: "warning",
      label: "Programa pendiente",
      detail: `${prefix} no tiene programa del dia.`,
      tourDateId: date.id,
    });
  }
  if ([...date.travelIn, ...date.travelOut].some((segment) => segment.syncStatus === "needs_sync")) {
    issues.push({
      id: `${date.id}:travel-sync`,
      severity: "warning",
      label: "Viajes pendientes de sincronizar",
      detail: `${prefix} tiene viajes de operaciones que todavia no coinciden con Hoja de Ruta.`,
      tourDateId: date.id,
    });
  }
  if (date.accommodations.some((hotel) => hotel.syncStatus === "needs_sync")) {
    issues.push({
      id: `${date.id}:hotel-sync`,
      severity: "warning",
      label: "Hoteles pendientes de sincronizar",
      detail: `${prefix} tiene alojamientos de operaciones que todavia no coinciden con Hoja de Ruta.`,
      tourDateId: date.id,
    });
  }
  if (date.crew.length === 0) {
    issues.push({
      id: `${date.id}:crew`,
      severity: "warning",
      label: "Equipo pendiente",
      detail: `${prefix} no tiene equipo confirmado en la vista de operaciones.`,
      tourDateId: date.id,
    });
  }
  if (date.travelIn.length + date.travelOut.length === 0) {
    issues.push({
      id: `${date.id}:travel`,
      severity: "info",
      label: "Viajes sin datos",
      detail: `${prefix} no tiene traslados o transporte sincronizado.`,
      tourDateId: date.id,
    });
  }
  if (date.accommodations.length === 0) {
    issues.push({
      id: `${date.id}:hotel`,
      severity: "info",
      label: "Alojamiento sin datos",
      detail: `${prefix} no tiene alojamiento sincronizado.`,
      tourDateId: date.id,
    });
  }

  return issues;
};

export const shouldIncludeSection = (allowed: TourOpsAllowedSections, section: keyof TourOpsAllowedSections) =>
  allowed[section] !== false;

export const normalizeComparison = (value: unknown) => textOrNull(value)?.toLowerCase() ?? "";

export const mergeTravelSegments = (segments: TourOpsTravelSegment[]) => {
  const byKey = new Map<string, TourOpsTravelSegment>();
  const sourceRank: Record<TourOpsTravelSegment["source"], number> = { normalized: 3, hoja: 2, legacy: 1 };

  segments.forEach((segment) => {
    const key = [
      segment.fromTourDateId,
      segment.toTourDateId,
      normalizeComparison(segment.fromLabel),
      normalizeComparison(segment.toLabel),
      normalizeComparison(segment.transportationType),
      normalizeComparison(segment.departureTime),
      normalizeComparison(segment.arrivalTime),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || sourceRank[segment.source] > sourceRank[existing.source]) {
      byKey.set(key, segment);
    }
  });

  return Array.from(byKey.values());
};

export const mergeAccommodations = (accommodations: TourOpsAccommodation[]) => {
  const byKey = new Map<string, TourOpsAccommodation>();
  const sourceRank: Record<TourOpsAccommodation["source"], number> = { normalized: 2, hoja: 1 };

  accommodations.forEach((accommodation) => {
    const key = [
      accommodation.tourDateId,
      normalizeComparison(accommodation.hotelName),
      normalizeComparison(accommodation.checkInDate),
      normalizeComparison(accommodation.checkOutDate),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || sourceRank[accommodation.source] > sourceRank[existing.source]) {
      byKey.set(key, accommodation);
    }
  });

  return Array.from(byKey.values());
};

export const hasHomeBase = (settings: Record<string, unknown>) => {
  const homeBase = isRecord(settings.homeBase) ? settings.homeBase : null;
  return Boolean(homeBase && toNumber(homeBase.latitude) != null && toNumber(homeBase.longitude) != null);
};

export const travelSyncKey = (segment: TourOpsTravelSegment) => [
  segment.fromTourDateId,
  segment.toTourDateId,
  normalizeComparison(segment.transportationType),
  normalizeComparison(segment.departureTime),
  normalizeComparison(segment.arrivalTime),
].join("|");

export const accommodationSyncKey = (accommodation: TourOpsAccommodation) => [
  accommodation.tourDateId,
  normalizeComparison(accommodation.hotelName),
  normalizeComparison(accommodation.checkInDate),
  normalizeComparison(accommodation.checkOutDate),
].join("|");

export const annotateTravelSyncStatus = (
  segments: TourOpsTravelSegment[],
  allCandidates: TourOpsTravelSegment[],
  hojaByDate: Map<string, UnknownRecord>,
): TourOpsTravelSegment[] => {
  const hojaKeys = new Set(
    allCandidates
      .filter((segment) => segment.source === "hoja")
      .map(travelSyncKey),
  );

  return segments.map((segment) => {
    if (segment.source === "legacy") return { ...segment, syncStatus: "legacy" as const };
    if (segment.source === "hoja") return { ...segment, syncStatus: "imported" as const };

    const linkedDateIds = [segment.fromTourDateId, segment.toTourDateId].filter(Boolean) as string[];
    const hasHojaTarget = linkedDateIds.some((id) => hojaByDate.has(id));
    const syncStatus: TourOpsSyncStatus = hojaKeys.has(travelSyncKey(segment))
      ? "synced"
      : hasHojaTarget
        ? "needs_sync"
        : "no_hoja";

    return {
      ...segment,
      syncStatus,
    };
  });
};

export const annotateAccommodationSyncStatus = (
  accommodations: TourOpsAccommodation[],
  allCandidates: TourOpsAccommodation[],
  hojaByDate: Map<string, UnknownRecord>,
): TourOpsAccommodation[] => {
  const hojaKeys = new Set(
    allCandidates
      .filter((hotel) => hotel.source === "hoja")
      .map(accommodationSyncKey),
  );

  return accommodations.map((hotel) => {
    if (hotel.source === "hoja") return { ...hotel, syncStatus: "imported" as const };
    const hasHojaTarget = Boolean(hotel.tourDateId && hojaByDate.has(hotel.tourDateId));
    const syncStatus: TourOpsSyncStatus = hojaKeys.has(accommodationSyncKey(hotel))
      ? "synced"
      : hasHojaTarget
        ? "needs_sync"
        : "no_hoja";

    return {
      ...hotel,
      syncStatus,
    };
  });
};
