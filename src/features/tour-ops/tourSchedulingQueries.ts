import { normalizeTourOpsModel } from "@/features/tour-ops/tourSchedulingModel";
import type { UnknownRecord } from "@/features/tour-ops/tourSchedulingNormalizers";
import { TOUR_SELECT, asArray, isRecord, textOrNull } from "@/features/tour-ops/tourSchedulingNormalizers";
import type {
  TourOpsAllowedSections,
  TourOpsModel,
  TourOpsProjection
} from "@/features/tour-ops/types";
import { dataLayerClient } from "@/services/dataLayerClient";

const client = dataLayerClient;

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

  const tourDates = asArray<UnknownRecord>(tour?.tour_dates);
  const dateIds = tourDates.flatMap((date) => {
    const id = textOrNull(date.id);
    return id ? [id] : [];
  });

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
      : Promise.resolve({ data: [] as never[], error: null }),
    dateIds.length
      ? client
          .from("hoja_de_ruta")
          .select("id, job_id, tour_date_id, program_schedule_json, logistics_info, venue_name, venue_address, weather_data, hotel_info, local_contacts, restaurants_info")
          .in("tour_date_id", dateIds)
      : Promise.resolve({ data: [] as never[], error: null }),
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

  const jobIds = asArray<UnknownRecord>(jobsResult.data).flatMap((job) => {
    const id = textOrNull(job.id);
    return id ? [id] : [];
  });
  const emptyHojaByJobResult: { data: never[]; error: null } = { data: [], error: null };
  const hojaByJobResult = jobIds.length
    ? await client
        .from("hoja_de_ruta")
        .select("id, job_id, tour_date_id, program_schedule_json, logistics_info, venue_name, venue_address, weather_data, hotel_info, local_contacts, restaurants_info")
        .in("job_id", jobIds)
    : emptyHojaByJobResult;
  if (hojaByJobResult.error) throw hojaByJobResult.error;

  const hojaRecordsById = new Map<string, UnknownRecord>();
  [...asArray<UnknownRecord>(hojaResult.data), ...asArray<UnknownRecord>(hojaByJobResult.data)].forEach((hoja) => {
    const id = textOrNull(hoja.id);
    if (id) hojaRecordsById.set(id, hoja);
  });
  const hojaRecords = Array.from(hojaRecordsById.values());
  const hojaIds = hojaRecords.flatMap((hoja) => {
    const id = textOrNull(hoja.id);
    return id ? [id] : [];
  });
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
      : Promise.resolve({ data: [] as never[], error: null }),
    hojaIds.length
      ? client
          .from("hoja_de_ruta_transport")
          .select("id, hoja_de_ruta_id, transport_type, driver_name, driver_phone, license_plate, company, date_time, has_return, return_date_time, logistics_categories, is_hoja_relevant")
          .in("hoja_de_ruta_id", hojaIds)
          .or("is_hoja_relevant.eq.true,is_hoja_relevant.is.null")
      : Promise.resolve({ data: [] as never[], error: null }),
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
      : Promise.resolve({ data: [] as never[], error: null }),
    hojaIds.length
      ? client
          .from("hoja_de_ruta_staff")
          .select("id, hoja_de_ruta_id, name, surname1, surname2, position")
          .in("hoja_de_ruta_id", hojaIds)
      : Promise.resolve({ data: [] as never[], error: null }),
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
  if (!isRecord(data) || data.error) {
    throw new Error("Tour share link is invalid or expired");
  }
  const share = isRecord(data.share) ? data.share : null;

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
      allowedSections: isRecord(share?.allowed_sections) ? share.allowed_sections : undefined,
      share: share
        ? {
            id: textOrNull(share.id) ?? "",
            label: textOrNull(share.label) ?? "",
            expiresAt: textOrNull(share.expires_at),
            accessLevel: share.access_level === "edit" ? "edit" : "view",
          }
        : null,
    },
  );
}
