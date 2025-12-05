import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type AssignmentRow = {
  job_id: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  start_time: string | null; // ISO timestamptz
  end_time: string | null;   // ISO timestamptz
  timezone?: string | null;
};

function isUuid(v?: string | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function fmtUTC(dt: Date) {
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const HH = String(dt.getUTCHours()).padStart(2, '0');
  const MM = String(dt.getUTCMinutes()).padStart(2, '0');
  const SS = String(dt.getUTCSeconds()).padStart(2, '0');
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
  // Soft-wrap ICS lines at 75 octets; approximate with 75 chars
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

function sha1(s: string) {
  const enc = new TextEncoder().encode(s);
  const buf = (globalThis as any).crypto?.subtle ? undefined : undefined; // placeholder to keep Deno linter calm
  return crypto.subtle.digest("SHA-1", enc).then((ab) => {
    const arr = new Uint8Array(ab);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}

function replaceIsoDateKeepingTimeAndOffset(iso: string, ymd: string): string {
  // Expect iso like YYYY-MM-DDTHH:MM:SS[.sss][Z|±HH:MM]
  // Replace the YYYY-MM-DD prefix with provided ymd
  if (!iso || iso.length < 10) return iso;
  return `${ymd}${iso.slice(10)}`;
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  if (req.method === 'HEAD') {
    return new Response(null, { status: 204, headers: { 'Content-Type': 'text/calendar; charset=UTF-8', 'Cache-Control': 'public, max-age=900' } });
  }

  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const tid = url.searchParams.get('tid');
  const token = url.searchParams.get('token');
  const daysBack = Math.max(0, Math.min(365, Number(url.searchParams.get('back') || 90)));
  const daysFwd = Math.max(1, Math.min(730, Number(url.searchParams.get('fwd') || 365)));

  if (!isUuid(tid) || !token) {
    return new Response('Invalid parameters', { status: 400 });
  }

  // Validate token against profiles
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, calendar_ics_token')
    .eq('id', tid)
    .maybeSingle();

  if (profErr || !profile || !profile.calendar_ics_token || profile.calendar_ics_token !== token) {
    return new Response('Forbidden', { status: 403 });
  }

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysBack * 24 * 3600 * 1000);
  const endWindow = new Date(now.getTime() + daysFwd * 24 * 3600 * 1000);

  // SIMPLIFIED: After architecture simplification, we query timesheets to get actual work dates
  // Each timesheet represents a day the technician is scheduled to work

  const startDate = startWindow.toISOString().split('T')[0];
  const endDate = endWindow.toISOString().split('T')[0];

  // 1) Fetch ACTIVE timesheets for technician in date window
  // Filter by is_active = true to exclude voided timesheets (day-off/travel dates)
  const { data: timesheets, error: tsErr } = await supabase
    .from('timesheets')
    .select('job_id, date')
    .eq('technician_id', tid)
    .eq('is_active', true)
    .gte('date', startDate)
    .lte('date', endDate);

  if (tsErr) {
    return new Response('Failed to load timesheets', { status: 500 });
  }

  if (!timesheets || timesheets.length === 0) {
    const ics = buildCalendar(profile, []);
    const etag = await sha1(ics);
    return new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar; charset=UTF-8', 'Cache-Control': 'public, max-age=900', 'ETag': `W/"${etag}"` } });
  }

  // Get unique job IDs from timesheets
  const jobIds = Array.from(new Set(timesheets.map(ts => ts.job_id)));

  // 2) Fetch job metadata
  const { data: jobs, error: jErr } = await supabase
    .from('jobs')
    .select('id,title,start_time,end_time,timezone')
    .in('id', jobIds);

  if (jErr) {
    return new Response('Failed to load jobs', { status: 500 });
  }

  const jobMap = new Map<string, JobRow>();
  for (const j of (jobs ?? []) as JobRow[]) jobMap.set(j.id, j);

  // 3) Fetch assignment metadata for roles
  const { data: assigns, error: aErr } = await supabase
    .from('job_assignments')
    .select('job_id,sound_role,lights_role,video_role')
    .eq('technician_id', tid)
    .in('job_id', jobIds);

  const assignMap = new Map<string, AssignmentRow>();
  for (const a of (assigns ?? [])) {
    assignMap.set(a.job_id, a as AssignmentRow);
  }

  // 4) Build events - one per timesheet (per day worked)
  const events: Array<{ uid: string; summary: string; description: string; dtStart: Date; dtEnd: Date } > = [];

  for (const ts of timesheets) {
    const j = jobMap.get(ts.job_id);
    if (!j) continue;

    const a = assignMap.get(ts.job_id);
    const workDate = ts.date; // yyyy-mm-dd

    const baseStartIso = j.start_time ?? '';
    const baseEndIso = j.end_time ?? '';

    let evStart: Date | null = null;
    let evEnd: Date | null = null;

    // Use the work date with job times
    if (baseStartIso && baseEndIso) {
      const sIso = replaceIsoDateKeepingTimeAndOffset(baseStartIso, workDate);
      const eIso = replaceIsoDateKeepingTimeAndOffset(baseEndIso, workDate);
      evStart = new Date(sIso);
      evEnd = new Date(eIso);
      // If end <= start (overnight or invalid), use 2h minimum
      if (!(evEnd.getTime() > evStart.getTime())) {
        evEnd = new Date(evStart.getTime() + 2 * 3600 * 1000);
      }
    } else if (baseStartIso) {
      const sIso = replaceIsoDateKeepingTimeAndOffset(baseStartIso, workDate);
      evStart = new Date(sIso);
      evEnd = new Date(evStart.getTime() + 2 * 3600 * 1000);
    } else {
      // All-day fallback
      evStart = new Date(`${workDate}T00:00:00Z`);
      evEnd = new Date(evStart.getTime() + 24 * 3600 * 1000);
    }

    if (!evStart || !evEnd) continue;

    // Filter by window overlap (should already be filtered by date query, but double-check)
    if (evEnd < startWindow || evStart > endWindow) continue;

    const role = a?.sound_role || a?.lights_role || a?.video_role || null;
    const roleText = role ? `[${role}] ` : '';
    const dayHint = ` (día ${workDate})`;
    const summary = `${roleText}${j.title || 'Trabajo'}${dayHint}`;
    const description = `Job: ${j.id}\nFecha: ${workDate}`;
    const uid = `${j.id}-${tid}-${workDate}@area-tecnica-ics`;

    events.push({ uid, summary, description, dtStart: evStart, dtEnd: evEnd });
  }

  // 5) Render ICS
  const ics = buildCalendar(profile, events);
  const etag = await sha1(ics);
  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=UTF-8',
      'Cache-Control': 'public, max-age=900',
      'ETag': `W/"${etag}"`,
    },
  });
});

function buildCalendar(profile: { first_name?: string | null; last_name?: string | null } | null, events: Array<{ uid: string; summary: string; description: string; dtStart: Date; dtEnd: Date }>) {
  const now = new Date();
  const calName = `Agenda ${((profile?.first_name || '') + ' ' + (profile?.last_name || '')).trim() || 'Técnico'}`.trim();

  const header = lines(
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Area Tecnica//Tech ICS v1//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeICSText(calName)}`,
    `X-WR-CALNAME:${escapeICSText(calName)}`,
    'X-PUBLISHED-TTL:PT15M',
  );

  const evStr = events.map((ev) => lines(
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${fmtUTC(now)}`,
    `DTSTART:${fmtUTC(ev.dtStart)}`,
    `DTEND:${fmtUTC(ev.dtEnd)}`,
    `SUMMARY:${escapeICSText(ev.summary)}`,
    `DESCRIPTION:${escapeICSText(ev.description)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT'
  )).join("\r\n");

  const footer = lines('END:VCALENDAR');
  return [header, evStr, footer].filter(Boolean).join("\r\n");
}
