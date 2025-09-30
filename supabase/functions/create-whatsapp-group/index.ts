import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Dept = 'sound' | 'lights' | 'video';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateRequest {
  job_id: string;
  department: Dept;
}

function normalizePhone(raw: string, defaultCountry: string): { ok: true; value: string } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: 'empty' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  // Remove spaces, dashes, parentheses
  let digits = trimmed.replace(/[\s\-()]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (!digits.startsWith('+')) {
    // Heuristic: if appears to be Spanish mobile (9 digits starting with 6/7), prefix +34
    if (/^[67]\d{8}$/.test(digits)) {
      digits = '+34' + digits;
    } else {
      const cc = defaultCountry.startsWith('+') ? defaultCountry : `+${defaultCountry}`;
      digits = cc + digits;
    }
  }
  if (!/^\+\d{7,15}$/.test(digits)) return { ok: false, reason: 'invalid_format' };
  return { ok: true, value: digits };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { job_id, department } = await req.json() as CreateRequest;
    if (!job_id || !department || !['sound','lights','video'].includes(department)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Resolve requesting user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    // A client with anon key to read the actor's profile (using their JWT)
    let actorId: string | null = null;
    try {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      actorId = userData?.user?.id ?? null;
    } catch (authErr) {
      return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Invalid token', details: String(authErr) }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch actor profile to verify role and capture phone/department
    let actor: { id: string; role: string; department: string | null; phone: string | null } | null = null;
    if (actorId) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, role, department, phone')
        .eq('id', actorId)
        .maybeSingle();
      if (prof) actor = prof as any;
    }

    if (!actor || !['admin','management'].includes((actor.role || '').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent duplicates: existing group already persisted
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('job_whatsapp_groups')
      .select('id, wa_group_id')
      .eq('job_id', job_id)
      .eq('department', department)
      .maybeSingle();
    if (existingErr && existingErr.message) {
      console.warn('job_whatsapp_groups lookup error', existingErr);
    }
    if (existing) {
      return new Response(JSON.stringify({ success: true, wa_group_id: existing.wa_group_id, note: 'Group already exists' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent duplicates: has a prior request been made?
    const { data: priorReq } = await supabaseAdmin
      .from('job_whatsapp_group_requests')
      .select('id')
      .eq('job_id', job_id)
      .eq('department', department)
      .maybeSingle();
    if (priorReq) {
      return new Response(JSON.stringify({ success: true, wa_group_id: null, note: 'Group request already recorded (locked)' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Record request to lock further attempts
    const { error: lockErr } = await supabaseAdmin
      .from('job_whatsapp_group_requests')
      .insert({ job_id, department });
    if (lockErr && !(lockErr as any)?.code?.includes?.('23505')) {
      // Not a unique violation; fail explicitly
      return new Response(JSON.stringify({ error: 'Failed to record group request', details: lockErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch job details
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('id, title, start_time, timezone')
      .eq('id', job_id)
      .maybeSingle();
    if (!job || jobErr) return new Response(JSON.stringify({ error: 'Job not found', details: jobErr?.message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Fetch assignments + profiles
    const { data: assigns, error: assignsErr } = await supabaseAdmin
      .from('job_assignments')
      .select(`
        technician_id,
        sound_role, lights_role, video_role,
        profiles!job_assignments_technician_id_fkey ( first_name, last_name, phone )
      `)
      .eq('job_id', job_id);
    if (assignsErr) {
      console.warn('job_assignments fetch error', assignsErr);
    }

    const defaultCC = Deno.env.get('WA_DEFAULT_COUNTRY_CODE') || '+34';
    const participants: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];

    const rows = (assigns ?? []).filter((r: any) => {
      if (department === 'sound') return !!r.sound_role;
      if (department === 'lights') return !!r.lights_role;
      if (department === 'video') return !!r.video_role;
      return false;
    });

    for (const r of rows) {
      const fullName = `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim() || 'Tecnico';
      const rawPhone = (r.profiles?.phone || '').trim();
      if (!rawPhone) {
        missing.push(fullName);
        continue;
      }
      const norm = normalizePhone(rawPhone, defaultCC);
      if (norm.ok) participants.push(norm.value);
      else invalid.push(`${fullName} (${rawPhone})`);
    }

    // Always include management user for the department (if phone exists and matches department)
    if (actor?.phone && actor?.department && actor.department === department) {
      const norm = normalizePhone(actor.phone, defaultCC);
      if (norm.ok) participants.push(norm.value);
    }

    // De-duplicate
    const uniqueParticipants = Array.from(new Set(participants));
    if (uniqueParticipants.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid phone numbers found', warnings: { missing, invalid } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // WAHA config
    const normalizeBase = (s: string) => {
      let b = (s || '').trim();
      if (!/^https?:\/\//i.test(b)) b = 'https://' + b; // default to https if scheme missing
      return b.replace(/\/+$/, '');
    };
    const base = normalizeBase(Deno.env.get('WAHA_BASE_URL') || 'https://waha.sector-pro.work');
    const apiKey = Deno.env.get('WAHA_API_KEY') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const deptNameEs = department === 'sound' ? 'Sonido' : department === 'lights' ? 'Luces' : 'Video';
    const subject = `${job.title} - ${deptNameEs}`;

    // WAHA expects JIDs like 34900111222@c.us and an object list
    const session = Deno.env.get('WAHA_SESSION') || 'default';
    const participantObjects = uniqueParticipants.map((p) => {
      const jid = p.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';
      return { id: jid };
    });
    const actorJidCandidate = (() => {
      if (actor?.phone && actor.department === department) {
        const norm = normalizePhone(actor.phone, defaultCC);
        if (norm.ok) return norm.value.replace(/^\+/, '') + '@c.us';
      }
      return null;
    })();

    // Create the group per WAHA API: POST /api/{session}/groups { name, participants: [{id}] }
    const groupUrl = `${base}/api/${encodeURIComponent(session)}/groups`;
    let usedFallback = false;
    let groupRes: Response;
    try {
      groupRes = await fetch(groupUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: subject, participants: participantObjects })
      });
    } catch (fe) {
      return new Response(JSON.stringify({ error: 'WAHA request failed', step: 'create-group', url: groupUrl, message: (fe as Error)?.message || String(fe) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!groupRes.ok) {
      const txt = await groupRes.text().catch(() => '');
      if (groupRes.status === 500 && participantObjects.length > 1) {
        // Fallback: try create group with a single participant (WAHA bug workaround)
        const first = actorJidCandidate ? { id: actorJidCandidate } : participantObjects[0];
        try {
          const fallbackRes = await fetch(groupUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: subject, participants: [first] })
          });
          if (!fallbackRes.ok) {
            const fbTxt = await fallbackRes.text().catch(() => '');
            return new Response(JSON.stringify({ error: 'WAHA group creation failed', status: fallbackRes.status, url: groupUrl, response: fbTxt, firstAttempt: { status: groupRes.status, body: txt } }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          usedFallback = true;
          groupRes = fallbackRes;
        } catch (fe2) {
          return new Response(JSON.stringify({ error: 'WAHA request failed', step: 'create-group-fallback', url: groupUrl, message: (fe2 as Error)?.message || String(fe2), firstAttempt: { status: groupRes.status, body: txt } }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ error: 'WAHA group creation failed', status: groupRes.status, url: groupUrl, response: txt }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    // Read body as text first to parse and also return on failure
    const groupText = await groupRes.text().catch(() => '');
    let groupJson: any = {};
    try { groupJson = groupText ? JSON.parse(groupText) : {}; } catch (_) { groupJson = {}; }
    // Extract group id from common shapes, or via regex fallback
    let wa_group_id = '';
    if (groupJson?.gid?._serialized) wa_group_id = String(groupJson.gid._serialized);
    else if (groupJson?.gid?.user) wa_group_id = `${groupJson.gid.user}@g.us`;
    else if (groupJson?.gid && typeof groupJson.gid === 'string' && /@g\.us$/.test(groupJson.gid)) wa_group_id = groupJson.gid;
    else if (groupJson?.id && /@g\.us$/.test(groupJson.id)) wa_group_id = groupJson.id;
    else if (groupJson?.groupId && /@g\.us$/.test(groupJson.groupId)) wa_group_id = groupJson.groupId;
    else if (groupJson?.data?.id && /@g\.us$/.test(groupJson.data.id)) wa_group_id = groupJson.data.id;
    else {
      const m = groupText.match(/\b(\d{12,})@g\.us\b/);
      if (m) wa_group_id = m[0];
    }
    if (!wa_group_id) {
      // Treat as success but pending; we already locked via requests table
      return new Response(JSON.stringify({ success: true, wa_group_id: null, pending: true, note: 'Group likely created but id not captured; locked to prevent duplicates', raw: groupText || groupJson }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Persist
    const { error: insErr } = await supabaseAdmin
      .from('job_whatsapp_groups')
      .insert({ job_id, department, wa_group_id });
    if (insErr) {
      // Best effort to not leave group untracked, still respond with success but include warning
      console.warn('Failed to persist job_whatsapp_groups:', insErr);
    }

    // Send welcome message (best effort) using WAHA /api/sendText
    const startStr = (() => {
      try {
        const dt = job.start_time ? new Date(job.start_time) : null;
        if (!dt) return '';
        return `\nFecha: ${dt.toLocaleDateString('es-ES')} ${dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
      } catch { return ''; }
    })();

    const message = `👋 Bienvenidos al grupo de ${job.title} - ${deptNameEs}.\nUsad este chat para la coordinación.${startStr}`;
    try {
      const msgBody = { chatId: wa_group_id, text: message, session } as const;
      const sendUrl = `${base}/api/sendText`;
      const sendRes = await fetch(sendUrl, { method: 'POST', headers, body: JSON.stringify(msgBody) });
      if (!sendRes.ok) {
        const errTxt = await sendRes.text().catch(() => '');
        console.warn('WAHA sendText failed', { status: sendRes.status, url: sendUrl, body: errTxt });
      }
    } catch (_) { /* ignore */ }

    const resp: any = { success: true, wa_group_id, warnings: { missing, invalid }, participants: uniqueParticipants };
    if (usedFallback) resp.note = 'Grupo creado con 1 participante por fallback; añadiremos el resto en una futura sincronización.';
    return new Response(JSON.stringify(resp), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('create-whatsapp-group error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
