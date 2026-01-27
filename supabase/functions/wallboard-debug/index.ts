import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthEnd = new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Query 1: 7-day range with job_type filter (what wallboard uses)
    const { data: allJobs, error: allError } = await sb
      .from("jobs")
      .select("id, title, status, job_type, start_time")
      .in("job_type", ["single", "festival", "tourdate"])
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", weekEnd.toISOString())
      .order("start_time", { ascending: true });

    // Query 2: ALL job types in 30 days to see what exists
    const { data: allJobTypes, error: allTypesError } = await sb
      .from("jobs")
      .select("id, title, status, job_type, start_time")
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", monthEnd.toISOString())
      .order("start_time", { ascending: true });

    if (allError) throw allError;
    if (allTypesError) throw allTypesError;

    // Query 3: Jobs with status filter (7 days)
    const { data: filteredJobs, error: filteredError } = await sb
      .from("jobs")
      .select("id, title, status, job_type, start_time")
      .in("job_type", ["single", "festival", "tourdate"])
      .in("status", ["Confirmado", "Tentativa", "Completado"])
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", weekEnd.toISOString())
      .order("start_time", { ascending: true });

    if (filteredError) throw filteredError;

    // Count by status in 7-day range
    const statusCounts7Days: Record<string, number> = {};
    (allJobs ?? []).forEach((j: any) => {
      const status = j.status ?? "null";
      statusCounts7Days[status] = (statusCounts7Days[status] || 0) + 1;
    });

    // Count by status in 30-day range (all types)
    const statusCounts30Days: Record<string, number> = {};
    const jobTypeCounts: Record<string, number> = {};
    (allJobTypes ?? []).forEach((j: any) => {
      const status = j.status ?? "null";
      const jobType = j.job_type ?? "null";
      statusCounts30Days[status] = (statusCounts30Days[status] || 0) + 1;
      jobTypeCounts[jobType] = (jobTypeCounts[jobType] || 0) + 1;
    });

    // Find confirmed jobs in 30 day range
    const confirmedJobs = (allJobTypes ?? []).filter((j: any) =>
      j.status === "Confirmado" || j.status === "Tentativa" || j.status === "Completado"
    );

    const result = {
      sevenDayRange: {
        start: todayStart.toISOString(),
        end: weekEnd.toISOString(),
        totalJobs: allJobs?.length ?? 0,
        filteredJobs: filteredJobs?.length ?? 0,
        statusBreakdown: statusCounts7Days,
        sampleJobs: (allJobs ?? []).slice(0, 5),
      },
      thirtyDayRange: {
        totalJobs: allJobTypes?.length ?? 0,
        statusBreakdown: statusCounts30Days,
        jobTypeBreakdown: jobTypeCounts,
        confirmedJobsCount: confirmedJobs.length,
        sampleConfirmedJobs: confirmedJobs.slice(0, 10),
      },
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }, null, 2), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
