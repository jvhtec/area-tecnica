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
  TourOpsTimelineEvent,
  TourOpsTravelSegment,
} from "@/features/tour-ops/types";
import { DEFAULT_TOUR_OPS_SECTIONS } from "@/features/tour-ops/types";

type AnyRecord = Record<string, any>;

const client = dataLayerClient as any;

const TOUR_SELECT = `
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

const isRecord = (value: unknown): value is AnyRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asArray = <T = AnyRecord>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const firstRelation = (value: unknown): AnyRecord | null => {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const displayName = (...parts: unknown[]) =>
  parts.map(textOrNull).filter(Boolean).join(" ").trim() || null;

const objectOrEmpty = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const normalizeSections = (value?: Partial<TourOpsAllowedSections> | null): TourOpsAllowedSections => ({
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

const normalizeContacts = (value: unknown, projection: TourOpsProjection): TourOpsContact[] => {
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

const profileName = (profile: AnyRecord | null | undefined, fallback?: string | null) => {
  const fullName = textOrNull(profile?.full_name);
  if (fullName) return fullName;
  const parts = [profile?.first_name, profile?.last_name].map(textOrNull).filter(Boolean);
  return parts.join(" ").trim() || fallback || "Sin nombre";
};

const roleFromAssignment = (assignment: AnyRecord): string | null =>
  textOrNull(assignment.role) ??
  textOrNull(assignment.sound_role) ??
  textOrNull(assignment.lights_role) ??
  textOrNull(assignment.video_role) ??
  textOrNull(assignment.production_role);

const normalizeTourAssignment = (assignment: AnyRecord): TourOpsCrewMember => {
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

const normalizeJobAssignment = (assignment: AnyRecord): TourOpsCrewMember => {
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

const dedupeCrew = (crew: TourOpsCrewMember[], projection: TourOpsProjection): TourOpsCrewMember[] => {
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

const normalizeTimelineEvent = (event: AnyRecord): TourOpsTimelineEvent => ({
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

const formatTravelLabel = (
  tourDateId: string | null,
  locationId: string | null,
  dateById: Map<string, AnyRecord>,
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
  row: AnyRecord,
  dateById: Map<string, AnyRecord>,
  locationById: Map<string, TourOpsLocation>,
  source: "normalized" | "legacy" | "hoja" = "normalized",
): TourOpsTravelSegment => {
  const fromTourDateId = textOrNull(row.from_tour_date_id ?? row.fromDateId);
  const toTourDateId = textOrNull(row.to_tour_date_id ?? row.toDateId);
  const fromLocationId = textOrNull(row.from_location_id ?? row.fromLocation?.id);
  const toLocationId = textOrNull(row.to_location_id ?? row.toLocation?.id);
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

const buildHojaStaffLookup = (rows: AnyRecord[]) => {
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

const normalizeRoomAssignment = (
  row: AnyRecord,
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

const normalizeRoomAssignments = (value: unknown, staffLookup?: Map<string, HojaStaffReference>) =>
  asArray<AnyRecord>(value).map((row) => normalizeRoomAssignment(row, staffLookup));

const serializeRoomAllocation = (rooms: TourOpsRoomAssignment[] | undefined | null) =>
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

const normalizeAccommodation = (
  row: AnyRecord,
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

const normalizeHojaAccommodation = (
  row: AnyRecord,
  hojaById: Map<string, AnyRecord>,
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

const normalizeHojaHotelInfo = (hoja: AnyRecord): TourOpsAccommodation[] => {
  const hojaId = textOrNull(hoja.id);
  const hotelInfo = hoja.hotel_info;
  if (!hojaId || hotelInfo == null) return [];

  const fromObject = (value: AnyRecord, index: number) => normalizeAccommodation({
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
    latitude: value.latitude ?? value.coordinates?.lat,
    longitude: value.longitude ?? value.coordinates?.lng,
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

const normalizeHojaTravelArrangement = (
  row: AnyRecord,
  hojaById: Map<string, AnyRecord>,
  dateById: Map<string, AnyRecord>,
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

const normalizeHojaTransport = (
  row: AnyRecord,
  hojaById: Map<string, AnyRecord>,
  dateById: Map<string, AnyRecord>,
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

const normalizeDocument = (row: AnyRecord): TourOpsDocument => ({
  id: textOrNull(row.id) ?? crypto.randomUUID(),
  tourId: textOrNull(row.tour_id) ?? "",
  fileName: textOrNull(row.file_name) ?? "Documento",
  filePath: textOrNull(row.file_path) ?? "",
  fileType: textOrNull(row.file_type),
  uploadedAt: textOrNull(row.uploaded_at),
  visibleToTech: Boolean(row.visible_to_tech),
  visibleToGuest: Boolean(row.visible_to_guest),
});

const buildDateHealth = (date: TourOpsDate): TourOpsHealthIssue[] => {
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

const shouldIncludeSection = (allowed: TourOpsAllowedSections, section: keyof TourOpsAllowedSections) =>
  allowed[section] !== false;

const normalizeComparison = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const mergeTravelSegments = (segments: TourOpsTravelSegment[]) => {
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

const mergeAccommodations = (accommodations: TourOpsAccommodation[]) => {
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

const hasHomeBase = (settings: Record<string, unknown>) => {
  const homeBase = isRecord(settings.homeBase) ? settings.homeBase : null;
  return Boolean(homeBase && toNumber(homeBase.latitude) != null && toNumber(homeBase.longitude) != null);
};

const travelSyncKey = (segment: TourOpsTravelSegment) => [
  segment.fromTourDateId,
  segment.toTourDateId,
  normalizeComparison(segment.transportationType),
  normalizeComparison(segment.departureTime),
  normalizeComparison(segment.arrivalTime),
].join("|");

const accommodationSyncKey = (accommodation: TourOpsAccommodation) => [
  accommodation.tourDateId,
  normalizeComparison(accommodation.hotelName),
  normalizeComparison(accommodation.checkInDate),
  normalizeComparison(accommodation.checkOutDate),
].join("|");

const annotateTravelSyncStatus = (
  segments: TourOpsTravelSegment[],
  allCandidates: TourOpsTravelSegment[],
  hojaByDate: Map<string, AnyRecord>,
) => {
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
    return {
      ...segment,
      syncStatus: hojaKeys.has(travelSyncKey(segment))
        ? "synced"
        : hasHojaTarget
          ? "needs_sync"
          : "no_hoja",
    };
  });
};

const annotateAccommodationSyncStatus = (
  accommodations: TourOpsAccommodation[],
  allCandidates: TourOpsAccommodation[],
  hojaByDate: Map<string, AnyRecord>,
) => {
  const hojaKeys = new Set(
    allCandidates
      .filter((hotel) => hotel.source === "hoja")
      .map(accommodationSyncKey),
  );

  return accommodations.map((hotel) => {
    if (hotel.source === "hoja") return { ...hotel, syncStatus: "imported" as const };
    const hasHojaTarget = Boolean(hotel.tourDateId && hojaByDate.has(hotel.tourDateId));
    return {
      ...hotel,
      syncStatus: hojaKeys.has(accommodationSyncKey(hotel))
        ? "synced"
        : hasHojaTarget
          ? "needs_sync"
          : "no_hoja",
    };
  });
};

export function normalizeTourOpsModel(
  raw: AnyRecord,
  projection: TourOpsProjection,
  options: {
    currentUserId?: string | null;
    allowedSections?: Partial<TourOpsAllowedSections> | null;
    share?: TourOpsModel["share"];
  } = {},
): TourOpsModel {
  const allowedSections = normalizeSections(options.allowedSections);
  const tour = raw.tour ?? raw;
  const rawDates = asArray<AnyRecord>(raw.tour_dates ?? tour.tour_dates).map((date) => ({
    ...date,
    location: normalizeTourOpsLocation(date.location ?? date.locations),
  }));
  const dateById = new Map(rawDates.map((date) => [date.id, date]));
  const locationById = new Map<string, TourOpsLocation>();
  rawDates.forEach((date) => {
    if (date.location?.id) locationById.set(date.location.id, date.location);
  });

  const jobs = asArray<AnyRecord>(raw.jobs);
  const jobByTourDate = new Map<string, AnyRecord>();
  const jobById = new Map<string, AnyRecord>();
  jobs.forEach((job) => {
    const jobId = textOrNull(job.id);
    if (jobId) jobById.set(jobId, job);
    const tourDateId = textOrNull(job.tour_date_id);
    if (tourDateId) jobByTourDate.set(tourDateId, job);
  });

  const hojas = asArray<AnyRecord>(raw.hoja_de_ruta ?? raw.hojaDeRutaRecords);
  const hojaByDate = new Map<string, AnyRecord>();
  const hojaById = new Map<string, AnyRecord>();
  hojas.forEach((hoja) => {
    const linkedJob = jobById.get(textOrNull(hoja.job_id) ?? "");
    const tourDateId = textOrNull(hoja.tour_date_id) ?? textOrNull(linkedJob?.tour_date_id);
    const enrichedHoja = {
      ...hoja,
      tour_date_id: tourDateId,
      tour_id: textOrNull(hoja.tour_id) ?? textOrNull(tour.id),
    };
    if (tourDateId) hojaByDate.set(tourDateId, enrichedHoja);
    const hojaId = textOrNull(hoja.id);
    if (hojaId) hojaById.set(hojaId, enrichedHoja);
  });

  const tourCrew = asArray<AnyRecord>(raw.tour_assignments).map(normalizeTourAssignment);
  const jobCrewByDate = new Map<string, TourOpsCrewMember[]>();
  jobs.forEach((job) => {
    const tourDateId = textOrNull(job.tour_date_id);
    if (!tourDateId) return;
    jobCrewByDate.set(tourDateId, asArray<AnyRecord>(job.job_assignments).map(normalizeJobAssignment));
  });

  const normalizedTravel = asArray<AnyRecord>(raw.travel_segments).map((row) =>
    normalizeTravelSegment({ ...row, source_table: "tour_travel_segments" }, dateById, locationById, "normalized"),
  );

  const legacyTravel = normalizedTravel.length === 0
    ? asArray<AnyRecord>(tour.travel_plan).map((row) => normalizeTravelSegment({ ...row, tour_id: tour.id, source_table: "travel_plan" }, dateById, locationById, "legacy"))
    : [];

  const hojaTravel = asArray<AnyRecord>(raw.hoja_travel_arrangements)
    .map((row) => normalizeHojaTravelArrangement(row, hojaById, dateById, locationById));
  const hojaTransport = asArray<AnyRecord>(raw.hoja_transport)
    .map((row) => normalizeHojaTransport(row, hojaById, dateById, locationById));
  const allTravelCandidates = [...normalizedTravel, ...hojaTravel, ...hojaTransport, ...legacyTravel];
  const travelSegments = annotateTravelSyncStatus(
    mergeTravelSegments(allTravelCandidates),
    allTravelCandidates,
    hojaByDate,
  );
  const hojaStaffLookupById = buildHojaStaffLookup(asArray<AnyRecord>(raw.hoja_staff));
  const normalizedAccommodations = asArray<AnyRecord>(raw.accommodations).map((row) => normalizeAccommodation({ ...row, source: "normalized" }));
  const hojaAccommodations = asArray<AnyRecord>(raw.hoja_accommodations).map((row) =>
    normalizeHojaAccommodation(row, hojaById, hojaStaffLookupById)
  );
  const hojaInfoAccommodations = Array.from(hojaById.values()).flatMap(normalizeHojaHotelInfo);
  const allAccommodationCandidates = [...normalizedAccommodations, ...hojaAccommodations, ...hojaInfoAccommodations];
  const accommodations = annotateAccommodationSyncStatus(
    mergeAccommodations(allAccommodationCandidates),
    allAccommodationCandidates,
    hojaByDate,
  );

  const allDocuments = asArray<AnyRecord>(raw.documents).map(normalizeDocument);
  const documents = allDocuments.filter((document) => {
    if (!shouldIncludeSection(allowedSections, "documents")) return false;
    if (projection === "management") return true;
    if (projection === "technician") return document.visibleToTech;
    return document.visibleToGuest;
  });

  const timelineEvents = asArray<AnyRecord>(raw.timeline_events ?? raw.timelineEvents)
    .map(normalizeTimelineEvent)
    .filter((event) => {
      if (!shouldIncludeSection(allowedSections, "timeline")) return false;
      if (projection === "management") return true;
      return event.visibleToCrew;
    });

  const dates: TourOpsDate[] = rawDates
    .map((date) => {
      const job = jobByTourDate.get(date.id);
      const hoja = hojaByDate.get(date.id);
      const program = normalizeProgramDays(hoja?.program_schedule_json);
      const crew = projection === "guest"
        ? []
        : dedupeCrew([...(jobCrewByDate.get(date.id) ?? []), ...tourCrew], projection);
      const dateTravelIn = travelSegments.filter((segment) => segment.toTourDateId === date.id);
      const dateTravelOut = travelSegments.filter((segment) => segment.fromTourDateId === date.id);
      const dateAccommodations = shouldIncludeSection(allowedSections, "accommodations")
        ? accommodations.filter((item) => item.tourDateId === date.id)
        : [];

      const normalizedDate: TourOpsDate = {
        id: date.id,
        date: date.date,
        startDate: textOrNull(date.start_date),
        endDate: textOrNull(date.end_date),
        type: textOrNull(date.tour_date_type),
        rehearsalDays: toNumber(date.rehearsal_days),
        isTourPackOnly: Boolean(date.is_tour_pack_only),
        location: date.location,
        hojaDeRutaId: textOrNull(hoja?.id),
        jobId: textOrNull(job?.id),
        jobTitle: textOrNull(job?.title),
        jobStatus: textOrNull(job?.status),
        program: shouldIncludeSection(allowedSections, "timeline") ? program : [],
        crew,
        travelIn: shouldIncludeSection(allowedSections, "travel") ? dateTravelIn : [],
        travelOut: shouldIncludeSection(allowedSections, "travel") ? dateTravelOut : [],
        accommodations: dateAccommodations,
        weather: shouldIncludeSection(allowedSections, "weather") ? hoja?.weather_data ?? null : null,
        logistics: hoja?.logistics_info ?? null,
        venueName: textOrNull(hoja?.venue_name) ?? date.location?.name ?? null,
        venueAddress: textOrNull(hoja?.venue_address) ?? date.location?.formattedAddress ?? null,
        restaurants: hoja?.restaurants_info ?? null,
        health: [],
      };

      normalizedDate.health = projection === "management" ? buildDateHealth(normalizedDate) : [];
      return normalizedDate;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const tourSettings = objectOrEmpty(tour.tour_settings);
  const globalHealth: TourOpsHealthIssue[] = projection === "management"
    ? [
        ...(!hasHomeBase(tourSettings)
          ? [{
              id: `${tour.id}:home-base`,
              severity: "warning" as const,
              label: "Base de operaciones pendiente",
              detail: "Configura la base del tour para mapa, rutas, calculos de distancia y viajes generados.",
            }]
          : []),
        ...(allDocuments.length === 0
          ? [{
              id: `${tour.id}:documents`,
              severity: "info" as const,
              label: "Sin documentos de gira",
              detail: "No hay documentos cargados para tecnicos o enlaces externos.",
            }]
          : []),
      ]
    : [];
  const health = projection === "management" ? [...globalHealth, ...dates.flatMap((date) => date.health)] : [];
  const tourTimezone = textOrNull(tour.default_timezone) ?? MADRID_TIMEZONE;
  const todayKey = formatInTimeZone(new Date(), tourTimezone, "yyyy-MM-dd");
  const completedDates = dates.filter((date) => date.date.slice(0, 10) < todayKey).length;
  const visibleTravelSegments = shouldIncludeSection(allowedSections, "travel") ? travelSegments : [];
  const visibleAccommodations = shouldIncludeSection(allowedSections, "accommodations") ? accommodations : [];

  return {
    projection,
    allowedSections,
    share: options.share ?? null,
    tour: {
      id: tour.id,
      name: textOrNull(tour.name) ?? "Tour",
      description: textOrNull(tour.description),
      color: textOrNull(tour.color),
      status: textOrNull(tour.status),
      startDate: textOrNull(tour.start_date),
      endDate: textOrNull(tour.end_date),
      defaultTimezone: textOrNull(tour.default_timezone),
      contacts: shouldIncludeSection(allowedSections, "contacts") ? normalizeContacts(tour.tour_contacts, projection) : [],
      settings: tourSettings,
      schedulingPreferences: objectOrEmpty(tour.scheduling_preferences),
      hasLegacyTravelPlan: normalizedTravel.length === 0 && asArray(tour.travel_plan).length > 0,
    },
    dates,
    timelineEvents,
    travelSegments: visibleTravelSegments,
    accommodations: visibleAccommodations,
    documents,
    crew: projection === "guest" ? [] : dedupeCrew(tourCrew, projection),
    health,
    stats: {
      totalDates: dates.length,
      completedDates,
      upcomingDates: Math.max(0, dates.length - completedDates),
      venueCount: new Set(dates.map((date) => date.location?.id || date.location?.name).filter(Boolean)).size,
      travelSegments: visibleTravelSegments.length,
      healthWarnings: health.length,
    },
  };
}

export async function fetchTourOpsModel(
  tourId: string,
  projection: TourOpsProjection = "management",
  options: { currentUserId?: string | null; allowedSections?: Partial<TourOpsAllowedSections> | null } = {},
): Promise<TourOpsModel> {
  const { data: tour, error: tourError } = await client
    .from("tours")
    .select(TOUR_SELECT)
    .eq("id", tourId)
    .single();

  if (tourError) throw tourError;

  const tourDates = asArray<AnyRecord>(tour?.tour_dates);
  const dateIds = tourDates.map((date) => date.id).filter(Boolean);

  const [
    jobsResult,
    hojaResult,
    eventsResult,
    travelResult,
    accommodationsResult,
    documentsResult,
    assignmentsResult,
  ] = await Promise.all([
    dateIds.length
      ? client
          .from("jobs")
          .select(`
            id,
            title,
            status,
            start_time,
            end_time,
            job_type,
            tour_id,
            tour_date_id,
            job_assignments (
              id,
              technician_id,
              sound_role,
              lights_role,
              video_role,
              production_role,
              status,
              external_technician_name,
              profiles:technician_id (
                id,
                first_name,
                last_name,
                phone,
                email,
                department
              )
            )
          `)
          .in("tour_date_id", dateIds)
      : Promise.resolve({ data: [], error: null }),
    dateIds.length
      ? client
          .from("hoja_de_ruta")
          .select("id, job_id, tour_date_id, program_schedule_json, logistics_info, venue_name, venue_address, weather_data, hotel_info, local_contacts, restaurants_info")
          .in("tour_date_id", dateIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("tour_timeline_events")
      .select("*")
      .eq("tour_id", tourId)
      .order("date", { ascending: true }),
    client
      .from("tour_travel_segments")
      .select("*")
      .eq("tour_id", tourId)
      .order("departure_time", { ascending: true }),
    client
      .from("tour_accommodations")
      .select("*")
      .eq("tour_id", tourId)
      .order("check_in_date", { ascending: true }),
    client
      .from("tour_documents")
      .select("id, tour_id, file_name, file_path, file_type, uploaded_at, visible_to_tech, visible_to_guest")
      .eq("tour_id", tourId)
      .order("uploaded_at", { ascending: false }),
    client
      .from("tour_assignments")
      .select(`
        id,
        tour_id,
        technician_id,
        department,
        role,
        notes,
        external_technician_name,
        profiles:technician_id (
          id,
          first_name,
          last_name,
          phone,
          email,
          department
        )
      `)
      .eq("tour_id", tourId),
  ]);

  const results = [jobsResult, hojaResult, eventsResult, travelResult, accommodationsResult, documentsResult, assignmentsResult];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const jobIds = asArray<AnyRecord>(jobsResult.data).map((job) => job.id).filter(Boolean);
  const hojaByJobResult = jobIds.length
    ? await client
        .from("hoja_de_ruta")
        .select("id, job_id, tour_date_id, program_schedule_json, logistics_info, venue_name, venue_address, weather_data, hotel_info, local_contacts, restaurants_info")
        .in("job_id", jobIds)
    : { data: [], error: null };
  if (hojaByJobResult.error) throw hojaByJobResult.error;

  const hojaRecordsById = new Map<string, AnyRecord>();
  [...asArray<AnyRecord>(hojaResult.data), ...asArray<AnyRecord>(hojaByJobResult.data)].forEach((hoja) => {
    const id = textOrNull(hoja.id);
    if (id) hojaRecordsById.set(id, hoja);
  });
  const hojaRecords = Array.from(hojaRecordsById.values());
  const hojaIds = hojaRecords.map((hoja) => hoja.id).filter(Boolean);
  const [
    hojaTravelArrangementsResult,
    hojaTransportResult,
    hojaAccommodationsResult,
    hojaStaffResult,
  ] = await Promise.all([
    hojaIds.length
      ? client
          .from("hoja_de_ruta_travel_arrangements")
          .select("id, hoja_de_ruta_id, transportation_type, pickup_address, pickup_time, departure_time, arrival_time, flight_train_number, driver_name, driver_phone, plate_number, notes")
          .in("hoja_de_ruta_id", hojaIds)
      : Promise.resolve({ data: [], error: null }),
    hojaIds.length
      ? client
          .from("hoja_de_ruta_transport")
          .select("id, hoja_de_ruta_id, transport_type, driver_name, driver_phone, license_plate, company, date_time, has_return, return_date_time, logistics_categories, is_hoja_relevant")
          .in("hoja_de_ruta_id", hojaIds)
          .or("is_hoja_relevant.eq.true,is_hoja_relevant.is.null")
      : Promise.resolve({ data: [], error: null }),
    hojaIds.length
      ? client
          .from("hoja_de_ruta_accommodations")
          .select(`
            id,
            hoja_de_ruta_id,
            hotel_name,
            address,
            check_in,
            check_out,
            latitude,
            longitude,
            hoja_de_ruta_room_assignments (
              id,
              room_type,
              room_number,
              staff_member1_id,
              staff_member2_id
            )
          `)
          .in("hoja_de_ruta_id", hojaIds)
      : Promise.resolve({ data: [], error: null }),
    hojaIds.length
      ? client
          .from("hoja_de_ruta_staff")
          .select("id, hoja_de_ruta_id, name, surname1, surname2, position")
          .in("hoja_de_ruta_id", hojaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const childResults = [hojaTravelArrangementsResult, hojaTransportResult, hojaAccommodationsResult, hojaStaffResult];
  const firstChildError = childResults.find((result) => result.error)?.error;
  if (firstChildError) throw firstChildError;

  return normalizeTourOpsModel(
    {
      tour,
      tour_dates: tourDates,
      jobs: jobsResult.data ?? [],
      hoja_de_ruta: hojaRecords,
      timeline_events: eventsResult.data ?? [],
      travel_segments: travelResult.data ?? [],
      accommodations: accommodationsResult.data ?? [],
      hoja_travel_arrangements: hojaTravelArrangementsResult.data ?? [],
      hoja_transport: hojaTransportResult.data ?? [],
      hoja_accommodations: hojaAccommodationsResult.data ?? [],
      hoja_staff: hojaStaffResult.data ?? [],
      documents: documentsResult.data ?? [],
      tour_assignments: assignmentsResult.data ?? [],
    },
    projection,
    options,
  );
}

export async function fetchTourOpsShare(token: string): Promise<TourOpsModel> {
  const { data, error } = await client.rpc("get_tour_guest_payload", { p_token: token });
  if (error) throw error;
  if (!data || data.error) {
    throw new Error("Tour share link is invalid or expired");
  }

  return normalizeTourOpsModel(
    {
      tour: data.tour,
      tour_dates: data.tour_dates,
      timeline_events: data.timeline_events,
      travel_segments: data.travel_segments,
      accommodations: data.accommodations,
      hoja_de_ruta: data.hoja_de_ruta,
      documents: data.documents,
      tour_assignments: [],
      jobs: [],
    },
    "guest",
    {
      allowedSections: data.share?.allowed_sections,
      share: data.share
        ? {
            id: data.share.id,
            label: data.share.label,
            expiresAt: data.share.expires_at ?? null,
            accessLevel: data.share.access_level === "edit" ? "edit" : "view",
          }
        : null,
    },
  );
}

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
    metadata: input.metadata || {},
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
      program_schedule_json: input.program,
      last_modified: new Date().toISOString(),
    })
    .eq("id", input.hojaDeRutaId);
  if (error) throw error;
}

export async function deleteTimelineEvent(id: string) {
  const { error } = await client.from("tour_timeline_events").delete().eq("id", id);
  if (error) throw error;
}

const normalizeDbTimestamp = (date: string | null | undefined, timeOrTimestamp: string | null | undefined) => {
  if (!timeOrTimestamp) return null;
  if (timeOrTimestamp.includes("T")) return timeOrTimestamp;
  if (!date) return null;
  return `${date}T${timeOrTimestamp.length === 5 ? `${timeOrTimestamp}:00` : timeOrTimestamp}`;
};

const normalizeHojaTransportationType = (value: string | null | undefined) => {
  const raw = normalizeComparison(value);
  if (raw === "plane") return "plane";
  if (raw === "train") return "train";
  if (raw === "rv") return "RV";
  if (raw === "sleeper_bus" || raw === "bus" || raw === "autobus") return "sleeper_bus";
  return "van";
};

const getHojaForTourDate = async (tourDateId: string | null | undefined) => {
  if (!tourDateId) return null;
  const { data, error } = await client
    .from("hoja_de_ruta")
    .select("id, tour_date_id")
    .eq("tour_date_id", tourDateId)
    .maybeSingle();
  if (error) throw error;
  return data as AnyRecord | null;
};

const hojaTravelPayloadFromSegment = (input: Partial<TourOpsTravelSegment>) => ({
  transportation_type: normalizeHojaTransportationType(input.transportationType),
  pickup_address: input.fromLabel && input.fromLabel !== "Origen" ? input.fromLabel : null,
  pickup_time: input.departureTime || null,
  departure_time: input.departureTime || null,
  arrival_time: input.arrivalTime || null,
  flight_train_number: input.carrierName || null,
  driver_name: textOrNull((input.vehicleDetails as AnyRecord | null)?.driverName),
  driver_phone: textOrNull((input.vehicleDetails as AnyRecord | null)?.driverPhone),
  plate_number: textOrNull((input.vehicleDetails as AnyRecord | null)?.plateNumber),
  notes: input.routeNotes || null,
});

const opsTravelPayloadFromSegment = (input: Partial<TourOpsTravelSegment> & { tourId: string }) => ({
  tour_id: input.tourId,
  from_tour_date_id: input.fromTourDateId || null,
  to_tour_date_id: input.toTourDateId || null,
  from_location_id: input.fromLocationId || null,
  to_location_id: input.toLocationId || null,
  transportation_type: input.transportationType || "bus",
  departure_time: input.departureTime || null,
  arrival_time: input.arrivalTime || null,
  carrier_name: input.carrierName || null,
  vehicle_details: input.source === "hoja"
    ? {
        ...(isRecord(input.vehicleDetails) ? input.vehicleDetails : {}),
        hojaSourceId: input.id,
        hojaSourceTable: input.sourceTable,
        hojaDeRutaId: input.hojaDeRutaId,
      }
    : input.vehicleDetails || {},
  distance_km: input.distanceKm ?? null,
  estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
  route_notes: input.routeNotes || null,
  stops: input.stops || [],
  crew_manifest: input.crewManifest || [],
  luggage_truck: Boolean(input.luggageTruck),
  status: input.status || "planned",
});

const upsertOpsTravelFromHoja = async (input: Partial<TourOpsTravelSegment> & { tourId: string }) => {
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

const hojaTravelRowMatchesPayload = (row: AnyRecord, payload: AnyRecord) =>
  normalizeComparison(row.transportation_type) === normalizeComparison(payload.transportation_type) &&
  normalizeComparison(row.pickup_address) === normalizeComparison(payload.pickup_address) &&
  normalizeComparison(row.departure_time) === normalizeComparison(payload.departure_time) &&
  normalizeComparison(row.arrival_time) === normalizeComparison(payload.arrival_time) &&
  normalizeComparison(row.flight_train_number) === normalizeComparison(payload.flight_train_number) &&
  normalizeComparison(row.notes) === normalizeComparison(payload.notes);

const syncSegmentToHoja = async (input: Partial<TourOpsTravelSegment>) => {
  const targetDateId = input.toTourDateId || input.fromTourDateId;
  const hoja = await getHojaForTourDate(targetDateId);
  if (!hoja?.id) return false;

  const payload = {
    hoja_de_ruta_id: hoja.id,
    ...hojaTravelPayloadFromSegment(input),
  };

  const linkedHojaSourceId = textOrNull((input.vehicleDetails as AnyRecord | null)?.hojaSourceId);
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

  const alreadyExists = asArray<AnyRecord>(existing).some((row) => hojaTravelRowMatchesPayload(row, payload));
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
          driver_name: textOrNull((input.vehicleDetails as AnyRecord | null)?.driverName),
          driver_phone: textOrNull((input.vehicleDetails as AnyRecord | null)?.driverPhone),
          license_plate: textOrNull((input.vehicleDetails as AnyRecord | null)?.plateNumber),
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

const opsAccommodationPayloadFromHotel = (input: Partial<TourOpsAccommodation> & { tourId: string }) => ({
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
  room_allocation: serializeRoomAllocation(input.roomAllocation),
  rooms_booked: input.roomsBooked ?? serializeRoomAllocation(input.roomAllocation).length,
  notes: input.notes || null,
  status: "planned",
});

const hojaAccommodationPayloadFromHotel = (input: Partial<TourOpsAccommodation>) => ({
  hotel_name: input.hotelName || "Hotel",
  address: input.hotelAddress || null,
  check_in: input.checkInDate || null,
  check_out: input.checkOutDate || input.checkInDate || null,
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
});

const hojaStaffStorageLookup = async (hojaId: string) => {
  const { data, error } = await client
    .from("hoja_de_ruta_staff")
    .select("id, name, surname1, surname2, position")
    .eq("hoja_de_ruta_id", hojaId);
  if (error) throw error;

  const byValue = new Map<string, string>();
  asArray<AnyRecord>(data).forEach((member, index) => {
    const indexValue = String(index);
    [textOrNull(member.id), textOrNull(member.technician_id)]
      .filter(Boolean)
      .forEach((key) => byValue.set(key as string, indexValue));
    const name = displayName(member.name, member.surname1, member.surname2);
    if (name) byValue.set(name, indexValue);
  });
  return byValue;
};

const replaceHojaRoomAssignments = async (
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

const findSimilarOpsAccommodation = async (input: Partial<TourOpsAccommodation> & { tourId: string }) => {
  if (!input.tourDateId || !input.hotelName) return null;
  const { data, error } = await client
    .from("tour_accommodations")
    .select("id")
    .eq("tour_id", input.tourId)
    .eq("tour_date_id", input.tourDateId)
    .ilike("hotel_name", input.hotelName)
    .limit(1);
  if (error) throw error;
  return asArray<AnyRecord>(data)[0] ?? null;
};

const upsertOpsAccommodationFromHoja = async (input: Partial<TourOpsAccommodation> & { tourId: string }) => {
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

const syncAccommodationToHoja = async (input: Partial<TourOpsAccommodation>) => {
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

  const existingRow = asArray<AnyRecord>(existing)[0];
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
      vehicle_details: segment.vehicleDetails ?? {},
      distance_km: segment.distanceKm,
      estimated_duration_minutes: segment.estimatedDurationMinutes,
      route_notes: segment.routeNotes,
      stops: segment.stops,
      crew_manifest: segment.crewManifest,
      luggage_truck: segment.luggageTruck,
      status: segment.status ?? "planned",
    };
  });

  const { error } = await client.from("tour_travel_segments").insert(rows);
  if (error) throw error;

  return rows.length;
}

const similarTravelExists = (segment: TourOpsTravelSegment, candidates: TourOpsTravelSegment[], source: TourOpsTravelSegment["source"]) =>
  candidates.some((candidate) =>
    candidate.source === source &&
    candidate.fromTourDateId === segment.fromTourDateId &&
    candidate.toTourDateId === segment.toTourDateId &&
    normalizeComparison(candidate.transportationType) === normalizeComparison(segment.transportationType) &&
    normalizeComparison(candidate.departureTime) === normalizeComparison(segment.departureTime) &&
    normalizeComparison(candidate.arrivalTime) === normalizeComparison(segment.arrivalTime)
  );

const similarAccommodationExists = (
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
        vehicle_details: {
          ...(isRecord(segment.vehicleDetails) ? segment.vehicleDetails : {}),
          hojaSourceId: segment.id,
          hojaSourceTable: segment.sourceTable,
          hojaDeRutaId: segment.hojaDeRutaId,
        },
        distance_km: segment.distanceKm,
        estimated_duration_minutes: segment.estimatedDurationMinutes,
        route_notes: segment.routeNotes,
        stops: segment.stops,
        crew_manifest: segment.crewManifest,
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
        room_allocation: serializeRoomAllocation(hotel.roomAllocation),
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
    const exists = asArray<AnyRecord>(existing).some((row) =>
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

export async function fetchTourGuestLinks(tourId: string): Promise<TourGuestLink[]> {
  const { data, error } = await client
    .from("tour_guest_links")
    .select("id, tour_id, token, label, allowed_sections, access_level, expires_at, revoked_at, created_at")
    .eq("tour_id", tourId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TourGuestLink[];
}

export async function createTourGuestLink(input: {
  tourId: string;
  label: string;
  allowedSections: TourOpsAllowedSections;
  accessLevel?: "view" | "edit";
  expiresAt?: string | null;
}): Promise<TourGuestLink> {
  const { data, error } = await client.rpc("create_tour_guest_link", {
    p_tour_id: input.tourId,
    p_label: input.label,
    p_allowed_sections: input.allowedSections,
    p_expires_at: input.expiresAt || null,
    p_access_level: input.accessLevel || "view",
  });
  if (error) throw error;
  const link = data?.[0] as TourGuestLink | undefined;
  if (!link) {
    throw new Error("No se pudo crear el enlace externo");
  }
  return link;
}

export async function revokeTourGuestLink(linkId: string) {
  const { error } = await client.rpc("revoke_tour_guest_link", { p_link_id: linkId });
  if (error) throw error;
}

export async function setTourGuestLinkAccess(input: { linkId: string; accessLevel: "disabled" | "view" | "edit" }) {
  const { error } = await client.rpc("set_tour_guest_link_access", {
    p_link_id: input.linkId,
    p_access_level: input.accessLevel,
  });
  if (error) throw error;
}

export async function updateTourDocumentGuestVisibility(documentId: string, visibleToGuest: boolean) {
  const { error } = await client
    .from("tour_documents")
    .update({ visible_to_guest: visibleToGuest })
    .eq("id", documentId);
  if (error) throw error;
}
