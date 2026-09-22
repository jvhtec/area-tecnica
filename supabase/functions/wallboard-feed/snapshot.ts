import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { joinedMany, joinedSingle } from "../_shared/joins.ts";
import { buildDeliveredDocIndex, type JobDocumentRow, type MemoriaRow } from "./docRules.ts";
import {
  buildWallboardSnapshot,
  DEFAULT_HIGHLIGHT_TTL_SECONDS,
  getSnapshotWindows,
  HIGHLIGHT_ANNOUNCEMENT_LIKE_PATTERN,
  normalizeHighlightTtlSeconds,
  SNAPSHOT_ANNOUNCEMENT_LIMIT,
  SNAPSHOT_JOB_STATUSES,
  SNAPSHOT_JOB_TYPES,
  type DocRequirementRow,
  type ProfileRow,
  type RequiredRoleRow,
  type SnapshotAnnouncementRow,
  type SnapshotAssignmentRow,
  type SnapshotJobRow,
  type SnapshotLogisticsRow,
  type TimesheetStatusRow,
} from "./snapshotModel.ts";

type RawJobRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string | null;
  job_type: string | null;
  tour_id: string | null;
  color: string | null;
  locations?: { name: string | null } | Array<{ name: string | null }> | null;
  job_departments?: { department: string | null } | Array<{ department: string | null }> | null;
  job_assignments?: SnapshotAssignmentRow | SnapshotAssignmentRow[] | null;
};

type RawLogisticsRow = {
  id: string;
  event_date: string;
  event_time: string;
  title: string | null;
  transport_type: string | null;
  transport_provider: string | null;
  license_plate: string | null;
  job_id: string | null;
  event_type: string | null;
  loading_bay: string | null;
  color: string | null;
  notes: string | null;
  jobs?: { title: string | null } | Array<{ title: string | null }> | null;
  logistics_event_departments?:
    | { department: string | null }
    | Array<{ department: string | null }>
    | null;
};

function requireData<T>(result: { data: T | null; error: { message: string } | null }, source: string): T {
  if (result.error) throw new Error(`Wallboard snapshot ${source} query failed: ${result.error.message}`);
  if (result.data === null) throw new Error(`Wallboard snapshot ${source} query returned no data`);
  return result.data;
}

function normalizeJob(row: RawJobRow): SnapshotJobRow {
  return {
    id: row.id,
    title: row.title,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
    job_type: row.job_type,
    tour_id: row.tour_id,
    color: row.color,
    locationName: joinedSingle(row.locations)?.name ?? null,
    departments: joinedMany(row.job_departments).map((entry) => entry.department),
    assignments: joinedMany(row.job_assignments),
  };
}

function normalizeLogistics(row: RawLogisticsRow): SnapshotLogisticsRow {
  return {
    id: row.id,
    event_date: row.event_date,
    event_time: row.event_time,
    title: row.title,
    transport_type: row.transport_type,
    transport_provider: row.transport_provider,
    license_plate: row.license_plate,
    job_id: row.job_id,
    jobTitle: joinedSingle(row.jobs)?.title ?? null,
    event_type: row.event_type,
    loading_bay: row.loading_bay,
    color: row.color,
    notes: row.notes,
    departments: joinedMany(row.logistics_event_departments)
      .map((entry) => entry.department)
      .filter((department): department is string => typeof department === "string" && department.length > 0),
  };
}

function overlaps(row: SnapshotJobRow, startISO: string, endISO: string): boolean {
  const start = new Date(row.start_time).getTime();
  const end = new Date(row.end_time).getTime();
  return end >= new Date(startISO).getTime() && start <= new Date(endISO).getTime();
}

export async function loadWallboardSnapshot(
  sb: SupabaseClient,
  presetSlug?: string | null,
  generatedAt = new Date(),
) {
  const windows = getSnapshotWindows(generatedAt);
  let highlightTtlSeconds = DEFAULT_HIGHLIGHT_TTL_SECONDS;

  if (presetSlug) {
    const presetResult = await sb
      .from("wallboard_presets")
      .select("highlight_ttl_seconds")
      .eq("slug", presetSlug)
      .maybeSingle();
    if (presetResult.error) {
      throw new Error(`Wallboard snapshot preset query failed: ${presetResult.error.message}`);
    }
    highlightTtlSeconds = normalizeHighlightTtlSeconds(presetResult.data?.highlight_ttl_seconds);
  }

  const highlightCutoffISO = new Date(generatedAt.getTime() - highlightTtlSeconds * 1000).toISOString();

  const [jobsResult, docRequirementsResult, logisticsResult, tickerAnnouncementsResult, highlightAnnouncementsResult] = await Promise.all([
    sb
      .from("jobs")
      .select(`
        id,
        title,
        start_time,
        end_time,
        status,
        job_type,
        tour_id,
        color,
        locations(name),
        job_departments(department),
        job_assignments(technician_id, sound_role, lights_role, video_role)
      `)
      .in("job_type", [...SNAPSHOT_JOB_TYPES])
      .in("status", [...SNAPSHOT_JOB_STATUSES])
      .lt("start_time", windows.calendarEndExclusiveISO)
      .gte("end_time", windows.queryStartISO)
      .order("start_time", { ascending: true }),
    sb.from("required_docs").select("department, key, label").eq("is_required", true),
    sb
      .from("logistics_events")
      .select(`
        id,
        event_date,
        event_time,
        title,
        transport_type,
        transport_provider,
        license_plate,
        job_id,
        event_type,
        loading_bay,
        color,
        notes,
        jobs(title),
        logistics_event_departments(department)
      `)
      .gte("event_date", windows.todayKey)
      .lte("event_date", windows.weekEndKey)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true }),
    sb
      .from("announcements")
      .select("id, message, level, active, created_at")
      .eq("active", true)
      .not("message", "ilike", HIGHLIGHT_ANNOUNCEMENT_LIKE_PATTERN)
      .order("created_at", { ascending: false })
      .limit(SNAPSHOT_ANNOUNCEMENT_LIMIT),
    sb
      .from("announcements")
      .select("id, message, level, active, created_at")
      .eq("active", true)
      .ilike("message", HIGHLIGHT_ANNOUNCEMENT_LIKE_PATTERN)
      .gte("created_at", highlightCutoffISO)
      .order("created_at", { ascending: false })
      .limit(SNAPSHOT_ANNOUNCEMENT_LIMIT),
  ]);

  const allJobs = requireData(jobsResult, "jobs").map((row) => normalizeJob(row as unknown as RawJobRow));
  const visibleJobs = allJobs.filter((job) => overlaps(job, windows.calendarStartISO, windows.calendarEndISO));
  const overdueStartMs = new Date(windows.overdueStartISO).getTime();
  const overdueCutoffMs = new Date(windows.overdueCutoffISO).getTime();
  const overdueJobs = allJobs.filter((job) => {
    const end = new Date(job.end_time).getTime();
    return end >= overdueStartMs && end < overdueCutoffMs;
  });
  const relevantJobs = [...visibleJobs, ...overdueJobs];
  // Document checks only matter for the jobs shown in detail (the next 7 days).
  const upcomingJobIds = Array.from(new Set(
    visibleJobs.filter((job) => overlaps(job, windows.weekStartISO, windows.weekEndISO)).map((job) => job.id),
  ));
  const relevantJobIds = Array.from(new Set(relevantJobs.map((job) => job.id)));
  const tourIds = Array.from(new Set(relevantJobs.map((job) => job.tour_id).filter((id): id is string => Boolean(id))));
  const technicianIds = Array.from(new Set(
    relevantJobs.flatMap((job) => job.assignments.map((assignment) => assignment.technician_id))
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  ));

  const emptyRows = <T>() => Promise.resolve({ data: [] as T[], error: null });
  const [
    requiredRolesResult,
    jobDocumentsResult,
    soundMemoriaResult,
    lightsMemoriaResult,
    videoMemoriaResult,
    timesheetsResult,
    profilesResult,
    toursResult,
  ] = await Promise.all([
    relevantJobIds.length
      ? sb.from("job_required_roles_summary").select("job_id, department, total_required").in("job_id", relevantJobIds)
      : Promise.resolve({ data: [] as RequiredRoleRow[], error: null }),
    upcomingJobIds.length
      ? sb.from("job_documents")
        .select("job_id, file_path, file_name")
        .in("job_id", upcomingJobIds)
        .or("file_path.like.calculators/%,file_path.like.%/calculators/%")
      : emptyRows<JobDocumentRow>(),
    upcomingJobIds.length
      ? sb.from("memoria_tecnica_documents").select("job_id, final_document_url").in("job_id", upcomingJobIds)
      : emptyRows<MemoriaRow>(),
    upcomingJobIds.length
      ? sb.from("lights_memoria_tecnica_documents").select("job_id, final_document_url").in("job_id", upcomingJobIds)
      : emptyRows<MemoriaRow>(),
    upcomingJobIds.length
      ? sb.from("video_memoria_tecnica_documents").select("job_id, final_document_url").in("job_id", upcomingJobIds)
      : emptyRows<MemoriaRow>(),
    relevantJobIds.length
      ? sb.from("wallboard_timesheet_status").select("job_id, technician_id, status").in("job_id", relevantJobIds)
      : Promise.resolve({ data: [] as TimesheetStatusRow[], error: null }),
    technicianIds.length
      ? sb.from("wallboard_profiles").select("id, first_name, last_name").in("id", technicianIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    tourIds.length
      ? sb.from("tours").select("id, status").in("id", tourIds)
      : Promise.resolve({ data: [] as Array<{ id: string; status: string | null }>, error: null }),
  ]);

  const cancelledTourIds = new Set(
    requireData(toursResult, "tours")
      .filter((tour) => tour.status === "cancelled")
      .map((tour) => tour.id),
  );

  return buildWallboardSnapshot({
    generatedAt,
    presetSlug,
    highlightTtlSeconds,
    visibleJobs,
    overdueJobs,
    cancelledTourIds,
    requiredRoles: requireData(requiredRolesResult, "required roles") as RequiredRoleRow[],
    docRequirements: requireData(docRequirementsResult, "document requirements") as DocRequirementRow[],
    deliveredDocs: buildDeliveredDocIndex(
      requireData(jobDocumentsResult, "job documents") as JobDocumentRow[],
      {
        sound: requireData(soundMemoriaResult, "sound memorias") as MemoriaRow[],
        lights: requireData(lightsMemoriaResult, "lights memorias") as MemoriaRow[],
        video: requireData(videoMemoriaResult, "video memorias") as MemoriaRow[],
      },
    ),
    timesheets: requireData(timesheetsResult, "timesheet statuses") as TimesheetStatusRow[],
    profiles: requireData(profilesResult, "profiles") as ProfileRow[],
    logistics: requireData(logisticsResult, "logistics").map((row) => normalizeLogistics(row as unknown as RawLogisticsRow)),
    announcements: [
      ...requireData(tickerAnnouncementsResult, "ticker announcements"),
      ...requireData(highlightAnnouncementsResult, "highlight announcements"),
    ] as SnapshotAnnouncementRow[],
    windows,
  });
}
