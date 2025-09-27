import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type Dept = "sound" | "lights" | "video";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
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

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // Security disabled for preview: feeds are public for now

    if (path.endsWith("/jobs-overview")) {
      // Today + tomorrow window
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          locations(id, name),
          job_departments(department),
          job_assignments(technician_id, sound_role, lights_role, video_role)
        `)
        .in("job_type", ["single", "festival", "tourdate"])
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", tomorrowEnd.toISOString())
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
            location: { name: j.locations?.[0]?.name ?? j.locations?.name ?? null },
            departments: depts,
            crewAssigned: { ...crewAssigned },
            crewNeeded: { ...crewNeeded },
            docs,
            status,
          };
        }),
      } as any;

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (path.endsWith("/crew-assignments")) {
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

      const { data: jobs, error } = await sb
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
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

      // Preload timesheets per job to compute status fast
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
          crew: (j.job_assignments ?? []).map((a: any) => {
            const dept: Dept | null = a.sound_role ? "sound" : a.lights_role ? "lights" : a.video_role ? "video" : null;
            const role = a.sound_role || a.lights_role || a.video_role || "assigned";
            const name = [a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || "";
            const timesheetStatus = computeStatus(j, a.technician_id);
            return { name, role, dept, timesheetStatus };
          }),
        })),
      } as any;

      return new Response(JSON.stringify(result), {
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

      return new Response(JSON.stringify(payload), {
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

      return new Response(JSON.stringify({ items }), {
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
      return new Response(JSON.stringify({ announcements: data ?? [] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
});
