import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { groupTimesheetAssignments, TimesheetCalendarRow } from "../_shared/timesheetCalendarUtils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type JobRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone?: string | null;
};

type AssignmentRoleRow = {
  job_id: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
};

type TimesheetRow = TimesheetCalendarRow & { date: string };

function isUuid(v?: string | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function fmtUTC(dt: Date) {
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const HH = String(dt.getUTCHours()).padStart(2, "0");
  const MM = String(dt.getUTCMinutes()).padStart(2, "0");
  const SS = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`;
}

function escapeICSText(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string) {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += 75) {
    chunks.push(line.slice(i, i + 75));
  }
  return chunks.join("\r\n ");
}

function lines(...items: Array<string | null | undefined>) {
  return items.filter(Boolean).map((l) => foldIcsLine(l!)).join("\r\n");
}

async function sha1(s: string) {
  const enc = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-1", enc);
  const arr = new Uint8Array(digest);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function replaceIsoDateKeepingTimeAndOffset(iso: string, ymd: string): string {
  if (!iso || iso.length < 10) return iso;
  return `${ymd}${iso.slice(10)}`;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

type EventWindow = { start: Date; end: Date };

function buildEventWindow(job: JobRow, assignmentDate: string): EventWindow | null {
  let start: Date | null = null;
  let end: Date | null = null;

  if (job.start_time) {
    const sIso = replaceIsoDateKeepingTimeAndOffset(job.start_time, assignmentDate);
    start = new Date(sIso);
  }

  if (job.end_time) {
    const eIso = replaceIsoDateKeepingTimeAndOffset(job.end_time, assignmentDate);
    end = new Date(eIso);
  }

  if (!start) {
    start = new Date(`${assignmentDate}T00:00:00Z`);
  }

  if (!end) {
    end = new Date(start.getTime() + 2 * 3600 * 1000);
  }

  if (!(end.getTime() > start.getTime())) {
    end = new Date(start.getTime() + 2 * 3600 * 1000);
  }

  return { start, end };
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: {
        "Content-Type": "text/calendar; charset=UTF-8",
        "Cache-Control": "public, max-age=900",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const tid = url.searchParams.get("tid");
  const token = url.searchParams.get("token");
  const daysBack = Math.max(0, Math.min(365, Number(url.searchParams.get("back") || 90)));
  const daysFwd = Math.max(1, Math.min(730, Number(url.searchParams.get("fwd") || 365)));

  if (!isUuid(tid) || !token) {
    return new Response("Invalid parameters", { status: 400 });
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, calendar_ics_token")
    .eq("id", tid)
    .maybeSingle();

  if (profErr || !profile || !profile.calendar_ics_token || profile.calendar_ics_token !== token) {
    return new Response("Forbidden", { status: 403 });
  }

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysBack * 24 * 3600 * 1000);
  const endWindow = new Date(now.getTime() + daysFwd * 24 * 3600 * 1000);
  const startDateStr = formatDate(startWindow);
  const endDateStr = formatDate(endWindow);

  const { data: rawTimesheets, error: tsErr } = await supabase
    .from("timesheets")
    .select("job_id,date")
    .eq("technician_id", tid)
    .eq("is_schedule_only", false)
    .gte("date", startDateStr)
    .lte("date", endDateStr)
    .order("date", { ascending: true });

  if (tsErr) {
    return new Response("Failed to load schedule", { status: 500 });
  }

  const timesheets = ((rawTimesheets ?? []) as TimesheetRow[]).filter((row) => row.job_id && row.date);

  if (timesheets.length === 0) {
    const ics = buildCalendar(profile, []);
    const etag = await sha1(ics);
    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=UTF-8",
        "Cache-Control": "public, max-age=900",
        "ETag": `W/"${etag}"`,
      },
    });
  }

  const jobIds = Array.from(new Set(timesheets.map((ts) => ts.job_id)));

  const { data: jobs, error: jErr } = await supabase
    .from("jobs")
    .select("id,title,start_time,end_time,timezone")
    .in("id", jobIds);

  if (jErr) {
    return new Response("Failed to load jobs", { status: 500 });
  }

  const jobMap = new Map<string, JobRow>();
  for (const job of (jobs ?? []) as JobRow[]) {
    jobMap.set(job.id, job);
  }

  const assignmentRoleMap = new Map<string, AssignmentRoleRow>();

  if (jobIds.length > 0) {
    const { data: assignmentRows, error: assignErr } = await supabase
      .from("job_assignments")
      .select("job_id,sound_role,lights_role,video_role")
      .eq("technician_id", tid)
      .in("job_id", jobIds);

    if (assignErr) {
      return new Response("Failed to load assignment roles", { status: 500 });
    }

    for (const row of (assignmentRows ?? []) as AssignmentRoleRow[]) {
      assignmentRoleMap.set(row.job_id, row);
    }
  }

  const grouped = groupTimesheetAssignments(timesheets);
  const events: Array<{ uid: string; summary: string; description: string; dtStart: Date; dtEnd: Date }> = [];

  for (const block of grouped) {
    const job = jobMap.get(block.job_id);
    if (!job) continue;
    const assignment = assignmentRoleMap.get(block.job_id);
    const role = assignment?.sound_role || assignment?.lights_role || assignment?.video_role || null;
    const roleText = role ? `[${role}] ` : "";

    for (const assignmentDate of block.dates) {
      const window = buildEventWindow(job, assignmentDate);
      if (!window) continue;
      if (window.end < startWindow || window.start > endWindow) continue;

      const summary = `${roleText}${job.title || "Trabajo"} (día ${assignmentDate})`;
      const description = `Job: ${job.id}\nCobertura: ${assignmentDate}\nAsignación: por día`;
      const uid = `${job.id}-${tid}-${assignmentDate}@area-tecnica-ics`;

      events.push({ uid, summary, description, dtStart: window.start, dtEnd: window.end });
    }
  }

  events.sort((a, b) => a.dtStart.getTime() - b.dtStart.getTime());

  const ics = buildCalendar(profile, events);
  const etag = await sha1(ics);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=UTF-8",
      "Cache-Control": "public, max-age=900",
      "ETag": `W/"${etag}"`,
    },
  });
});

function buildCalendar(
  profile: { first_name?: string | null; last_name?: string | null } | null,
  events: Array<{ uid: string; summary: string; description: string; dtStart: Date; dtEnd: Date }>,
) {
  const now = new Date();
  const calName = `Agenda ${((profile?.first_name || "") + " " + (profile?.last_name || "")).trim() || "Técnico"}`.trim();

  const header = lines(
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Area Tecnica//Tech ICS v1//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${escapeICSText(calName)}`,
    `X-WR-CALNAME:${escapeICSText(calName)}`,
    "X-PUBLISHED-TTL:PT15M",
  );

  const evStr = events
    .map((ev) =>
      lines(
        "BEGIN:VEVENT",
        `UID:${ev.uid}`,
        `DTSTAMP:${fmtUTC(now)}`,
        `DTSTART:${fmtUTC(ev.dtStart)}`,
        `DTEND:${fmtUTC(ev.dtEnd)}`,
        `SUMMARY:${escapeICSText(ev.summary)}`,
        `DESCRIPTION:${escapeICSText(ev.description)}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      )
    )
    .join("\r\n");

  const footer = lines("END:VCALENDAR");
  return [header, evStr, footer].filter(Boolean).join("\r\n");
}
