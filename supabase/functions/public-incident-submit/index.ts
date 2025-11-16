import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ACTIVE_STATUSES = ['Confirmado', 'Tentativa'];

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function getEquipment(client: ReturnType<typeof createClient>, id: string) {
  const { data, error } = await client
    .from('equipment')
    .select('id, name, department, barcode_number, stencil_number')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error('Equipo no encontrado');
  return data;
}

async function getActiveJobs(client: ReturnType<typeof createClient>) {
  const nowIso = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const { data, error } = await client
    .from('jobs')
    .select('id, title, start_time, status')
    .in('status', ACTIVE_STATUSES)
    .gte('start_time', nowIso)
    .order('start_time', { ascending: true })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

async function getJobIfValid(client: ReturnType<typeof createClient>, jobId?: string | null) {
  if (!jobId) return null;
  const { data, error } = await client
    .from('jobs')
    .select('id, title, status, start_time, end_time')
    .eq('id', jobId)
    .maybeSingle();
  if (error || !data) throw new Error('Trabajo inválido');
  if (data.status && !ACTIVE_STATUSES.includes(data.status)) {
    throw new Error('El trabajo ya no está activo');
  }
  return data;
}

async function ensureRateLimit(client: ReturnType<typeof createClient>, equipmentId: string) {
  const sinceIso = new Date(Date.now() - 1000 * 60 * 10).toISOString();
  const { count, error } = await client
    .from('public_incident_reports')
    .select('id', { count: 'exact', head: true })
    .eq('equipment_id', equipmentId)
    .gte('created_at', sinceIso);
  if (error) throw error;
  if ((count ?? 0) > 5) {
    throw new Error('Rate limit exceeded');
  }
}

function decodeBase64Image(dataUri: string) {
  const matches = dataUri.match(/^data:(.*);base64,(.*)$/);
  const mime = matches?.[1] ?? 'image/png';
  const data = matches?.[2] ?? dataUri;
  const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return { buffer, mime };
}

async function uploadPhoto(client: ReturnType<typeof createClient>, equipmentId: string, dataUri?: string | null) {
  if (!dataUri) return null;
  const { buffer, mime } = decodeBase64Image(dataUri);
  const filename = `${equipmentId}/${crypto.randomUUID()}.png`;
  const { error } = await client.storage
    .from('public-incident-photos')
    .upload(filename, buffer, { contentType: mime, upsert: false });
  if (error) throw error;
  return filename;
}

async function broadcastPublicIncident(payload: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Push broadcast error', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action ?? 'submit';
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    if (action === 'prefill') {
      const equipmentId = body?.equipment_id as string | undefined;
      if (!equipmentId) {
        return json({ error: 'equipment_id requerido' }, 400);
      }
      const equipment = await getEquipment(client, equipmentId);
      const active_jobs = await getActiveJobs(client);
      return json({ equipment, active_jobs });
    }

    if (action !== 'submit') {
      return json({ error: 'Acción no soportada' }, 400);
    }

    const equipmentId = body?.equipment_id as string | undefined;
    if (!equipmentId) {
      return json({ error: 'equipment_id requerido' }, 400);
    }

    if (body?.honeypot_value) {
      return json({ success: true });
    }

    await ensureRateLimit(client, equipmentId);
    const equipment = await getEquipment(client, equipmentId);
    const job = await getJobIfValid(client, body?.job_id ?? null);
    const photo_path = await uploadPhoto(client, equipmentId, body?.photo_base64);

    if (!body?.issue_description || !body?.actions_taken || !body?.signature_data || !body?.reporter_name) {
      return json({ error: 'Campos obligatorios faltantes' }, 422);
    }

    const insertPayload = {
      equipment_id: equipment.id,
      equipment_name: equipment.name,
      department: body.department || equipment.department,
      issue_description: body.issue_description,
      actions_taken: body.actions_taken,
      reporter_name: body.reporter_name,
      contact: body.contact,
      barcode_number: body.barcode_number || null,
      stencil_number: body.stencil_number || null,
      signature_data: body.signature_data,
      honeypot_value: body.honeypot_value,
      photo_path,
      job_id: job?.id ?? null,
      job_title_snapshot: job?.title ?? null,
      job_status_snapshot: job?.status ?? null,
      metadata: { source: 'public', job_start: job?.start_time ?? null },
      triage_log: [{ action: 'submitted', at: new Date().toISOString(), reporter: body.reporter_name ?? null }],
      source: 'public'
    };

    const { error: insertError } = await client
      .from('public_incident_reports')
      .insert(insertPayload);

    if (insertError) throw insertError;

    await broadcastPublicIncident({
      action: 'broadcast',
      type: 'incident.report.uploaded',
      subtype: 'incident.report.public',
      actor_name: body.reporter_name || 'Reporte público',
      job_id: job?.id ?? null,
      department: insertPayload.department,
      departments: insertPayload.department ? [insertPayload.department] : undefined,
      equipment_id: equipment.id,
      barcode_number: insertPayload.barcode_number,
      stencil_number: insertPayload.stencil_number,
      message_preview: `${insertPayload.equipment_name}: ${insertPayload.issue_description}`.slice(0, 140)
    });

    return json({ success: true });
  } catch (error) {
    console.error('public-incident-submit error', error);
    return json({ error: (error as Error).message ?? 'Unexpected error' }, 400);
  }
});
