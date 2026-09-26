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

  const results = [
    jobsResult,
    eventsResult,
    travelResult,
    accommodationsResult,
    documentsResult,
    assignmentsResult,
  ];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const jobs = asArray<UnknownRecord>(jobsResult.data);
  const jobIds = jobs.flatMap((job) => {
    const id = textOrNull(job.id);
    return id ? [id] : [];
  });

  const aggregateResults = await Promise.all(
    jobIds.map(async (jobId) => {
      const { data, error } = await client.rpc("get_hoja_de_ruta", { p_job_id: jobId });
      if (error) throw error;
      return isRecord(data) ? data : null;
    }),
  );

  const hojaRecords: UnknownRecord[] = [];
  const hojaTravelArrangements: UnknownRecord[] = [];
  const hojaTransport: UnknownRecord[] = [];
  const hojaAccommodations: UnknownRecord[] = [];
  const hojaStaff: UnknownRecord[] = [];

  aggregateResults.forEach((aggregate) => {
    if (!aggregate) return;
    const main = isRecord(aggregate.main) ? aggregate.main : null;
    if (!main) return;

    hojaRecords.push({
      ...main,
      // These are live aggregate fields, not the retired hoja_de_ruta JSON columns.
      logistics: isRecord(aggregate.logistics) ? aggregate.logistics : {},
    });

    asArray<UnknownRecord>(aggregate.travelArrangements).forEach((row) => {
      hojaTravelArrangements.push(row);
    });
    asArray<UnknownRecord>(aggregate.transport)
      .filter((row) => row.is_hoja_relevant !== false)
      .forEach((row) => {
        hojaTransport.push(row);
      });
    asArray<UnknownRecord>(aggregate.accommodations).forEach((row) => {
      hojaAccommodations.push({
        ...row,
        hoja_de_ruta_room_assignments: asArray<UnknownRecord>(row.rooms),
      });
    });
    asArray<UnknownRecord>(aggregate.staff).forEach((row) => {
      // Tour Ops never needs DNI. Keep the aggregate projection narrow even
      // when a management caller is entitled to the full editor payload.
      const { dni: _dni, ...safeStaff } = row;
      hojaStaff.push(safeStaff);
    });
  });

  return normalizeTourOpsModel(
    {
      tour,
      tour_dates: tourDates,
      jobs,
      hoja_de_ruta: hojaRecords,
      timeline_events: eventsResult.data ?? [],
      travel_segments: travelResult.data ?? [],
      accommodations: accommodationsResult.data ?? [],
      hoja_travel_arrangements: hojaTravelArrangements,
      hoja_transport: hojaTransport,
      hoja_accommodations: hojaAccommodations,
      hoja_staff: hojaStaff,
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
