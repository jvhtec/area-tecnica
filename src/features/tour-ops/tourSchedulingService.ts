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
    phone: projection === "management" || contact.isPrimary ? textOrNull(contact.phone) : textOrNull(contact.phone),
    email: projection === "management" || contact.isPrimary ? textOrNull(contact.email) : textOrNull(contact.email),
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
  return {
    id: textOrNull(assignment.technician_id) ?? textOrNull(assignment.id) ?? crypto.randomUUID(),
    name: profileName(profile, textOrNull(assignment.external_technician_name)),
    department: textOrNull(assignment.department),
    role: roleFromAssignment(assignment),
    phone: textOrNull(profile?.phone),
    email: textOrNull(profile?.email),
    source: "tour",
  };
};

const normalizeJobAssignment = (assignment: AnyRecord): TourOpsCrewMember => {
  const profile = firstRelation(assignment.profiles ?? assignment.technician);
  return {
    id: textOrNull(assignment.technician_id) ?? textOrNull(assignment.id) ?? crypto.randomUUID(),
    name: profileName(profile, textOrNull(assignment.external_technician_name)),
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
    const key = `${member.id}:${member.role ?? ""}:${member.department ?? ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...member,
        phone: projection === "guest" ? null : member.phone,
        email: projection === "guest" ? null : member.email,
      });
    }
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
  source: "normalized" | "legacy" = "normalized",
): TourOpsTravelSegment => {
  const fromTourDateId = textOrNull(row.from_tour_date_id ?? row.fromDateId);
  const toTourDateId = textOrNull(row.to_tour_date_id ?? row.toDateId);
  const fromLocationId = textOrNull(row.from_location_id ?? row.fromLocation?.id);
  const toLocationId = textOrNull(row.to_location_id ?? row.toLocation?.id);

  return {
    id: textOrNull(row.id) ?? crypto.randomUUID(),
    tourId: textOrNull(row.tour_id) ?? "",
    fromTourDateId,
    toTourDateId,
    fromLocationId,
    toLocationId,
    fromLabel: formatTravelLabel(fromTourDateId, fromLocationId, dateById, locationById, row.fromType === "home" ? "Base" : "Origen"),
    toLabel: formatTravelLabel(toTourDateId, toLocationId, dateById, locationById, row.toType === "home" ? "Base" : "Destino"),
    transportationType: textOrNull(row.transportation_type ?? row.transportType) ?? "bus",
    departureTime: textOrNull(row.departure_time ?? row.departureTime),
    arrivalTime: textOrNull(row.arrival_time ?? row.arrivalTime),
    carrierName: textOrNull(row.carrier_name ?? row.carrierName),
    vehicleDetails: isRecord(row.vehicle_details) ? row.vehicle_details : null,
    distanceKm: toNumber(row.distance_km ?? row.distance),
    estimatedDurationMinutes: toNumber(row.estimated_duration_minutes ?? row.duration),
    routeNotes: textOrNull(row.route_notes ?? row.notes),
    stops: asArray(row.stops),
    crewManifest: asArray(row.crew_manifest ?? row.crewManifest),
    luggageTruck: Boolean(row.luggage_truck),
    status: textOrNull(row.status),
    source,
  };
};

const normalizeAccommodation = (row: AnyRecord): TourOpsAccommodation => ({
  id: textOrNull(row.id) ?? crypto.randomUUID(),
  tourDateId: textOrNull(row.tour_date_id),
  hotelName: textOrNull(row.hotel_name) ?? "Hotel",
  hotelAddress: textOrNull(row.hotel_address),
  checkInDate: textOrNull(row.check_in_date),
  checkOutDate: textOrNull(row.check_out_date),
  confirmationNumber: textOrNull(row.confirmation_number),
  roomAllocation: asArray(row.room_allocation),
  roomsBooked: toNumber(row.rooms_booked),
  notes: textOrNull(row.notes),
});

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
  if (!date.jobId) {
    issues.push({
      id: `${date.id}:job`,
      severity: "warning",
      label: "Sin trabajo vinculado",
      detail: `${prefix} no tiene job vinculado para asignaciones.`,
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
  if (date.crew.length === 0) {
    issues.push({
      id: `${date.id}:crew`,
      severity: "warning",
      label: "Equipo pendiente",
      detail: `${prefix} no tiene equipo confirmado en la vista de operaciones.`,
      tourDateId: date.id,
    });
  }

  return issues;
};

const shouldIncludeSection = (allowed: TourOpsAllowedSections, section: keyof TourOpsAllowedSections) =>
  allowed[section] !== false;

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
  jobs.forEach((job) => {
    const tourDateId = textOrNull(job.tour_date_id);
    if (tourDateId) jobByTourDate.set(tourDateId, job);
  });

  const hojas = asArray<AnyRecord>(raw.hoja_de_ruta ?? raw.hojaDeRutaRecords);
  const hojaByDate = new Map<string, AnyRecord>();
  hojas.forEach((hoja) => {
    const tourDateId = textOrNull(hoja.tour_date_id);
    if (tourDateId) hojaByDate.set(tourDateId, hoja);
  });

  const tourCrew = asArray<AnyRecord>(raw.tour_assignments).map(normalizeTourAssignment);
  const jobCrewByDate = new Map<string, TourOpsCrewMember[]>();
  jobs.forEach((job) => {
    const tourDateId = textOrNull(job.tour_date_id);
    if (!tourDateId) return;
    jobCrewByDate.set(tourDateId, asArray<AnyRecord>(job.job_assignments).map(normalizeJobAssignment));
  });

  const normalizedTravel = asArray<AnyRecord>(raw.travel_segments).map((row) =>
    normalizeTravelSegment(row, dateById, locationById, "normalized"),
  );

  const legacyTravel = normalizedTravel.length === 0
    ? asArray<AnyRecord>(tour.travel_plan).map((row) => normalizeTravelSegment({ ...row, tour_id: tour.id }, dateById, locationById, "legacy"))
    : [];

  const travelSegments = [...normalizedTravel, ...legacyTravel];
  const accommodations = asArray<AnyRecord>(raw.accommodations).map(normalizeAccommodation);

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

  const health = projection === "management" ? dates.flatMap((date) => date.health) : [];
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
      settings: objectOrEmpty(tour.tour_settings),
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
                full_name,
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
          .select("id, job_id, tour_date_id, program_schedule_json, logistics_info, venue_name, venue_address, weather_data, local_contacts, restaurants_info")
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
          full_name,
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

  return normalizeTourOpsModel(
    {
      tour,
      tour_dates: tourDates,
      jobs: jobsResult.data ?? [],
      hoja_de_ruta: hojaResult.data ?? [],
      timeline_events: eventsResult.data ?? [],
      travel_segments: travelResult.data ?? [],
      accommodations: accommodationsResult.data ?? [],
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

export async function saveTravelSegment(input: Partial<TourOpsTravelSegment> & { tourId: string }) {
  const payload = {
    tour_id: input.tourId,
    from_tour_date_id: input.fromTourDateId || null,
    to_tour_date_id: input.toTourDateId || null,
    from_location_id: input.fromLocationId || null,
    to_location_id: input.toLocationId || null,
    transportation_type: input.transportationType || "bus",
    departure_time: input.departureTime || null,
    arrival_time: input.arrivalTime || null,
    carrier_name: input.carrierName || null,
    vehicle_details: input.vehicleDetails || {},
    distance_km: input.distanceKm ?? null,
    estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
    route_notes: input.routeNotes || null,
    stops: input.stops || [],
    crew_manifest: input.crewManifest || [],
    luggage_truck: Boolean(input.luggageTruck),
    status: input.status || "planned",
  };

  if (input.id && input.source !== "legacy") {
    const { error } = await client.from("tour_travel_segments").update(payload).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await client.from("tour_travel_segments").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteTravelSegment(id: string) {
  const { error } = await client.from("tour_travel_segments").delete().eq("id", id);
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

export async function fetchTourGuestLinks(tourId: string): Promise<TourGuestLink[]> {
  const { data, error } = await client
    .from("tour_guest_links")
    .select("id, tour_id, label, allowed_sections, expires_at, revoked_at, created_at")
    .eq("tour_id", tourId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TourGuestLink[];
}

export async function createTourGuestLink(input: {
  tourId: string;
  label: string;
  allowedSections: TourOpsAllowedSections;
  expiresAt?: string | null;
}): Promise<TourGuestLink> {
  const { data, error } = await client.rpc("create_tour_guest_link", {
    p_tour_id: input.tourId,
    p_label: input.label,
    p_allowed_sections: input.allowedSections,
    p_expires_at: input.expiresAt || null,
  });
  if (error) throw error;
  return data?.[0] as TourGuestLink;
}

export async function revokeTourGuestLink(linkId: string) {
  const { error } = await client.rpc("revoke_tour_guest_link", { p_link_id: linkId });
  if (error) throw error;
}

export async function updateTourDocumentGuestVisibility(documentId: string, visibleToGuest: boolean) {
  const { error } = await client
    .from("tour_documents")
    .update({ visible_to_guest: visibleToGuest })
    .eq("id", documentId);
  if (error) throw error;
}
