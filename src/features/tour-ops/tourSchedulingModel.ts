import type { UnknownRecord } from "@/features/tour-ops/tourSchedulingNormalizers";
import {
  annotateAccommodationSyncStatus,
  annotateTravelSyncStatus,
  asArray,
  buildDateHealth,
  buildHojaStaffLookup,
  dedupeCrew,
  hasHomeBase,
  isRecord,
  mergeAccommodations,
  mergeTravelSegments,
  normalizeAccommodation,
  normalizeContacts,
  normalizeDocument,
  normalizeHojaAccommodation,
  normalizeHojaHotelInfo,
  normalizeHojaTransport,
  normalizeHojaTravelArrangement,
  normalizeJobAssignment,
  normalizeProgramDays,
  normalizeSections,
  normalizeTimelineEvent,
  normalizeTourAssignment,
  normalizeTourOpsLocation,
  normalizeTravelSegment,
  objectOrEmpty,
  shouldIncludeSection,
  textOrNull,
  toNumber,
} from "@/features/tour-ops/tourSchedulingNormalizers";
import type {
  TourOpsAllowedSections,
  TourOpsCrewMember,
  TourOpsDate,
  TourOpsHealthIssue,
  TourOpsLocation,
  TourOpsModel,
  TourOpsProjection
} from "@/features/tour-ops/types";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import { formatInTimeZone } from "date-fns-tz";

export function normalizeTourOpsModel(
  raw: UnknownRecord,
  projection: TourOpsProjection,
  options: {
    currentUserId?: string | null;
    allowedSections?: Partial<TourOpsAllowedSections> | null;
    share?: TourOpsModel["share"];
  } = {},
): TourOpsModel {
  const allowedSections = normalizeSections(options.allowedSections);
  const tour = isRecord(raw.tour) ? raw.tour : raw;
  const tourId = textOrNull(tour.id) ?? "";
  const rawDates: (UnknownRecord & { id: string; date: string; location: TourOpsLocation | null })[] =
    asArray<UnknownRecord>(raw.tour_dates ?? tour.tour_dates).map((date) => ({
      ...date,
      id: textOrNull(date.id) ?? "",
      date: textOrNull(date.date) ?? "",
      location: normalizeTourOpsLocation(date.location ?? date.locations),
    }));
  const dateById = new Map(rawDates.map((date) => [date.id, date]));
  const locationById = new Map<string, TourOpsLocation>();
  rawDates.forEach((date) => {
    if (date.location?.id) locationById.set(date.location.id, date.location);
  });

  const jobs = asArray<UnknownRecord>(raw.jobs);
  const jobByTourDate = new Map<string, UnknownRecord>();
  const jobById = new Map<string, UnknownRecord>();
  jobs.forEach((job) => {
    const jobId = textOrNull(job.id);
    if (jobId) jobById.set(jobId, job);
    const tourDateId = textOrNull(job.tour_date_id);
    if (tourDateId) jobByTourDate.set(tourDateId, job);
  });

  const hojas = asArray<UnknownRecord>(raw.hoja_de_ruta ?? raw.hojaDeRutaRecords);
  const hojaByDate = new Map<string, UnknownRecord>();
  const hojaById = new Map<string, UnknownRecord>();
  hojas.forEach((hoja) => {
    const linkedJob = jobById.get(textOrNull(hoja.job_id) ?? "");
    const tourDateId = textOrNull(hoja.tour_date_id) ?? textOrNull(linkedJob?.tour_date_id);
    const enrichedHoja = {
      ...hoja,
      tour_date_id: tourDateId,
      tour_id: textOrNull(hoja.tour_id) ?? tourId,
    };
    if (tourDateId) hojaByDate.set(tourDateId, enrichedHoja);
    const hojaId = textOrNull(hoja.id);
    if (hojaId) hojaById.set(hojaId, enrichedHoja);
  });

  const tourCrew = asArray<UnknownRecord>(raw.tour_assignments).map(normalizeTourAssignment);
  const jobCrewByDate = new Map<string, TourOpsCrewMember[]>();
  jobs.forEach((job) => {
    const tourDateId = textOrNull(job.tour_date_id);
    if (!tourDateId) return;
    jobCrewByDate.set(tourDateId, asArray<UnknownRecord>(job.job_assignments).map(normalizeJobAssignment));
  });

  const normalizedTravel = asArray<UnknownRecord>(raw.travel_segments).map((row) =>
    normalizeTravelSegment({ ...row, source_table: "tour_travel_segments" }, dateById, locationById, "normalized"),
  );

  const legacyTravel = normalizedTravel.length === 0
    ? asArray<UnknownRecord>(tour.travel_plan).map((row) => normalizeTravelSegment({ ...row, tour_id: tourId, source_table: "travel_plan" }, dateById, locationById, "legacy"))
    : [];

  const hojaTravel = asArray<UnknownRecord>(raw.hoja_travel_arrangements)
    .map((row) => normalizeHojaTravelArrangement(row, hojaById, dateById, locationById));
  const hojaTransport = asArray<UnknownRecord>(raw.hoja_transport)
    .map((row) => normalizeHojaTransport(row, hojaById, dateById, locationById));
  const allTravelCandidates = [...normalizedTravel, ...hojaTravel, ...hojaTransport, ...legacyTravel];
  const travelSegments = annotateTravelSyncStatus(
    mergeTravelSegments(allTravelCandidates),
    allTravelCandidates,
    hojaByDate,
  );
  const hojaStaffLookupById = buildHojaStaffLookup(asArray<UnknownRecord>(raw.hoja_staff));
  const normalizedAccommodations = asArray<UnknownRecord>(raw.accommodations).map((row) => normalizeAccommodation({ ...row, source: "normalized" }));
  const hojaAccommodations = asArray<UnknownRecord>(raw.hoja_accommodations).map((row) =>
    normalizeHojaAccommodation(row, hojaById, hojaStaffLookupById)
  );
  const hojaInfoAccommodations = Array.from(hojaById.values()).flatMap(normalizeHojaHotelInfo);
  const allAccommodationCandidates = [...normalizedAccommodations, ...hojaAccommodations, ...hojaInfoAccommodations];
  const accommodations = annotateAccommodationSyncStatus(
    mergeAccommodations(allAccommodationCandidates),
    allAccommodationCandidates,
    hojaByDate,
  );

  const allDocuments = asArray<UnknownRecord>(raw.documents).map(normalizeDocument);
  const documents = allDocuments.filter((document) => {
    if (!shouldIncludeSection(allowedSections, "documents")) return false;
    if (projection === "management") return true;
    if (projection === "technician") return document.visibleToTech;
    return document.visibleToGuest;
  });

  const timelineEvents = asArray<UnknownRecord>(raw.timeline_events ?? raw.timelineEvents)
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
              id: `${tourId}:home-base`,
              severity: "warning" as const,
              label: "Base de operaciones pendiente",
              detail: "Configura la base del tour para mapa, rutas, calculos de distancia y viajes generados.",
            }]
          : []),
        ...(allDocuments.length === 0
          ? [{
              id: `${tourId}:documents`,
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
      id: tourId,
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
