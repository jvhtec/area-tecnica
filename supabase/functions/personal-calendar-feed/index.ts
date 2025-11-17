import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_ROLES = new Set(["admin", "management", "house_tech"]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("personal-calendar-feed: Missing Supabase configuration");
  throw new Error("Missing Supabase configuration");
}

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeDateOnly(value: string) {
  if (!value) return value;
  return value.split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return respond(401, { error: "Missing or invalid authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return respond(401, { error: "Missing access token" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("personal-calendar-feed: Failed to authenticate user", authError);
      return respond(401, { error: "Invalid authentication" });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("personal-calendar-feed: Profile lookup failed", profileError);
      return respond(403, { error: "Unable to resolve user profile" });
    }

    if (!REQUIRED_ROLES.has(profile.role)) {
      console.warn(`personal-calendar-feed: Unauthorized role ${profile.role}`);
      return respond(403, { error: "Insufficient permissions" });
    }

    const body = await req.json().catch(() => ({}));
    const { startDate, endDate } = body ?? {};

    if (!startDate || !endDate) {
      return respond(400, { error: "startDate and endDate are required" });
    }

    const { data: houseTechs, error: techsError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, department, phone")
      .eq("role", "house_tech")
      .order("first_name");

    if (techsError) {
      console.error("personal-calendar-feed: Error fetching house techs", techsError);
      return respond(500, { error: "Failed to fetch house technicians" });
    }

    const techIds = (houseTechs ?? []).map((tech) => tech.id);
    let assignments: any[] = [];

    if (techIds.length > 0) {
      const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
        .from("job_assignments")
        .select(`
          technician_id,
          sound_role,
          lights_role,
          video_role,
          single_day,
          assignment_date,
          jobs!inner (
            id,
            title,
            color,
            start_time,
            end_time,
            status,
            locations ( name )
          )
        `)
        .in("technician_id", techIds)
        .lte("jobs.start_time", endDate)
        .gte("jobs.end_time", startDate);

      if (assignmentsError) {
        console.error("personal-calendar-feed: Error fetching assignments", assignmentsError);
        return respond(500, { error: "Failed to fetch assignments" });
      }

      assignments = (assignmentsData ?? [])
        .map((assignment) => {
          const jobData = Array.isArray(assignment.jobs) ? assignment.jobs[0] : assignment.jobs;
          if (!jobData) {
            return null;
          }

          const locationValue = Array.isArray(jobData.locations)
            ? jobData.locations[0]
            : jobData.locations;

          return {
            technician_id: assignment.technician_id,
            sound_role: assignment.sound_role,
            lights_role: assignment.lights_role,
            video_role: assignment.video_role,
            single_day: assignment.single_day,
            assignment_date: assignment.assignment_date,
            job: {
              id: jobData.id,
              title: jobData.title,
              color: jobData.color,
              start_time: jobData.start_time,
              end_time: jobData.end_time,
              status: jobData.status,
              location: locationValue?.name ? { name: locationValue.name } : null,
            },
          };
        })
        .filter(Boolean);
    }

    let vacationPeriods: any[] = [];

    if (techIds.length > 0) {
      const { data: vacationData, error: vacationError } = await supabaseAdmin
        .from("availability_schedules")
        .select("user_id, date, source, notes")
        .in("user_id", techIds)
        .eq("status", "unavailable")
        .eq("source", "vacation")
        .gte("date", normalizeDateOnly(startDate))
        .lte("date", normalizeDateOnly(endDate));

      if (vacationError) {
        console.error("personal-calendar-feed: Error fetching vacation periods", vacationError);
        return respond(500, { error: "Failed to fetch availability" });
      }

      vacationPeriods = (vacationData ?? []).map((entry) => ({
        technician_id: entry.user_id,
        date: entry.date,
        source: entry.source,
        notes: entry.notes ?? null,
      }));
    }

    return respond(200, {
      houseTechs: houseTechs ?? [],
      assignments,
      vacationPeriods,
    });
  } catch (error) {
    console.error("personal-calendar-feed: Unexpected error", error);
    return respond(500, { error: "Unexpected error" });
  }
});
