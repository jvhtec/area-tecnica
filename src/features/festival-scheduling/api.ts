import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import type { CrewDirectoryEntry, JobCrewAssignment } from "@/components/festival/scheduling/shiftModel";

export interface FestivalShiftCopyResult {
  copiedAssignments: number;
  copiedShifts: number;
}

/** Copy a complete festival day in one database transaction. */
export async function copyFestivalShifts({
  jobId,
  sourceDate,
  targetDate,
}: {
  jobId: string;
  sourceDate: string;
  targetDate: string;
}): Promise<FestivalShiftCopyResult> {
  const { data, error } = await dataLayerClient.rpc("copy_festival_shifts", {
    p_job_id: jobId,
    p_source_date: sourceDate,
    p_target_date: targetDate,
  });

  if (error) throw error;

  const row = data?.[0];
  if (
    !row ||
    typeof row.copied_shifts !== "number" ||
    typeof row.copied_assignments !== "number"
  ) {
    throw new Error("The shift copy did not return a valid result");
  }

  return {
    copiedAssignments: row.copied_assignments,
    copiedShifts: row.copied_shifts,
  };
}

// --- Shifts of one day ---------------------------------------------------------------------

/**
 * The shifts of a festival day in start order, each with its crew. Crew names come from the
 * profile directory RPC: it works for every viewer, whereas `profiles` is row-scoped and returns
 * nothing for crew the viewer does not share a job assignment with (SEC-13).
 */
export async function fetchShiftsForDate(jobId: string, date: string): Promise<ShiftWithAssignments[]> {
  const { data: shifts, error: shiftsError } = await dataLayerClient
    .from("festival_shifts")
    .select("*")
    .eq("job_id", jobId)
    .eq("date", date)
    .order("start_time");
  if (shiftsError) throw shiftsError;
  if (!shifts || shifts.length === 0) return [];

  const { data: assignments, error: assignmentsError } = await dataLayerClient
    .from("festival_shift_assignments")
    .select("*")
    .in(
      "shift_id",
      shifts.map((shift) => shift.id),
    );
  if (assignmentsError) throw assignmentsError;

  const technicianIds = [
    ...new Set((assignments ?? []).flatMap((assignment) => (assignment.technician_id ? [assignment.technician_id] : []))),
  ];
  const profilesById = new Map<string, NonNullable<ShiftWithAssignments["assignments"][number]["profiles"]>>();
  if (technicianIds.length > 0) {
    const { data: profiles, error: profilesError } = await dataLayerClient.rpc("get_profile_directory", {
      p_profile_ids: technicianIds,
    });
    if (profilesError) throw profilesError;
    for (const profile of profiles ?? []) profilesById.set(profile.id, profile);
  }

  return shifts.map((shift) => ({
    ...shift,
    assignments: (assignments ?? [])
      .filter((assignment) => assignment.shift_id === shift.id)
      .map((assignment) => ({
        ...assignment,
        profiles: assignment.technician_id ? (profilesById.get(assignment.technician_id) ?? null) : null,
      })),
  }));
}

// --- Shift writes ----------------------------------------------------------------------------

export async function createFestivalShift(row: TablesInsert<"festival_shifts">): Promise<void> {
  const { error } = await dataLayerClient.from("festival_shifts").insert(row);
  if (error) throw error;
}

export async function updateFestivalShift(shiftId: string, patch: TablesUpdate<"festival_shifts">): Promise<void> {
  const { error } = await dataLayerClient.from("festival_shifts").update(patch).eq("id", shiftId);
  if (error) throw error;
}

/** Deletes a shift; its crew go with it (`festival_shift_assignments.shift_id` cascades). */
export async function deleteFestivalShift(shiftId: string): Promise<void> {
  const { error } = await dataLayerClient.from("festival_shifts").delete().eq("id", shiftId);
  if (error) throw error;
}

export async function addShiftAssignment(row: TablesInsert<"festival_shift_assignments">): Promise<void> {
  const { error } = await dataLayerClient.from("festival_shift_assignments").insert([row]);
  if (error) throw error;
}

export async function removeShiftAssignment(assignmentId: string): Promise<void> {
  const { error } = await dataLayerClient.from("festival_shift_assignments").delete().eq("id", assignmentId);
  if (error) throw error;
}

// --- Who can be scheduled --------------------------------------------------------------------

export interface JobCrewData {
  jobAssignments: JobCrewAssignment[];
  directory: CrewDirectoryEntry[];
  /** External people already scheduled on this festival, to suggest when typing a name. */
  externalNames: string[];
}

/** The job's assigned crew (with display names) and the external names used on its shifts. */
export async function fetchJobCrew(jobId: string): Promise<JobCrewData> {
  const [assignmentsResult, shiftCrewResult] = await Promise.all([
    dataLayerClient
      .from("job_assignments")
      .select("technician_id, status, sound_role, lights_role, video_role, production_role")
      .eq("job_id", jobId),
    dataLayerClient
      .from("festival_shift_assignments")
      .select("external_technician_name, festival_shifts!inner(job_id)")
      .eq("festival_shifts.job_id", jobId),
  ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (shiftCrewResult.error) throw shiftCrewResult.error;

  const jobAssignments: JobCrewAssignment[] = assignmentsResult.data ?? [];
  const externalNames = [
    ...new Set(
      (shiftCrewResult.data ?? [])
        .map((row) => row.external_technician_name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const ids = [...new Set(jobAssignments.map((row) => row.technician_id))];
  if (ids.length === 0) return { jobAssignments: [], directory: [], externalNames };

  // Display names come from the safe directory: direct `profiles` reads are row-scoped and hide
  // crew the viewer does not share an assignment with.
  const { data: directory, error: directoryError } = await dataLayerClient.rpc("get_profile_directory", {
    p_profile_ids: ids,
  });
  if (directoryError) throw directoryError;

  return { jobAssignments, directory: directory ?? [], externalNames };
}

// --- PDF branding ----------------------------------------------------------------------------

/** Job title and logo for the shifts PDF, loaded only when the user exports. */
export async function fetchShiftsPdfBranding(jobId: string): Promise<{ jobTitle: string; logoUrl?: string }> {
  const [{ data: job }, { data: logo }] = await Promise.all([
    dataLayerClient.from("jobs").select("title").eq("id", jobId).maybeSingle(),
    dataLayerClient.from("festival_logos").select("file_path").eq("job_id", jobId).maybeSingle(),
  ]);
  const jobTitle = job?.title ?? "";
  const logoPath = logo?.file_path;
  if (!logoPath) return { jobTitle };
  if (logoPath.startsWith("http")) return { jobTitle, logoUrl: logoPath };

  let bucket = "festival-logos";
  let path = logoPath;
  if (logoPath.includes("/")) {
    [bucket] = logoPath.split("/", 1);
    path = logoPath.substring(bucket.length + 1);
  }
  const { data: signed } = await dataLayerClient.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (signed?.signedUrl) return { jobTitle, logoUrl: signed.signedUrl };
  const { data: publicUrl } = dataLayerClient.storage.from(bucket).getPublicUrl(path);
  return { jobTitle, logoUrl: publicUrl?.publicUrl };
}
