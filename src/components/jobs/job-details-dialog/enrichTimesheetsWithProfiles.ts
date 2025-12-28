import { supabase } from "@/integrations/supabase/client";

interface TechnicianProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  department?: string | null;
  autonomo?: boolean | null;
}

type SupabaseClientLike = typeof supabase;

export const enrichTimesheetsWithProfiles = async (
  client: SupabaseClientLike,
  timesheets: any[]
): Promise<{ timesheets: any[]; profileMap: Map<string, TechnicianProfile> }> => {
  const profileMap = new Map<string, TechnicianProfile>();
  const technicianIds = Array.from(
    new Set(
      (timesheets || [])
        .map((row) => row.technician_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  if (!technicianIds.length) {
    return { timesheets, profileMap };
  }

  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, first_name, last_name, department, autonomo")
    .in("id", technicianIds);

  if (error) {
    console.error("[JobDetailsDialog] Failed to load technician profiles for timesheets", error);
    return { timesheets, profileMap };
  }

  (profiles || []).forEach((profile: TechnicianProfile) => {
    if (profile?.id) {
      profileMap.set(profile.id, profile);
    }
  });

  const enrichedTimesheets = timesheets.map((row) => {
    const fallbackProfile = profileMap.get(row.technician_id);
    if (!fallbackProfile) {
      return row;
    }

    const mergedTechnician = row.technician ? { ...fallbackProfile, ...row.technician } : fallbackProfile;

    return {
      ...row,
      technician: mergedTechnician,
    };
  });

  return { timesheets: enrichedTimesheets, profileMap };
};

