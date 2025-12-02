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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wallboard-jwt, x-wallboard-token, x-wallboard-shared-token, x-wallboard-shared",
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
  const headerJwt = req.headers.get("x-wallboard-jwt")?.trim();
  if (headerJwt) {
    try {
      const key = await getJwtKey();
      const payload: Record<string, unknown> = await verify(headerJwt, key);
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
  
  // Read path from request body (Supabase client sends it this way)
  // Clone the request first so we don't consume the body
  let path = "";
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.json();
    path = body.path || "";
  } catch {
    // Fallback to URL pathname if body parsing fails (for direct HTTP calls)
    path = url.pathname.replace(/\/+$/, "");
  }

  try {
    const auth = await authenticate(req, url);
    const presetSlug = auth.presetSlug?.trim().toLowerCase() ?? undefined;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (path.endsWith("/jobs-overview")) {
      // Next 7 days window
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

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
          job_departments(department),
          job_assignments(technician_id, sound_role, lights_role, video_role)
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const result = {
        jobs: (jobs ?? []).map((j: any) => {
          const depts: Dept[] = Array.from(
            new Set((j.job_departments ?? []).map((d: any) => d.department).filter(Boolean))
          );

          const crewAssigned = { sound: 0, lights: 0, video: 0, total: 0 } as Record<string, number>;
          (j.job_assignments ?? []).forEach((a: any) => {
            if (a.sound_role) crewAssigned.sound++;
            if (a.lights_role) crewAssigned.lights++;
            if (a.video_role) crewAssigned.video++;
          });
          crewAssigned.total = crewAssigned.sound + crewAssigned.lights + crewAssigned.video;

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
            color: j.color,
            job_type: j.job_type,
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

    if (path.endsWith("/calendar")) {
      // Calendar grid: fetch jobs for the entire calendar view (current month + padding)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const offset = (startOfMonth.getDay() + 6) % 7; // Monday-based week
      const gridStart = new Date(startOfMonth.getTime() - offset * 24 * 60 * 60 * 1000);
      const gridEnd = new Date(gridStart.getTime() + 42 * 24 * 60 * 60 * 1000 - 1);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          job_type,
          color,
          locations(id, name),
          job_departments(department),
          job_assignments(technician_id, sound_role, lights_role, video_role)
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", gridStart.toISOString())
        .lte("start_time", gridEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const result = {
        jobs: (jobs ?? []).map((j: any) => {
          const depts = Array.from(
            new Set((j.job_departments ?? []).map((d: any) => d.department).filter(Boolean))
          );

          const crewAssigned = { sound: 0, lights: 0, video: 0, total: 0 } as Record<string, number>;
          (j.job_assignments ?? []).forEach((a: any) => {
            if (a.sound_role) crewAssigned.sound++;
            if (a.lights_role) crewAssigned.lights++;
            if (a.video_role) crewAssigned.video++;
          });
          crewAssigned.total = crewAssigned.sound + crewAssigned.lights + crewAssigned.video;

          const crewNeeded = { sound: 0, lights: 0, video: 0, total: 0 } as Record<string, number>;

          const presentCounts = depts.map((d) => crewAssigned[d as any]);
          const hasAny = presentCounts.some((n) => n > 0);
          const allHave = depts.length > 0 && presentCounts.every((n) => n > 0);
          const status = allHave ? "green" : hasAny ? "yellow" : "red";

          const docs = depts.reduce((acc, d) => {
            (acc as any)[d] = { have: 0, need: 0 };
            return acc;
          }, {} as Record<string, { have: number; need: number }>);

          return {
            id: j.id,
            title: j.title,
            start_time: j.start_time,
            end_time: j.end_time,
            job_type: j.job_type,
            color: j.color,
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
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          color,
          job_type,
          job_assignments(
            technician_id,
            sound_role,
            lights_role,
            video_role,
            profiles(id, first_name, last_name)
          )
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .in("status", ["Confirmado", "Tentativa", "Completado"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const jobsArr = jobs ?? [];
      const jobIds = jobsArr.map((j: any) => j.id);
      const timesheetsByJob = new Map<string, any[]>();

      if (jobIds.length > 0) {
        const { data: ts } = await sb
          .from("timesheets")
          .select("id, job_id, technician_id, status, date")
          .in("job_id", jobIds);
        (ts ?? []).forEach((t) => {
          const arr = timesheetsByJob.get(t.job_id) ?? [];
          arr.push(t);
          timesheetsByJob.set(t.job_id, arr);
        });
      }

      const computeStatus = (job: any, techId: string): "submitted" | "draft" | "missing" | "approved" => {
        const list = timesheetsByJob.get(job.id) ?? [];
        const ts = list.filter((t) => t.technician_id === techId);
        if (ts.length === 0) return "missing";
        const hasApproved = ts.some((t) => t.status === "approved");
        const hasSubmitted = ts.some((t) => t.status === "submitted");
        const inPast = new Date(job.end_time) < new Date();
        if (inPast && hasApproved) return "approved";
        if (hasSubmitted) return "submitted";
        return "draft";
      };

      const result = {
        jobs: jobsArr.map((j: any) => ({
          id: j.id,
          title: j.title,
          color: j.color,
          jobType: j.job_type,
          start_time: j.start_time,
          end_time: j.end_time,
          crew: (j.job_assignments ?? []).map((a: any) => {
            const dept: Dept | null = a.sound_role ? "sound" : a.lights_role ? "lights" : a.video_role ? "video" : null;
            const role = a.sound_role || a.lights_role || a.video_role || "assigned";
            const name = [a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || "";
            const timesheetStatus = computeStatus(j, a.technician_id);
            return { name, role, dept, timesheetStatus };
          }),
        })),
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
        .in("status", ["Confirmado", "Tentativa", "Completado"])
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
        .in("status", ["Confirmado", "Tentativa", "Completado"])
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
          if (d === 'video') return;
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

    if (path.endsWith("/logistics")) {
      // Return logistics events for the next 7 days
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const startDate = todayStart.toISOString().slice(0, 10);
      const endDate = weekEnd.toISOString().slice(0, 10);

      // Fetch logistics events
      const { data: events, error: eventsError } = await sb
        .from("logistics_events")
        .select("id, event_date, event_time, title, transport_type, transport_provider, license_plate, job_id, event_type, loading_bay, color, notes, logistics_event_departments(department)")
        .gte("event_date", startDate)
        .lte("event_date", endDate)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (eventsError) throw eventsError;

      const evts = events ?? [];
      const evtJobIds = Array.from(new Set(evts.map((e: any) => e.job_id).filter(Boolean)));
      const titlesByJob = new Map<string, string>();

      // Fetch job titles for events that reference jobs
      if (evtJobIds.length > 0) {
        const { data: jobs } = await sb
          .from("jobs")
          .select("id, title")
          .in("id", evtJobIds);
        (jobs ?? []).forEach((j: any) => titlesByJob.set(j.id, j.title));
      }

      // Map logistics events to the expected format
      const logisticsItemsBase = evts.map((e: any) => {
        const departments = Array.isArray(e.logistics_event_departments)
          ? e.logistics_event_departments.map((dep: any) => dep?.department).filter(Boolean)
          : [];
        return {
          id: e.id,
          date: e.event_date,
          time: e.event_time,
          title: e.title || titlesByJob.get(e.job_id) || "Logistics",
          transport_type: e.transport_type ?? null,
          transport_provider: e.transport_provider ?? null,
          plate: e.license_plate ?? null,
          job_title: titlesByJob.get(e.job_id) || null,
          procedure: e.event_type ?? null,
          loadingBay: e.loading_bay ?? null,
          departments,
          color: e.color ?? null,
          notes: e.notes ?? null,
        };
      });

      // Fetch confirmed dry-hire jobs for client pickups/returns
      const { data: dryHireJobs } = await sb
        .from("jobs")
        .select("id, title, start_time, end_time, job_type, status, timezone")
        .eq("job_type", "dryhire")
        .eq("status", "Confirmado")
        .gte("start_time", startDate)
        .lte("start_time", weekEnd.toISOString());

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
          const date = dateFmt.format(d);
          const time = timeFmt.format(d);
          return { date, time };
        } catch {
          return { date: (iso || "").slice(0, 10), time: (iso || "").slice(11, 16) };
        }
      };

      const dryHireItems = (dryHireJobs ?? []).flatMap((j: any) => {
        const nowParts = toTZParts(new Date().toISOString(), j.timezone);
        const pickupParts = toTZParts(j.start_time, j.timezone);
        const returnParts = j.end_time ? toTZParts(j.end_time, j.timezone) : null;
        const nowKey = `${nowParts.date}${nowParts.time}`;
        const pickupKey = `${pickupParts.date}${pickupParts.time}`;
        const weekWindowParts = toTZParts(weekEnd.toISOString(), j.timezone);
        const weekWindowKey = `${weekWindowParts.date}${weekWindowParts.time}`;
        const items: any[] = [];

        if (pickupKey >= nowKey && pickupKey <= weekWindowKey) {
          items.push({
            id: `dryhire-${j.id}`,
            date: pickupParts.date,
            time: pickupParts.time,
            title: j.title || "Dry Hire",
            transport_type: "recogida cliente",
            transport_provider: null,
            plate: null,
            job_title: j.title || null,
            procedure: "load",
            loadingBay: null,
            departments: [],
            color: null,
            notes: null,
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
              transport_provider: null,
              plate: null,
              job_title: j.title || null,
              procedure: "unload",
              loadingBay: null,
              departments: [],
              color: null,
              notes: null,
            });
          }
        }

        return items;
      });

      const logisticsItems = [...logisticsItemsBase, ...dryHireItems].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      );

      return new Response(JSON.stringify({ items: logisticsItems, presetSlug }), {
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
      console.log("📋 [preset-config] Request received", { presetSlug, authMethod: auth.method });
      
      if (!presetSlug) {
        console.error("❌ [preset-config] No preset slug provided");
        return new Response(JSON.stringify({ error: "No preset slug provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      console.log("🔍 [preset-config] Querying database for slug:", presetSlug);
      const { data, error } = await sb
        .from("wallboard_presets")
        .select("panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds")
        .eq("slug", presetSlug)
        .maybeSingle();

      if (error) {
        console.error("❌ [preset-config] Database error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      if (!data) {
        console.error("❌ [preset-config] Preset not found in database:", presetSlug);
        return new Response(JSON.stringify({ error: "Preset not found", slug: presetSlug }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      console.log("✅ [preset-config] Preset found and returning:", { slug: presetSlug, panelOrder: data.panel_order });
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
