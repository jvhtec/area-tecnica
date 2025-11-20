import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WALLBOARD_JWT_SECRET = Deno.env.get("WALLBOARD_JWT_SECRET") ?? "";
const WALLBOARD_SHARED_TOKEN = Deno.env.get("WALLBOARD_SHARED_TOKEN") ?? "";

type AuthResult = {
  method: "jwt" | "shared";
  presetSlug?: string | null;
};

type Dept = "sound" | "lights" | "video";
type AssignmentRow = {
  job_id: string;
  technician_id: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
};
type TimesheetRow = { job_id: string; technician_id: string; date: string };
type DeptCounts = Record<Dept, number>;

function createDeptSets() {
  return {
    sound: new Set<string>(),
    lights: new Set<string>(),
    video: new Set<string>(),
  } as Record<Dept, Set<string>>;
}

function getDept(row: AssignmentRow): Dept | null {
  if (row.sound_role) return "sound";
  if (row.lights_role) return "lights";
  if (row.video_role) return "video";
  return null;
}

function aggregateCrew(timesheets: TimesheetRow[], assignments: AssignmentRow[], jobDayWindows?: Map<string, string[]>) {
  const assignmentsByKey = new Map<string, AssignmentRow>();
  assignments.forEach((row) => {
    assignmentsByKey.set(`${row.job_id}:${row.technician_id}`, row);
  });

  const jobDayDeptSets = new Map<string, Map<string, Record<Dept, Set<string>>>>();
  const jobTechSets = new Map<string, Set<string>>();

  timesheets.forEach((ts) => {
    const assignment = assignmentsByKey.get(`${ts.job_id}:${ts.technician_id}`);
    if (!assignment) return;
    const dept = getDept(assignment);
    if (!dept) return;
    const dayMap = jobDayDeptSets.get(ts.job_id) ?? new Map<string, Record<Dept, Set<string>>>();
    const deptSets = dayMap.get(ts.date) ?? createDeptSets();
    deptSets[dept].add(ts.technician_id);
    dayMap.set(ts.date, deptSets);
    jobDayDeptSets.set(ts.job_id, dayMap);

    const techSet = jobTechSets.get(ts.job_id) ?? new Set<string>();
    techSet.add(ts.technician_id);
    jobTechSets.set(ts.job_id, techSet);
  });

  if (jobDayWindows) {
    jobDayWindows.forEach((dates, jobId) => {
      if (!dates || dates.length === 0) return;
      const dayMap = jobDayDeptSets.get(jobId) ?? new Map<string, Record<Dept, Set<string>>>();
      dates.forEach((isoDate) => {
        if (!dayMap.has(isoDate)) {
          dayMap.set(isoDate, createDeptSets());
        }
      });
      jobDayDeptSets.set(jobId, dayMap);
    });
  }

  const jobDeptMinimums = new Map<string, DeptCounts>();
  jobDayDeptSets.forEach((dayMap, jobId) => {
    const counts: DeptCounts = { sound: 0, lights: 0, video: 0 };
    ("sound lights video".split(" ") as Dept[]).forEach((dept) => {
      let min: number | null = null;
      dayMap.forEach((deptSets) => {
        const size = deptSets[dept].size;
        if (min === null || size < min) {
          min = size;
        }
      });
      counts[dept] = min ?? 0;
    });
    jobDeptMinimums.set(jobId, counts);
  });

  return { jobDeptMinimums, jobTechSets };
}

function buildJobDayWindows(jobs: any[], windowStart: Date, windowEnd: Date) {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  const map = new Map<string, string[]>();
  jobs.forEach((job) => {
    const jobStart = new Date(job.start_time).getTime();
    const jobEnd = new Date(job.end_time).getTime();
    if (!Number.isFinite(jobStart) || !Number.isFinite(jobEnd)) {
      map.set(job.id, []);
      return;
    }
    const spanStart = Math.max(jobStart, startMs);
    const spanEnd = Math.min(jobEnd, endMs);
    if (spanEnd < spanStart) {
      map.set(job.id, []);
      return;
    }
    const dates: string[] = [];
    let cursor = new Date(spanStart);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(spanEnd);
    last.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= last.getTime()) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
    }
    map.set(job.id, dates);
  });
  return map;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  } as Record<string, string>;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let jwtKeyPromise: Promise<CryptoKey> | null = null;
async function getJwtKey() {
  if (!WALLBOARD_JWT_SECRET) {
    throw new HttpError(500, "WALLBOARD_JWT_SECRET is not configured");
  }
  if (!jwtKeyPromise) {
    jwtKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(WALLBOARD_JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }
  return await jwtKeyPromise;
}

async function authenticate(req: Request, url: URL): Promise<AuthResult> {
  const headerToken = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (headerToken.startsWith("Bearer ")) {
    const token = headerToken.slice(7).trim();
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }
    try {
      const key = await getJwtKey();
      const payload: Record<string, unknown> = await verify(token, key);
      if (payload.scope !== "wallboard") {
        throw new HttpError(403, "Invalid wallboard scope");
      }
      const presetSlug = typeof payload.preset === "string" ? payload.preset : undefined;
      return { method: "jwt", presetSlug };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(401, "Invalid token");
    }
  }

  const sharedHeader =
    req.headers.get("x-wallboard-token") ??
    req.headers.get("x-wallboard-shared-token") ??
    req.headers.get("x-wallboard-shared") ??
    url.searchParams.get("wallboardToken");
  if (sharedHeader) {
    if (!WALLBOARD_SHARED_TOKEN) {
      throw new HttpError(500, "WALLBOARD_SHARED_TOKEN is not configured");
    }
    if (sharedHeader !== WALLBOARD_SHARED_TOKEN) {
      throw new HttpError(403, "Forbidden");
    }
    const presetSlug = url.searchParams.get("preset")?.trim().toLowerCase() ?? undefined;
    return { method: "shared", presetSlug };
  }

  throw new HttpError(401, "Unauthorized");
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  try {
    const auth = await authenticate(req, url);
    const presetSlug = auth.presetSlug?.trim().toLowerCase() ?? undefined;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (path.endsWith("/jobs-overview")) {
      // Today + tomorrow window
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      const startDateStr = todayStart.toISOString().slice(0, 10);
      const endDateStr = tomorrowEnd.toISOString().slice(0, 10);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          color,
          job_type,
          locations(id, name),
          job_departments(department)
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", tomorrowEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const jobsArr = jobs ?? [];
      const jobIds = jobsArr.map((j: any) => j.id);
      const dayWindows = buildJobDayWindows(jobsArr, todayStart, tomorrowEnd);

      const { data: assignmentRows, error: assignmentErr } = jobIds.length
        ? await sb
            .from("job_assignments")
            .select("job_id, technician_id, sound_role, lights_role, video_role")
            .in("job_id", jobIds)
        : { data: [], error: null } as { data: AssignmentRow[] | null; error: any };
      if (assignmentErr) throw assignmentErr;

      const { data: timesheetRows, error: timesheetErr } = jobIds.length
        ? await sb
            .from("timesheets")
            .select("job_id, technician_id, date")
            .in("job_id", jobIds)
            .eq("is_schedule_only", false)
            .gte("date", startDateStr)
            .lte("date", endDateStr)
        : { data: [], error: null } as { data: TimesheetRow[] | null; error: any };
      if (timesheetErr) throw timesheetErr;

      const { jobDeptMinimums } = aggregateCrew(timesheetRows ?? [], assignmentRows ?? [], dayWindows);

      const result = {
        jobs: jobsArr.map((j: any) => {
          const depts: Dept[] = Array.from(
            new Set((j.job_departments ?? []).map((d: any) => d.department).filter(Boolean))
          );

          const counts = jobDeptMinimums.get(j.id) ?? { sound: 0, lights: 0, video: 0 };
          const crewAssigned = {
            ...counts,
            total: counts.sound + counts.lights + counts.video,
          } as Record<string, number>;

          const crewNeeded = { sound: 0, lights: 0, video: 0, total: 0 } as Record<string, number>;

          // Simple status: green if all present depts have >=1 assigned; yellow if some; red if none
          const presentCounts = depts.map((d) => crewAssigned[d]);
          const hasAny = presentCounts.some((n) => n > 0);
          const allHave = depts.length > 0 && presentCounts.every((n) => n > 0);
          const status = allHave ? "green" : hasAny ? "yellow" : "red";

          // Docs placeholder counts per dept (wire up in next phase)
          const docs = depts.reduce((acc, d) => {
            (acc as any)[d] = { have: 0, need: 0 };
            return acc;
          }, {} as Record<Dept, { have: number; need: number }>);

          return {
            id: j.id,
            title: j.title,
            start_time: j.start_time,
            end_time: j.end_time,
            location: { name: j.locations?.[0]?.name ?? j.locations?.name ?? null },
            departments: depts,
            crewAssigned: { ...crewAssigned },
            crewNeeded: { ...crewNeeded },
            docs,
            status,
          };
        }),
      } as any;

      return new Response(JSON.stringify({ ...result, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/crew-assignments")) {
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      const startDateStr = todayStart.toISOString().slice(0, 10);
      const endDateStr = tomorrowEnd.toISOString().slice(0, 10);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          job_type,
          color,
          job_assignments(
            technician_id,
            sound_role,
            lights_role,
            video_role,
            profiles(id, first_name, last_name)
          )
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", tomorrowEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const jobsArr = jobs ?? [];
      const jobIds = jobsArr.map((j: any) => j.id);
      const dayWindows = buildJobDayWindows(jobsArr, todayStart, tomorrowEnd);

      const assignments: AssignmentRow[] = [];
      jobsArr.forEach((j: any) => {
        (j.job_assignments ?? []).forEach((a: any) => {
          assignments.push({
            job_id: j.id,
            technician_id: a.technician_id,
            sound_role: a.sound_role,
            lights_role: a.lights_role,
            video_role: a.video_role,
          });
        });
      });

      const { data: timesheetRows, error: timesheetErr } = jobIds.length
        ? await sb
            .from("timesheets")
            .select("job_id, technician_id, date")
            .in("job_id", jobIds)
            .eq("is_schedule_only", false)
            .gte("date", startDateStr)
            .lte("date", endDateStr)
        : { data: [], error: null } as { data: TimesheetRow[] | null; error: any };
      if (timesheetErr) throw timesheetErr;

      const { jobTechSets } = aggregateCrew(timesheetRows ?? [], assignments, dayWindows);

      const { data: statusRows, error: statusErr } = jobIds.length
        ? await sb
            .from("wallboard_timesheet_status")
            .select("job_id, technician_id, status")
            .in("job_id", jobIds)
        : { data: [], error: null } as { data: { job_id: string; technician_id: string; status: string }[] | null; error: any };
      if (statusErr) throw statusErr;
      const tsStatus = new Map<string, Map<string, string>>();
      (statusRows ?? []).forEach((row) => {
        const byJob = tsStatus.get(row.job_id) ?? new Map<string, string>();
        byJob.set(row.technician_id, row.status);
        tsStatus.set(row.job_id, byJob);
      });

      const result = {
        jobs: jobsArr.map((j: any) => {
          const activeTechs = Array.from(jobTechSets.get(j.id) ?? new Set<string>());
          const crew = activeTechs
            .map((techId) => (j.job_assignments ?? []).find((a: any) => a.technician_id === techId))
            .filter((assignment): assignment is any => Boolean(assignment && assignment.video_role == null))
            .map((assignment: any) => {
              const dept: Dept | null = assignment.sound_role ? "sound" : assignment.lights_role ? "lights" : null;
              const role = assignment.sound_role || assignment.lights_role || "assigned";
              const name = [assignment.profiles?.first_name, assignment.profiles?.last_name].filter(Boolean).join(" ") || "";
              const statusValue = tsStatus.get(j.id)?.get(assignment.technician_id) ?? "missing";
              return { name, role, dept, timesheetStatus: statusValue };
            });
          return {
            id: j.id,
            title: j.title,
            jobType: j.job_type,
            start_time: j.start_time,
            end_time: j.end_time,
            color: j.color ?? null,
            crew,
          };
        }),
      } as any;

      return new Response(JSON.stringify({ ...result, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/doc-progress")) {
      // Skeleton: return jobs with departments present; zeroed counts
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          job_departments(department)
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", tomorrowEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const payload = {
        jobs: (jobs ?? []).map((j: any) => ({
          id: j.id,
          title: j.title,
          departments: Array.from(new Set((j.job_departments ?? []).map((d: any) => d.department))).map((dept: Dept) => ({
            dept,
            have: 0,
            need: 0,
            missing: [] as string[],
          })),
        })),
      };

      return new Response(JSON.stringify({ ...payload, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/pending-actions")) {
      // Simple triage: missing crew per dept today+tomorrow, and overdue timesheets for jobs ended >24h ago
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          end_time,
          job_departments(department),
          job_assignments(technician_id, sound_role, lights_role, video_role)
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", tomorrowEnd.toISOString());

      if (error) throw error;

      const items: { severity: "red" | "yellow"; text: string }[] = [];

      (jobs ?? []).forEach((j: any) => {
        const depts: Dept[] = Array.from(new Set((j.job_departments ?? []).map((d: any) => d.department)));
        const counts = { sound: 0, lights: 0, video: 0 } as Record<Dept, number>;
        (j.job_assignments ?? []).forEach((a: any) => {
          if (a.sound_role) counts.sound++;
          if (a.lights_role) counts.lights++;
          if (a.video_role) counts.video++;
        });
        depts.forEach((d) => {
          if (counts[d] === 0) {
            items.push({ severity: "yellow", text: `${j.title} – missing crew (${d})` });
          }
        });
      });

      // Timesheets overdue: jobs ended more than 24h ago among considered set
      const overdueJobs = (jobs ?? []).filter((j: any) => new Date(j.end_time).getTime() < Date.now() - 24 * 3600 * 1000);
      if (overdueJobs.length > 0) {
        const jobIds = overdueJobs.map((j: any) => j.id);
        const { data: ts } = await sb
          .from("timesheets")
          .select("job_id, technician_id, status")
          .in("job_id", jobIds);
        const byJobTech = new Map<string, Map<string, string[]>>();
        (ts ?? []).forEach((t) => {
          const m = byJobTech.get(t.job_id) ?? new Map<string, string[]>();
          const arr = m.get(t.technician_id) ?? [];
          arr.push(t.status);
          m.set(t.technician_id, arr);
          byJobTech.set(t.job_id, m);
        });
        overdueJobs.forEach((j: any) => {
          const m = byJobTech.get(j.id) ?? new Map<string, string[]>();
          // Count technicians with no submitted/approved timesheets
          const techIds = Array.from(new Set((j.job_assignments ?? []).map((a: any) => a.technician_id)));
          const missingCount = techIds.filter((tid) => {
            const statuses = m.get(tid) ?? [];
            return !statuses.some((s) => s === "submitted" || s === "approved");
          }).length;
          if (missingCount > 0) {
            items.push({ severity: "red", text: `${j.title} – ${missingCount} missing timesheets` });
          }
        });
      }

      return new Response(JSON.stringify({ items, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/announcements")) {
      const { data, error } = await sb
        .from("announcements")
        .select("id, message, level, active, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return new Response(JSON.stringify({ announcements: data ?? [], presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/preset-config")) {
      // Return preset configuration for the given slug
      if (!presetSlug) {
        return new Response(JSON.stringify({ error: "No preset slug provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      const { data, error } = await sb
        .from("wallboard_presets")
        .select("panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds")
        .eq("slug", presetSlug)
        .maybeSingle();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      if (!data) {
        return new Response(JSON.stringify({ error: "Preset not found", slug: presetSlug }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      return new Response(JSON.stringify({ config: data, slug: presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
});
