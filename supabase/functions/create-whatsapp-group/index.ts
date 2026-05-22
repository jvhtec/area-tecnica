import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildWahaGroupParticipants,
  phoneToWahaJid,
  resolveFestivalStageTechnicianIds,
} from "./recipientUtils.ts";
import type { Dept } from "./recipientUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface CreateRequest {
  job_id: string;
  department: Dept;
  stage_number?: number | string;
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
    const url = new URL(req.url);
    const finalizeOnly = url.searchParams.get('finalize') === '1';
    const { job_id, department, stage_number } = await req.json() as CreateRequest;
    let parsedStageNumber: number | null = null;
    if (stage_number !== undefined) {
      if (typeof stage_number === 'string') {
        const trimmed = stage_number.trim();
        if (!/^\d+$/.test(trimmed)) {
          return new Response(
            JSON.stringify({ error: 'Invalid stage_number: must be a non-negative integer' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        parsedStageNumber = Number.parseInt(trimmed, 10);
      } else if (typeof stage_number === 'number' && Number.isInteger(stage_number) && stage_number >= 0) {
        parsedStageNumber = stage_number;
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid stage_number: must be a non-negative integer' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
    const stageNumber = parsedStageNumber ?? 0;
    const effectiveStageNumber = department === 'lights' ? 0 : stageNumber;

    if (
      !job_id ||
      !department ||
      !['sound','lights','video'].includes(department)
    ) {
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

    // Fetch actor profile to verify role and capture phone/department/waha_endpoint
    let actor: { id: string; role: string; department: string | null; phone: string | null; waha_endpoint: string | null } | null = null;
    if (actorId) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, role, department, phone, waha_endpoint')
        .eq('id', actorId)
        .maybeSingle();
      if (prof) actor = prof as any;
    }

    if (!actor || !['admin','management'].includes((actor.role || '').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Only users with waha_endpoint can create WhatsApp groups
    if (!actor.waha_endpoint) {
      return new Response(JSON.stringify({ error: 'Forbidden', reason: 'User not authorized for WhatsApp operations' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent duplicates: existing group already persisted
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('job_whatsapp_groups')
      .select('id, wa_group_id')
      .eq('job_id', job_id)
      .eq('department', department)
      .eq('stage_number', effectiveStageNumber)
      .maybeSingle();
    if (existingErr && existingErr.message) {
      console.warn('job_whatsapp_groups lookup error', existingErr);
    }
    const existingWaGroupId = existing?.wa_group_id || null;
    const shouldSyncExistingStageGroup = !!existingWaGroupId && effectiveStageNumber > 0 && !finalizeOnly;
    if (existing && !shouldSyncExistingStageGroup && !finalizeOnly) {
      return new Response(JSON.stringify({ success: true, wa_group_id: existing.wa_group_id, note: 'Group already exists' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent duplicates: has a prior request been made?
    const { data: priorReq } = await supabaseAdmin
      .from('job_whatsapp_group_requests')
      .select('id')
      .eq('job_id', job_id)
      .eq('department', department)
      .eq('stage_number', effectiveStageNumber)
      .maybeSingle();
    if (priorReq && !shouldSyncExistingStageGroup && !finalizeOnly) {
      return new Response(JSON.stringify({ success: true, wa_group_id: null, note: 'Group request already recorded (locked)' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch job details
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('id, title, tour_id')
      .eq('id', job_id)
      .maybeSingle();
    if (!job || jobErr) return new Response(JSON.stringify({ error: 'Job not found', details: jobErr?.message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let stageDisplayName: string | null = null;
    if (effectiveStageNumber > 0) {
      try {
        const { data: stageRow, error: stageErr } = await supabaseAdmin
          .from('festival_stages')
          .select('name')
          .eq('job_id', job_id)
          .eq('number', effectiveStageNumber)
          .maybeSingle();
        if (stageErr) {
          console.warn('festival_stages fetch error', stageErr);
        }
        stageDisplayName = (stageRow?.name || '').trim() || `Stage ${effectiveStageNumber}`;
      } catch (e) {
        console.warn('festival_stages lookup failed', e);
        stageDisplayName = `Stage ${effectiveStageNumber}`;
      }
    }

    const defaultCC = Deno.env.get('WA_DEFAULT_COUNTRY_CODE') || '+34';
    const participants: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];

    const addProfilePhoneRecipient = (
      profile: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null | undefined,
      fallbackName = 'Tecnico',
    ) => {
      const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || fallbackName;
      const rawPhone = (profile?.phone || '').trim();
      if (!rawPhone) {
        missing.push(fullName);
        return false;
      }
      const norm = normalizePhone(rawPhone, defaultCC);
      if (norm.ok) {
        participants.push(norm.value);
        return true;
      }

      invalid.push(`${fullName} (${rawPhone})`);
      return false;
    };

    let scheduledStageParticipantCount = 0;

    if (effectiveStageNumber > 0) {
      let stageRecipients;
      try {
        stageRecipients = await resolveFestivalStageTechnicianIds({
          department,
          jobId: job_id,
          stageNumber: effectiveStageNumber,
          supabase: supabaseAdmin,
        });
      } catch (stageRecipientError) {
        console.warn('festival stage recipient lookup error', stageRecipientError);
        return new Response(JSON.stringify({ error: 'Failed to fetch festival stage schedule', details: String(stageRecipientError) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      for (const externalName of stageRecipients.externalNames) {
        missing.push(`${externalName} (external technician without profile phone)`);
      }

      console.info('Festival stage WhatsApp recipients resolved', {
        assignmentCount: stageRecipients.assignmentCount,
        department,
        externalCount: stageRecipients.externalNames.length,
        job_id,
        shiftCount: stageRecipients.shiftCount,
        stage_number: effectiveStageNumber,
        technicianCount: stageRecipients.technicianIds.length,
      });

      if (stageRecipients.technicianIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No scheduled technicians found for this festival stage', warnings: { missing, invalid } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: scheduledProfiles, error: scheduledProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .in('id', stageRecipients.technicianIds);

      if (scheduledProfilesError) {
        console.warn('profiles fetch error for festival stage recipients', scheduledProfilesError);
        return new Response(JSON.stringify({ error: 'Failed to fetch scheduled technician profiles', details: scheduledProfilesError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const profilesById = new Map((scheduledProfiles ?? []).map((profile: any) => [profile.id, profile]));
      for (const technicianId of stageRecipients.technicianIds) {
        const profile = profilesById.get(technicianId);
        if (addProfilePhoneRecipient(profile, 'Scheduled technician')) {
          scheduledStageParticipantCount++;
        }
      }

      if (scheduledStageParticipantCount === 0) {
        return new Response(JSON.stringify({ error: 'No valid phone numbers found for scheduled technicians on this festival stage', warnings: { missing, invalid } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
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

      const rows = (assigns ?? []).filter((r: any) => {
        if (department === 'sound') return !!r.sound_role;
        if (department === 'lights') return !!r.lights_role;
        if (department === 'video') return !!r.video_role;
        return false;
      });

      for (const r of rows) {
        addProfilePhoneRecipient(r.profiles);
      }
    }

    // Always include management user for the department (if phone exists and matches department)
    if (actor?.phone && actor?.department && actor.department === department) {
      const norm = normalizePhone(actor.phone, defaultCC);
      if (norm.ok) participants.push(norm.value);
    }

    // Buddy system: Javier auto-adds Carlos, Carlos auto-adds Javier (department sound)
    if (department === 'sound') {
      const buddyMap: Record<string, string> = {
        '3f320605-c05c-4dcc-b668-c0e01e2c4af9': '4d1b7ec6-0657-496e-a759-c721916e0c09', // Javier → Carlos
        '4d1b7ec6-0657-496e-a759-c721916e0c09': '3f320605-c05c-4dcc-b668-c0e01e2c4af9', // Carlos → Javier
      };
      const buddyId = buddyMap[actorId!];
      if (buddyId) {
        try {
          const { data: buddy } = await supabaseAdmin
            .from('profiles')
            .select('phone')
            .eq('id', buddyId)
            .maybeSingle();
          if (buddy?.phone) {
            const norm = normalizePhone(buddy.phone, defaultCC);
            if (norm.ok) participants.push(norm.value);
          }
        } catch { /* ignore */ }
      }
    }

    // De-duplicate
    const uniqueParticipants = Array.from(new Set(participants));
    if (uniqueParticipants.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid phone numbers found', warnings: { missing, invalid } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Record request to lock further attempts only after recipient validation succeeds.
    if (!priorReq && !existingWaGroupId) {
      const { error: lockErr } = await supabaseAdmin
        .from('job_whatsapp_group_requests')
        .insert({ job_id, department, stage_number: effectiveStageNumber });
      if (lockErr) {
        const isDuplicateLock = lockErr.code === '23505';
        if (isDuplicateLock && !finalizeOnly) {
          return new Response(JSON.stringify({ success: true, wa_group_id: null, note: 'Group request already recorded (locked)' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Failed to record group request', details: lockErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // WAHA config - use actor's endpoint
    const normalizeBase = (s: string) => {
      let b = (s || '').trim();
      if (!/^https?:\/\//i.test(b)) b = 'https://' + b; // default to https if scheme missing
      return b.replace(/\/+$/, '');
    };
    const base = normalizeBase(actor.waha_endpoint || 'https://waha.sector-pro.work');
    const { data: cfg } = await supabaseAdmin.rpc('get_waha_config', { base_url: base });
    const apiKey = (cfg?.[0] as any)?.api_key || Deno.env.get('WAHA_API_KEY') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const deptNameEs = department === 'sound' ? 'Sonido' : department === 'lights' ? 'Luces' : 'Video';
    const stageSuffix = effectiveStageNumber > 0 ? ` - ${stageDisplayName || `Stage ${effectiveStageNumber}`}` : '';
    const subject = `${job.title} - ${deptNameEs}${stageSuffix}`;

    // WAHA expects JIDs like 34900111222@c.us and an object list
    const session = (cfg?.[0] as any)?.session || Deno.env.get('WAHA_SESSION') || 'default';
    const actorJidCandidate = (() => {
      if (actor?.phone && actor.department === department) {
        const norm = normalizePhone(actor.phone, defaultCC);
        if (norm.ok) return phoneToWahaJid(norm.value);
      }
      return null;
    })();
    const { groupParticipants } = buildWahaGroupParticipants({
      actorJid: actorJidCandidate,
      participants: uniqueParticipants,
    });

    if (groupParticipants.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid non-actor phone numbers found', warnings: { missing, invalid } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let usedFallback = false;
    let fallbackSeedParticipant: { id: string } | null = null;
    let wa_group_id = existingWaGroupId || '';
    let groupText = '';
    if (!finalizeOnly && !existingWaGroupId) {
      // Create the group per WAHA API: POST /api/{session}/groups { name, participants: [{id}] }
      const groupUrl = `${base}/api/${encodeURIComponent(session)}/groups`;
      let groupRes: Response;
      try {
        groupRes = await fetch(groupUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: subject, participants: groupParticipants })
        });
      } catch (fe) {
        return new Response(JSON.stringify({ error: 'WAHA request failed', step: 'create-group', url: groupUrl, message: (fe as Error)?.message || String(fe) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!groupRes.ok) {
        const txt = await groupRes.text().catch(() => '');
        if (groupRes.status >= 500 && groupRes.status < 600 && groupParticipants.length > 1) {
          // Fallback: try real assigned participants one by one when WAHA rejects bulk creation.
          const fallbackErrors: Array<{ id: string; status?: number; body?: string; message?: string }> = [];
          for (const candidate of groupParticipants) {
            const fallbackRes = await fetch(groupUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({ name: subject, participants: [candidate] })
            }).catch((err) => {
              fallbackErrors.push({ id: candidate.id, message: (err as Error)?.message || String(err) });
              return null;
            });

            if (!fallbackRes) {
              continue;
            }

            if (fallbackRes.ok) {
              usedFallback = true;
              fallbackSeedParticipant = candidate;
              groupRes = fallbackRes;
              break;
            }

            const fbTxt = await fallbackRes.text().catch(() => '');
            fallbackErrors.push({ id: candidate.id, status: fallbackRes.status, body: fbTxt });
          }

          if (!usedFallback) {
            return new Response(JSON.stringify({ error: 'WAHA group creation failed', status: groupRes.status, url: groupUrl, response: txt, fallbackAttempts: fallbackErrors, firstAttempt: { status: groupRes.status, body: txt } }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          return new Response(JSON.stringify({ error: 'WAHA group creation failed', status: groupRes.status, url: groupUrl, response: txt }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      // Read body as text first to parse and also return on failure
      groupText = await groupRes.text().catch(() => '');
      let groupJson: any = {};
      try { groupJson = groupText ? JSON.parse(groupText) : {}; } catch (_) { groupJson = {}; }
      // Extract group id from common shapes, or via regex fallback
      // Try headers first if WAHA provides them
      try {
        const headerId = groupRes.headers?.get?.('location') || groupRes.headers?.get?.('Location') || groupRes.headers?.get?.('x-group-id') || groupRes.headers?.get?.('X-Group-Id');
        if (headerId && /@g\.us$/.test(headerId)) wa_group_id = headerId;
      } catch { /* ignore */ }
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
    }
    if (!wa_group_id) {
      // Attempt to resolve the newly created group by subject/name via WAHA listing with retries
      const norm = (s: string) => (s || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      const target = norm(subject);
      for (let attempt = 0; attempt < 6 && !wa_group_id; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
          const listUrl = `${base}/api/${encodeURIComponent(session)}/groups`;
          const listRes = await fetch(listUrl, { method: 'GET', headers });
          if (!listRes.ok) {
            const ltxt = await listRes.text().catch(() => '');
            console.warn('WAHA list groups failed', { status: listRes.status, body: ltxt });
            continue;
          }
          const listTxt = await listRes.text().catch(() => '');
          let listJson: any = [];
          try { listJson = listTxt ? JSON.parse(listTxt) : []; } catch { listJson = []; }
          const candidates = Array.isArray(listJson) ? listJson : (Array.isArray(listJson?.data) ? listJson.data : []);
          if (!Array.isArray(candidates) || !candidates.length) continue;
          const ranked = (candidates || []).map((g: any) => {
            const rawName = g?.name || g?.subject || g?.title || '';
            const n = typeof rawName === 'string' ? norm(rawName) : '';
            const exact = n === target;
            const partial = !exact && !!n && (n.includes(target) || target.includes(n));
            return { g, score: exact ? 2 : partial ? 1 : 0 };
          }).filter((r: any) => r.score > 0)
            .sort((a: any, b: any) => b.score - a.score);
          const picked = ranked.length ? ranked[0].g : null;
          if (picked) {
            if (picked?.gid?._serialized) wa_group_id = String(picked.gid._serialized);
            else if (picked?.gid?.user) wa_group_id = `${picked.gid.user}@g.us`;
            else if (picked?.id && /@g\.us$/.test(picked.id)) wa_group_id = picked.id;
            else if (picked?.groupId && /@g\.us$/.test(picked.groupId)) wa_group_id = picked.groupId;
            else if (picked?.data?.id && /@g\.us$/.test(picked.data.id)) wa_group_id = picked.data.id;
          }
        } catch (e) {
          console.warn('Error attempting to resolve group id via listing:', e);
        }
      }

      if (!wa_group_id) {
        // Treat as success but pending; we already locked via requests table
        return new Response(
          JSON.stringify({ success: true, wa_group_id: null, pending: true, note: 'Group likely created but id not captured; locked to prevent duplicates', raw: groupText || null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Persist
    if (!existingWaGroupId) {
      const { error: insErr } = await supabaseAdmin
        .from('job_whatsapp_groups')
        .insert({ job_id, department, stage_number: effectiveStageNumber, wa_group_id });
      if (insErr) {
        // Best effort to not leave group untracked, still respond with success but include warning
        console.warn('Failed to persist job_whatsapp_groups:', insErr);
      }
    }

    // Turn OFF "admins-only" so all members can send (best effort)
    try {
      const sessionPath = encodeURIComponent(session);
      const settingsUrl = `${base}/api/${sessionPath}/groups/${encodeURIComponent(wa_group_id)}/settings/security/messages-admin-only`;
      const body = JSON.stringify({ adminsOnly: false });
      let settingsRes = await fetch(settingsUrl, { method: 'POST', headers, body });
      if (!settingsRes.ok && (settingsRes.status === 404 || settingsRes.status === 405)) {
        // Some WAHA versions may require PUT
        settingsRes = await fetch(settingsUrl, { method: 'PUT', headers, body });
      }
      if (!settingsRes.ok) {
        const txt = await settingsRes.text().catch(() => '');
        console.warn('⚠️ Failed to update group send settings', {
          status: settingsRes.status,
          url: settingsUrl,
          body: txt
        });
      } else {
        console.log(`✅ Group ${wa_group_id} send-permissions updated (all members can send)`);
      }
    } catch (err) {
      console.warn('⚠️ Error toggling group send permissions:', err);
    }

    const addParticipantsBestEffort = async (participantsToAdd: Array<{ id: string }>, context: string) => {
      if (!participantsToAdd.length) return;
      const addUrl = `${base}/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(wa_group_id)}/participants/add`;

      const tryBulkAdd = async () => {
        const res = await fetch(addUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ participants: participantsToAdd })
        });
        if (!res.ok) {
          const addTxt = await res.text().catch(() => '');
          throw new Error(`add participants failed ${res.status}: ${addTxt}`);
        }
      };

      try {
        await tryBulkAdd();
      } catch (bulkError) {
        console.warn('⚠️ Bulk participant add failed; trying one by one', { context, error: String(bulkError) });
        for (const participant of participantsToAdd) {
          try {
            const res = await fetch(addUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({ participants: [participant] })
            });
            if (!res.ok) {
              const addTxt = await res.text().catch(() => '');
              throw new Error(`add participants failed ${res.status}: ${addTxt}`);
            }
          } catch (singleError) {
            console.warn('⚠️ Could not add participant to group', { context, participant: participant.id, error: String(singleError) });
          }
        }
      }
    };

    // Existing festival stage groups may have been created before stage recipients were enabled.
    if (existingWaGroupId) {
      await addParticipantsBestEffort(groupParticipants, 'existing-stage-group-sync');
    } else if (usedFallback && groupParticipants.length > 1) {
      const first = fallbackSeedParticipant || groupParticipants[0];
      const toAdd = groupParticipants.filter((p) => p.id !== first.id);
      await addParticipantsBestEffort(toAdd, 'fallback-create');
    }

    if (!existingWaGroupId) {
      // Try to set group picture from job or tour logo (best effort)
      try {
        // 1) Festival logo by job
        let logoUrl: string | null = null;
        try {
          const { data: festLogo } = await supabaseAdmin
            .from('festival_logos')
            .select('file_path')
            .eq('job_id', job_id)
            .maybeSingle();
          if (festLogo?.file_path) {
            const { data: pub } = supabaseAdmin.storage
              .from('festival-logos')
              .getPublicUrl(festLogo.file_path);
            if (pub?.publicUrl) logoUrl = pub.publicUrl;
          }
        } catch { /* ignore */ }

        // 2) Fallback to tour logo
        if (!logoUrl && job?.tour_id) {
          try {
            const { data: tourLogo } = await supabaseAdmin
              .from('tour_logos')
              .select('file_path')
              .eq('tour_id', job.tour_id)
              .maybeSingle();
            if (tourLogo?.file_path) {
              const { data: pub } = supabaseAdmin.storage
                .from('tour-logos')
                .getPublicUrl(tourLogo.file_path);
              if (pub?.publicUrl) logoUrl = pub.publicUrl;
            }
          } catch { /* ignore */ }
        }

        if (logoUrl) {
          // Infer mimetype/filename from URL
          const lower = logoUrl.toLowerCase();
          const mimetype = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
          const filename = (() => {
            try { return new URL(logoUrl).pathname.split('/').pop() || 'logo'; } catch { return 'logo'; }
          })();

          const picUrl = `${base}/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(wa_group_id)}/picture`;
          const body = { file: { mimetype, filename, url: logoUrl } } as const;
          const picRes = await fetch(picUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
          if (!picRes.ok) {
            const txt = await picRes.text().catch(() => '');
            console.warn('⚠️ Failed to set group picture', { status: picRes.status, url: picUrl, body: txt });
          } else {
            console.log(`🖼️ Group ${wa_group_id} picture set from ${filename}`);
          }
        } else {
          console.log('No festival/tour logo found for group picture');
        }
      } catch (e) {
        console.warn('⚠️ Error setting group picture:', e);
      }

      // Send welcome message (best effort) using WAHA /api/sendText
      const message = `👋 Bienvenidos al grupo de ${job.title} - ${deptNameEs}${stageSuffix}.\nUsad este chat para la coordinación.`;
      try {
        const msgBody = { chatId: wa_group_id, text: message, session } as const;
        const sendUrl = `${base}/api/sendText`;
        const timeoutMs = Number(Deno.env.get('WAHA_FETCH_TIMEOUT_MS') || 15000);
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(new DOMException('timeout','AbortError')), timeoutMs);
        try {
          const sendRes = await fetch(sendUrl, { method: 'POST', headers, body: JSON.stringify(msgBody), signal: controller.signal });
          if (!sendRes.ok) {
            const errTxt = await sendRes.text().catch(() => '');
            if (sendRes.status === 524) {
              const ray = (errTxt.match(/Cloudflare Ray ID:\s*<strong[^>]*>([^<]+)/i)?.[1]) || null;
              console.warn('WAHA sendText timeout via Cloudflare (524)', { status: sendRes.status, url: sendUrl, rayId: ray });
            } else {
              console.warn('WAHA sendText failed', { status: sendRes.status, url: sendUrl, body: errTxt });
            }
          }
        } finally {
          clearTimeout(to);
        }
      } catch (_) { /* ignore */ }
    }

    const resp: any = {
      success: true,
      wa_group_id,
      stage_number: effectiveStageNumber,
      warnings: { missing, invalid },
      participants: uniqueParticipants
    };
    if (existingWaGroupId) resp.note = 'Grupo ya existia; participantes programados sincronizados.';
    else if (usedFallback) resp.note = 'Grupo creado con 1 participante por fallback; añadiremos el resto en una futura sincronización.';
    return new Response(JSON.stringify(resp), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('create-whatsapp-group error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
