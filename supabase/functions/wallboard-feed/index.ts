import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FALLBACK_SHARED_TOKEN = Deno.env.get("VITE_WALLBOARD_TOKEN") ?? "demo-wallboard-token";
const WALLBOARD_SHARED_TOKEN = Deno.env.get("WALLBOARD_SHARED_TOKEN") ?? FALLBACK_SHARED_TOKEN;
const FALLBACK_WALLBOARD_JWT_SECRET = Deno.env.get("WALLBOARD_JWT_SECRET") ?? "wallboard-dev-secret";
const WALLBOARD_JWT_SECRET = Deno.env.get("WALLBOARD_JWT_SECRET") ?? FALLBACK_WALLBOARD_JWT_SECRET;

type AuthResult = {
  method: "jwt" | "shared";
  presetSlug?: string | null;
};

type Dept = "sound" | "lights" | "video";
type LogisticsItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  transport_type: string | null;
  plate: string | null;
  job_title?: string | null;
  procedure: string | null;
  loadingBay: string | null;
  departments: string[];
  color?: string | null;
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wallboard-jwt",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  // 1) Explicit wallboard JWT header (to avoid Supabase client overriding Authorization)
  const xJwt = req.headers.get("x-wallboard-jwt");
  if (xJwt) {
    try {
      const key = await getJwtKey();
      const payload: Record<string, unknown> = await verify(xJwt, key);
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

  // Allow supabase.functions.invoke POST body to specify the feed path
  let pathFromBody = "";
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const body = await req.json();
        if (body?.path && typeof body.path === "string") {
          pathFromBody = body.path;
        }
      } catch {
        // ignore body parse errors; fall back to URL
      }
    }
  }

  // Normalize requested path, removing the functions prefix if present
  const rawPath = pathFromBody || url.pathname;
  let path = rawPath.replace(/\/+$/, "");
  const idx = path.indexOf("wallboard-feed");
  if (idx >= 0) {
    path = path.slice(idx + "wallboard-feed".length);
  }
  if (!path || path === "") path = "/";

  try {
    const auth = await authenticate(req, url);
    const presetSlug = auth.presetSlug?.trim().toLowerCase() ?? undefined;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (path.endsWith("/jobs-overview")) {
      // 7-day window from today (matches authenticated wallboard)
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          status,
          location_id,
          job_type,
          tour_id,
          timezone,
          color,
          job_departments(department),
          job_assignments(technician_id, sound_role, lights_role, video_role)
        `)
        .in("job_type", ["single", "festival", "tourdate", "dryhire"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Exclude jobs whose parent tour is cancelled
      let jobArr = jobs ?? [];
      const tourIds = Array.from(new Set(jobArr.map((j: any) => j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta, error: toursErr } = await sb
          .from("tours")
          .select("id, status")
          .in("id", tourIds);
        if (!toursErr && toursMeta && toursMeta.length) {
          const cancelledTours = new Set(
            (toursMeta as any[]).filter((t: any) => t.status === "cancelled").map((t: any) => t.id)
          );
          if (cancelledTours.size) {
            jobArr = jobArr.filter((j: any) => !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }

      // Exclude dryhire jobs from overview (they go to logistics)
      const dryhireIds = new Set<string>(jobArr.filter((j: any) => j.job_type === "dryhire").map((j: any) => j.id));
      const nonDryhireJobs = jobArr.filter((j: any) => !dryhireIds.has(j.id));

      // Get location names
      const locationIds = Array.from(new Set(nonDryhireJobs.map((j: any) => j.location_id).filter(Boolean)));
      const locById = new Map<string, string>();
      if (locationIds.length) {
        const { data: locRows } = await sb.from("locations").select("id, name").in("id", locationIds);
        (locRows ?? []).forEach((l: any) => locById.set(l.id, l.name));
      }

      // Get doc counts and requirements
      const jobIds = nonDryhireJobs.map((j: any) => j.id);
      const haveByJobDept = new Map<string, number>();
      const needByDept = new Map<string, number>();
      if (jobIds.length) {
        const [{ data: counts }, { data: reqs }] = await Promise.all([
          sb.from("wallboard_doc_counts").select("job_id, department, have").in("job_id", jobIds),
          sb.from("wallboard_doc_requirements").select("department, need"),
        ]);
        (reqs ?? []).forEach((r: any) => needByDept.set(r.department, r.need));
        (counts ?? []).forEach((c: any) => haveByJobDept.set(`${c.job_id}:${c.department}`, c.have));
      }

      // Get required role summaries
      const needByJobDept = new Map<string, number>();
      if (jobIds.length) {
        const { data: reqRows } = await sb
          .from("job_required_roles_summary")
          .select("job_id, department, total_required")
          .in("job_id", jobIds);
        (reqRows ?? []).forEach((r: any) => {
          needByJobDept.set(`${r.job_id}:${r.department}`, Number(r.total_required || 0));
        });
      }

      const result = {
        jobs: nonDryhireJobs.map((j: any) => {
          const deptsAll: Dept[] = Array.from(
            new Set((j.job_departments ?? []).map((d: any) => d.department).filter(Boolean))
          );
          // Filter out video department (matches authenticated wallboard)
          const depts: Dept[] = deptsAll.filter((d) => d !== "video");

          const crewAssigned = { sound: 0, lights: 0, video: 0 } as Record<string, number>;
          (j.job_assignments ?? []).forEach((a: any) => {
            if (a.sound_role) crewAssigned.sound++;
            if (a.lights_role) crewAssigned.lights++;
            if (a.video_role) crewAssigned.video++;
          });

          const crewNeeded = { sound: 0, lights: 0, video: 0 } as Record<string, number>;
          depts.forEach((d) => {
            crewNeeded[d] = needByJobDept.get(`${j.id}:${d}`) || 0;
          });

          // Calculate status based on requirements or simple presence check
          let status: "green" | "yellow" | "red";
          const hasReq = depts.some((d) => (crewNeeded[d] || 0) > 0);
          if (hasReq) {
            const perDept = depts.map((d) => {
              const need = crewNeeded[d] || 0;
              const have = crewAssigned[d] || 0;
              if (need <= 0) return 1;
              if (have >= need) return 1;
              if (have > 0) return 0.5;
              return 0;
            });
            const minCov = Math.min(...perDept);
            status = minCov >= 1 ? "green" : minCov > 0 ? "yellow" : "red";
          } else {
            const present = depts.map((d) => crewAssigned[d]);
            const hasAny = present.some((n) => n > 0);
            const allHave = depts.length > 0 && present.every((n) => n > 0);
            status = allHave ? "green" : hasAny ? "yellow" : "red";
          }

          // Doc counts per department
          const docs: Record<string, { have: number; need: number }> = {};
          depts.forEach((d) => {
            const have = haveByJobDept.get(`${j.id}:${d}`) ?? 0;
            const need = needByDept.get(d) ?? 0;
            docs[d] = { have, need };
          });

          return {
            id: j.id,
            title: j.title,
            start_time: j.start_time,
            end_time: j.end_time,
            location: { name: j.location_id ? (locById.get(j.location_id) ?? null) : null },
            departments: depts,
            crewAssigned: { ...crewAssigned, total: crewAssigned.sound + crewAssigned.lights + crewAssigned.video },
            crewNeeded: { ...crewNeeded, total: crewNeeded.sound + crewNeeded.lights + crewNeeded.video },
            docs,
            status,
            color: j.color ?? null,
            job_type: j.job_type ?? null,
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
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          status,
          job_type,
          tour_id,
          color
        `)
        .in("job_type", ["single", "festival", "tourdate", "dryhire"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Exclude jobs whose parent tour is cancelled
      let jobsArr = jobs ?? [];
      const tourIds = Array.from(new Set(jobsArr.map((j: any) => j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta } = await sb.from("tours").select("id, status").in("id", tourIds);
        if (toursMeta && toursMeta.length) {
          const cancelledTours = new Set(
            (toursMeta as any[]).filter((t: any) => t.status === "cancelled").map((t: any) => t.id)
          );
          if (cancelledTours.size) {
            jobsArr = jobsArr.filter((j: any) => !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }

      // Exclude dryhire jobs
      const dryhireIds = new Set<string>(jobsArr.filter((j: any) => j.job_type === "dryhire").map((j: any) => j.id));
      const nonDryhireJobs = jobsArr.filter((j: any) => !dryhireIds.has(j.id));

      // Get job assignments
      const jobIds = nonDryhireJobs.map((j: any) => j.id);
      const assignsByJob = new Map<string, any[]>();
      if (jobIds.length) {
        const { data: assignRows } = await sb
          .from("job_assignments")
          .select("job_id, technician_id, sound_role, lights_role, video_role")
          .in("job_id", jobIds);
        (assignRows ?? []).forEach((a: any) => {
          const list = assignsByJob.get(a.job_id) ?? [];
          list.push(a);
          assignsByJob.set(a.job_id, list);
        });
      }

      // Get timesheet statuses via wallboard_timesheet_status view
      const tsByJobTech = new Map<string, Map<string, string>>();
      if (jobIds.length) {
        const { data: ts } = await sb
          .from("wallboard_timesheet_status")
          .select("job_id, technician_id, status")
          .in("job_id", jobIds);
        (ts ?? []).forEach((row: any) => {
          const m = tsByJobTech.get(row.job_id) ?? new Map();
          m.set(row.technician_id, row.status as string);
          tsByJobTech.set(row.job_id, m);
        });
      }

      // Get technician names from wallboard_profiles
      const techIds = Array.from(
        new Set(
          nonDryhireJobs.flatMap((j: any) => {
            const assigns = assignsByJob.get(j.id) ?? [];
            return assigns.map((a: any) => a.technician_id).filter(Boolean);
          })
        )
      );
      const profileById = new Map<string, any>();
      if (techIds.length) {
        const { data: profs } = await sb
          .from("wallboard_profiles")
          .select("id, first_name, last_name, department")
          .in("id", techIds);
        (profs ?? []).forEach((p: any) => profileById.set(p.id, p));
      }

      const result = {
        jobs: nonDryhireJobs.map((j: any) => ({
          id: j.id,
          title: j.title,
          jobType: j.job_type,
          start_time: j.start_time,
          end_time: j.end_time,
          color: j.color ?? null,
          crew: (assignsByJob.get(j.id) ?? [])
            // Filter out video crew (matches authenticated wallboard)
            .filter((a: any) => a.video_role == null)
            .map((a: any) => {
              const dept: Dept | null = a.sound_role ? "sound" : a.lights_role ? "lights" : null;
              const role = a.sound_role || a.lights_role || "assigned";
              const p = profileById.get(a.technician_id);
              const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "";
              const s = tsByJobTech.get(j.id)?.get(a.technician_id);
              const inPast = new Date(j.end_time) < new Date();
              const normalizedStatus = s === "rejected" ? "rejected" : s;
              const timesheetStatus = inPast && normalizedStatus === "approved" ? "approved" : (normalizedStatus || "missing");
              return { name, role, dept, timesheetStatus };
            }),
        })),
      } as any;

      return new Response(JSON.stringify({ ...result, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/doc-progress")) {
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          status,
          job_type,
          tour_id,
          color,
          job_departments(department)
        `)
        .in("job_type", ["single", "festival", "tourdate", "dryhire"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Exclude jobs whose parent tour is cancelled
      let jobsArr = jobs ?? [];
      const tourIds = Array.from(new Set(jobsArr.map((j: any) => j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta } = await sb.from("tours").select("id, status").in("id", tourIds);
        if (toursMeta && toursMeta.length) {
          const cancelledTours = new Set(
            (toursMeta as any[]).filter((t: any) => t.status === "cancelled").map((t: any) => t.id)
          );
          if (cancelledTours.size) {
            jobsArr = jobsArr.filter((j: any) => !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }

      // Exclude dryhire jobs
      const dryhireIds = new Set<string>(jobsArr.filter((j: any) => j.job_type === "dryhire").map((j: any) => j.id));
      const nonDryhireJobs = jobsArr.filter((j: any) => !dryhireIds.has(j.id));

      // Get doc counts and requirements
      const jobIds = nonDryhireJobs.map((j: any) => j.id);
      const haveByJobDept = new Map<string, number>();
      const needByDept = new Map<string, number>();
      if (jobIds.length) {
        const [{ data: counts }, { data: reqs }] = await Promise.all([
          sb.from("wallboard_doc_counts").select("job_id, department, have").in("job_id", jobIds),
          sb.from("wallboard_doc_requirements").select("department, need"),
        ]);
        (reqs ?? []).forEach((r: any) => needByDept.set(r.department, r.need));
        (counts ?? []).forEach((c: any) => haveByJobDept.set(`${c.job_id}:${c.department}`, c.have));
      }

      const payload = {
        jobs: nonDryhireJobs.map((j: any) => {
          const deptsAll: Dept[] = Array.from(
            new Set((j.job_departments ?? []).map((d: any) => d.department).filter(Boolean))
          );
          return {
            id: j.id,
            title: j.title,
            color: j.color ?? null,
            departments: deptsAll.map((dept: Dept) => ({
              dept,
              have: haveByJobDept.get(`${j.id}:${dept}`) ?? 0,
              need: needByDept.get(dept) ?? 0,
              missing: [] as string[],
            })),
          };
        }),
      };

      return new Response(JSON.stringify({ ...payload, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/pending-actions")) {
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          status,
          job_type,
          tour_id,
          job_departments(department)
        `)
        .in("job_type", ["single", "festival", "tourdate", "dryhire"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", weekEnd.toISOString());

      if (error) throw error;

      // Exclude jobs whose parent tour is cancelled
      let jobsArr = jobs ?? [];
      const tourIds = Array.from(new Set(jobsArr.map((j: any) => j.tour_id).filter(Boolean)));
      if (tourIds.length) {
        const { data: toursMeta } = await sb.from("tours").select("id, status").in("id", tourIds);
        if (toursMeta && toursMeta.length) {
          const cancelledTours = new Set(
            (toursMeta as any[]).filter((t: any) => t.status === "cancelled").map((t: any) => t.id)
          );
          if (cancelledTours.size) {
            jobsArr = jobsArr.filter((j: any) => !j.tour_id || !cancelledTours.has(j.tour_id));
          }
        }
      }

      // Exclude dryhire jobs
      const dryhireIds = new Set<string>(jobsArr.filter((j: any) => j.job_type === "dryhire").map((j: any) => j.id));
      const nonDryhireJobs = jobsArr.filter((j: any) => !dryhireIds.has(j.id));

      // Get job assignments
      const jobIds = nonDryhireJobs.map((j: any) => j.id);
      const assignsByJob = new Map<string, any[]>();
      if (jobIds.length) {
        const { data: assignRows } = await sb
          .from("job_assignments")
          .select("job_id, technician_id, sound_role, lights_role, video_role")
          .in("job_id", jobIds);
        (assignRows ?? []).forEach((a: any) => {
          const list = assignsByJob.get(a.job_id) ?? [];
          list.push(a);
          assignsByJob.set(a.job_id, list);
        });
      }

      // Get required role summaries
      const needByJobDept = new Map<string, number>();
      if (jobIds.length) {
        const { data: reqRows } = await sb
          .from("job_required_roles_summary")
          .select("job_id, department, total_required")
          .in("job_id", jobIds);
        (reqRows ?? []).forEach((r: any) => {
          needByJobDept.set(`${r.job_id}:${r.department}`, Number(r.total_required || 0));
        });
      }

      // Get timesheet statuses via wallboard_timesheet_status view
      const tsByJobTech = new Map<string, Map<string, string>>();
      if (jobIds.length) {
        const { data: ts } = await sb
          .from("wallboard_timesheet_status")
          .select("job_id, technician_id, status")
          .in("job_id", jobIds);
        (ts ?? []).forEach((row: any) => {
          const m = tsByJobTech.get(row.job_id) ?? new Map();
          m.set(row.technician_id, row.status as string);
          tsByJobTech.set(row.job_id, m);
        });
      }

      const items: { severity: "red" | "yellow"; text: string }[] = [];

      nonDryhireJobs.forEach((j: any) => {
        const deptsAll: Dept[] = Array.from(new Set((j.job_departments ?? []).map((d: any) => d.department)));
        // Filter out video department (matches authenticated wallboard)
        const depts: Dept[] = deptsAll.filter((d) => d !== "video");

        const assigns = assignsByJob.get(j.id) ?? [];
        const crewAssigned = { sound: 0, lights: 0, video: 0 } as Record<Dept, number>;
        assigns.forEach((a: any) => {
          if (a.sound_role) crewAssigned.sound++;
          if (a.lights_role) crewAssigned.lights++;
          if (a.video_role) crewAssigned.video++;
        });

        // Check under-staffing based on requirements (sound/lights only)
        depts.forEach((d: Dept) => {
          const need = needByJobDept.get(`${j.id}:${d}`) || 0;
          const have = crewAssigned[d] || 0;
          if (need > 0 && have < need) {
            const startsInMs = new Date(j.start_time).getTime() - Date.now();
            const within24h = startsInMs <= 24 * 3600 * 1000;
            items.push({ severity: within24h ? "red" : "yellow", text: `${j.title} – ${need - have} open ${d} slot(s)` });
          }
        });

        // Overdue timesheets: jobs ended more than 24h ago
        const ended24h = new Date(j.end_time).getTime() < Date.now() - 24 * 3600 * 1000;
        if (ended24h) {
          const m = tsByJobTech.get(j.id) ?? new Map<string, string>();
          // Count assigned techs (excluding video) without submitted/approved timesheets
          const techList = assigns
            .filter((a: any) => a.video_role == null)
            .map((a: any) => a.technician_id);
          const missingCount = techList.filter((tid: string) => {
            const s = m.get(tid);
            return !(s === "approved" || s === "submitted");
          }).length;
          if (missingCount > 0) {
            items.push({ severity: "red", text: `${j.title} – ${missingCount} missing timesheets` });
          }
        }
      });

      return new Response(JSON.stringify({ items, presetSlug }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/logistics")) {
      const now = new Date();
      const weekStart = startOfDay(now);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const { data: events, error: evErr } = await sb
        .from("logistics_events")
        .select("id,event_date,event_time,title,transport_type,license_plate,job_id,event_type,loading_bay,color,logistics_event_departments(department),jobs(title,color)")
        .gte("event_date", weekStart.toISOString().slice(0, 10))
        .lte("event_date", weekEnd.toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });
      if (evErr) throw evErr;

      const logisticsItemsBase: LogisticsItem[] = (events || []).map((e: any) => ({
        id: e.id,
        date: e.event_date || "",
        time: e.event_time || "",
        title: e.title || e.event_type || "Logística",
        transport_type: e.transport_type || null,
        plate: e.license_plate || null,
        job_title: e.jobs?.title || null,
        procedure: e.event_type || null,
        loadingBay: e.loading_bay || null,
        departments: Array.isArray(e.logistics_event_departments)
          ? (e.logistics_event_departments as any[]).map((d: any) => d?.department).filter(Boolean)
          : [],
        color: e.color || e.jobs?.color || null,
      }));

      // Fetch confirmed dry-hire jobs and include as client pickup/return logistics
      const { data: dryhireJobs } = await sb
        .from("jobs")
        .select("id, title, start_time, end_time, status, job_type, tour_id, timezone, color")
        .eq("job_type", "dryhire")
        .eq("status", "Confirmado")
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString());

      // Helper to format ISO to date/time strings in the job's timezone
      const toTZParts = (iso: string, tz?: string): { date: string; time: string } => {
        try {
          const d = new Date(iso);
          const zone = tz || "Europe/Madrid";
          const dateFmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const timeFmt = new Intl.DateTimeFormat("en-GB", {
            timeZone: zone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const date = dateFmt.format(d); // YYYY-MM-DD
          const time = timeFmt.format(d); // HH:mm
          return { date, time };
        } catch {
          return { date: (iso || "").slice(0, 10), time: (iso || "").slice(11, 16) };
        }
      };

      const dryHireItems: LogisticsItem[] = (dryhireJobs || []).flatMap((j: any) => {
        const nowParts = toTZParts(new Date().toISOString(), j.timezone);
        const pickupParts = toTZParts(j.start_time, j.timezone);
        const returnParts = j.end_time ? toTZParts(j.end_time, j.timezone) : null;
        const nowKey = `${nowParts.date}${nowParts.time}`;
        const pickupKey = `${pickupParts.date}${pickupParts.time}`;
        const weekWindowParts = toTZParts(weekEnd.toISOString(), j.timezone);
        const weekWindowKey = `${weekWindowParts.date}${weekWindowParts.time}`;
        const items: LogisticsItem[] = [];

        if (pickupKey >= nowKey && pickupKey <= weekWindowKey) {
          items.push({
            id: `dryhire-${j.id}`,
            date: pickupParts.date,
            time: pickupParts.time,
            title: j.title || "Dry Hire",
            transport_type: "recogida cliente",
            plate: null,
            job_title: j.title || null,
            procedure: "load",
            loadingBay: null,
            departments: [],
            color: j.color ?? null,
          });
        }

        if (returnParts) {
          const returnKey = `${returnParts.date}${returnParts.time}`;
          if (returnKey >= nowKey && returnKey <= weekWindowKey) {
            items.push({
              id: `dryhire-return-${j.id}`,
              date: returnParts.date,
              time: returnParts.time,
              title: j.title || "Dry Hire",
              transport_type: "devolución cliente",
              plate: null,
              job_title: j.title || null,
              procedure: "unload",
              loadingBay: null,
              departments: [],
              color: j.color ?? null,
            });
          }
        }

        return items;
      });

      const payload: LogisticsItem[] = [...logisticsItemsBase, ...dryHireItems].sort((a: any, b: any) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      );

      return new Response(JSON.stringify({ items: payload, presetSlug }), {
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
