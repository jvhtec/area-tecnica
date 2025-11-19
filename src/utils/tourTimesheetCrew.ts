import { supabase } from "@/integrations/supabase/client";
import { collapseConsecutiveDates } from "./timesheetAssignments";

export interface TourTimesheetProfile {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

export interface TourAssignmentRoleRow {
  technician_id: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}

export interface TourCrewMember {
  jobId: string;
  technicianId: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  timesheetDates: string[];
  timesheetRanges: Array<{ start: string; end: string }>;
}

export interface TourTimesheetRow {
  job_id: string;
  technician_id: string | null;
  date: string;
  profile?: TourTimesheetProfile | TourTimesheetProfile[] | null;
}

function normalizeProfile(profile?: TourTimesheetProfile | TourTimesheetProfile[] | null) {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] : profile;
}

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return value;
}

export function buildTourCrewRoster(
  jobId: string,
  timesheetRows: TourTimesheetRow[] = [],
  assignmentRows: TourAssignmentRoleRow[] = []
): TourCrewMember[] {
  if (!jobId) {
    return [];
  }

  const assignmentLookup = new Map<string, TourAssignmentRoleRow>();
  assignmentRows.forEach((row) => {
    if (row?.technician_id) {
      assignmentLookup.set(row.technician_id, row);
    }
  });

  const grouped = new Map<string, { profile: TourTimesheetProfile | null; dates: Set<string> }>();

  timesheetRows.forEach((row) => {
    if (!row?.technician_id) {
      return;
    }

    const existing = grouped.get(row.technician_id) ?? {
      profile: normalizeProfile(row.profile),
      dates: new Set<string>(),
    };
    existing.dates.add(row.date);
    if (!existing.profile) {
      existing.profile = normalizeProfile(row.profile);
    }
    grouped.set(row.technician_id, existing);
  });

  const crew: TourCrewMember[] = [];

  grouped.forEach((value, technicianId) => {
    const sortedDates = Array.from(value.dates).sort();
    const ranges = collapseConsecutiveDates(sortedDates);
    const assignment = assignmentLookup.get(technicianId);
    const roles: string[] = [];
    if (assignment?.sound_role) roles.push(`Sound: ${assignment.sound_role}`);
    if (assignment?.lights_role) roles.push(`Lights: ${assignment.lights_role}`);
    if (assignment?.video_role) roles.push(`Video: ${assignment.video_role}`);

    const profile = value.profile;
    const firstName = profile?.first_name?.trim?.() || profile?.first_name || "";
    const lastName = profile?.last_name?.trim?.() || profile?.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();

    crew.push({
      jobId,
      technicianId,
      fullName: fullName || "Sin nombre",
      phone: profile?.phone ?? null,
      roles,
      timesheetDates: sortedDates,
      timesheetRanges: ranges,
    });
  });

  return crew.sort((a, b) => a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" }));
}

export async function fetchTourCrewForJobDate(jobId: string, date: string | Date) {
  if (!jobId) {
    return [];
  }

  const normalizedDate = normalizeDate(date);
  const { data: timesheetRows, error } = await supabase
    .from("timesheets")
    .select(
      `job_id, technician_id, date, profile:profiles!timesheets_technician_id_fkey(first_name,last_name,phone)`
    )
    .eq("job_id", jobId)
    .eq("date", normalizedDate)
    .eq("is_schedule_only", false);

  if (error) {
    throw error;
  }

  if (!timesheetRows || timesheetRows.length === 0) {
    return [];
  }

  const technicianIds = Array.from(
    new Set(timesheetRows.map((row) => row.technician_id).filter(Boolean))
  ) as string[];

  let assignmentRows: TourAssignmentRoleRow[] = [];
  if (technicianIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("job_assignments")
      .select("technician_id,sound_role,lights_role,video_role")
      .eq("job_id", jobId)
      .in("technician_id", technicianIds);

    if (assignmentsError) {
      throw assignmentsError;
    }

    assignmentRows = assignments || [];
  }

  return buildTourCrewRoster(jobId, timesheetRows as TourTimesheetRow[], assignmentRows);
}
