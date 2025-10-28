import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Action = "subscribe" | "unsubscribe" | "test" | "broadcast";

type SubscribeBody = {
  action: "subscribe";
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };
};

type UnsubscribeBody = {
  action: "unsubscribe";
  endpoint: string;
};

type TestBody = {
  action: "test";
  url?: string;
};

type BroadcastBody = {
  action: "broadcast";
  type: string; // e.g., 'job.created', 'job.updated', 'document.uploaded', 'document.tech_visible.enabled', 'staffing.availability.sent', etc.
  job_id?: string;
  url?: string;
  // Optional targeting hints
  recipient_id?: string; // direct user to notify (e.g., technician)
  user_ids?: string[]; // explicit recipients
  // Optional meta for message composition
  doc_id?: string;
  file_name?: string;
  event_id?: string;
  event_type?: string;
  event_date?: string;
  event_time?: string;
  transport_type?: string;
  loading_bay?: string | null;
  title?: string | null;
  departments?: string[];
  auto_created_unload?: boolean;
  paired_event_type?: string;
  paired_event_date?: string;
  paired_event_time?: string;
  // SoundVision events should include either venue_name or enough identifiers to resolve it server-side
  file_id?: string;
  venue_id?: string;
  venue_name?: string;
  actor_name?: string;
  actor_id?: string;
  recipient_name?: string;
  channel?: 'email' | 'whatsapp';
  status?: string; // confirmed | cancelled | declined
  changes?: Record<string, { from?: unknown; to?: unknown } | unknown> | Record<string, unknown>;
  message_preview?: string;
  message_id?: string;
  // Tour/Tourdate optional hints
  tour_id?: string;
  tour_date_id?: string;
  tour_name?: string;
  dates_count?: number;
};

type RequestBody = SubscribeBody | UnsubscribeBody | TestBody | BroadcastBody;

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  type?: string;
  meta?: Record<string, unknown>;
};

type PushSendResult =
  | { ok: true }
  | { ok: false; skipped: true }
  | { ok: false; status: number };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const CONTACT_EMAIL = Deno.env.get("PUSH_CONTACT_EMAIL") ?? "mailto:dev@sectorpro.com";

console.log('🔐 VAPID keys loaded:', {
  publicKeyPresent: !!VAPID_PUBLIC_KEY,
  privateKeyPresent: !!VAPID_PRIVATE_KEY,
  publicKeyLength: VAPID_PUBLIC_KEY?.length || 0,
  privateKeyLength: VAPID_PRIVATE_KEY?.length || 0
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('✅ VAPID details configured for webpush');
} else {
  console.error('❌ Missing VAPID keys - push notifications will be skipped');
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function ensureAuthHeader(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return header.replace("Bearer ", "").trim();
}

async function resolveCaller(
  client: ReturnType<typeof createClient>,
  token: string,
  allowService = false,
): Promise<{ userId: string; isService: boolean }> {
  // Try user token
  const { data, error } = await client.auth.getUser(token);
  if (!error && data?.user?.id) {
    return { userId: data.user.id, isService: false };
  }
  // Allow service key / internal token for server-initiated broadcasts
  const internal = Deno.env.get('PUSH_INTERNAL_TOKEN') || '';
  if (allowService && (token === SERVICE_ROLE_KEY || (internal && token === internal))) {
    return { userId: '00000000-0000-0000-0000-000000000000', isService: true };
  }
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function sendPushNotification(
  client: ReturnType<typeof createClient>,
  subscription: PushSubscriptionRow,
  payload: PushPayload,
) : Promise<PushSendResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('⚠️ Skipping push - VAPID keys not configured');
    return { ok: false, skipped: true };
  }

  if (!subscription.p256dh || !subscription.auth) {
    console.warn("⚠️ Push missing keys for endpoint", subscription.endpoint);
    return { ok: false, skipped: true };
  }

  console.log('📤 Sending push notification:', {
    endpoint: subscription.endpoint.substring(0, 50) + '...',
    title: payload.title,
    hasBody: !!payload.body
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        TTL: 3600, // allow up to 1 hour for devices to come online
        urgency: 'high',
      },
    );

    console.log('✅ Push notification sent successfully');
    return { ok: true };
  } catch (err) {
    const status = (err as any)?.statusCode ?? (err as any)?.status ?? 500;
    console.error('❌ Push send error:', {
      status,
      message: (err as any)?.message,
      body: (err as any)?.body,
      error: err
    });

    if (status === 404 || status === 410) {
      console.log('🗑️ Cleaning up expired subscription');
      await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    }

    return { ok: false, status };
  }
}

async function getManagementUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .in('role', ['admin','management','logistics']);
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

async function getSoundDepartmentUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('department', 'sound');
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

async function getManagementOnlyUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'management');
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

async function getLogisticsManagementRecipients(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'management')
    .in('department', ['logistics', 'production']);
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

async function getJobParticipantUserIds(client: ReturnType<typeof createClient>, jobId: string): Promise<string[]> {
  if (!jobId) return [];
  const { data, error } = await client
    .from('job_assignments')
    .select('technician_id')
    .eq('job_id', jobId);
  if (error || !data) return [];
  const ids = data.map((r: any) => r.technician_id).filter(Boolean);
  return Array.from(new Set(ids));
}

async function getJobTitle(client: ReturnType<typeof createClient>, jobId?: string): Promise<string | null> {
  if (!jobId) return null;
  const { data } = await client.from('jobs').select('title').eq('id', jobId).maybeSingle();
  return data?.title ?? null;
}

async function getTourName(client: ReturnType<typeof createClient>, tourId?: string): Promise<string | null> {
  if (!tourId) return null;
  const { data } = await client.from('tours').select('name').eq('id', tourId).maybeSingle();
  return data?.name ?? null;
}

async function getProfileDisplayName(client: ReturnType<typeof createClient>, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await client
    .from('profiles')
    .select('first_name,last_name,nickname,email')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  const full = `${data.first_name || ''} ${data.last_name || ''}`.trim();
  if (full) return full;
  if (data.nickname) return data.nickname;
  return data.email || null;
}

async function resolveSoundVisionVenueName(
  client: ReturnType<typeof createClient>,
  body: BroadcastBody,
): Promise<string | null> {
  if (body.venue_name) return body.venue_name;

  try {
    if (body.venue_id) {
      const { data } = await client.from('venues').select('name').eq('id', body.venue_id).maybeSingle();
      if (data?.name) {
        return data.name as string;
      }
    }

    if (body.file_id) {
      const { data } = await client
        .from('soundvision_files')
        .select('venue:venues(name)')
        .eq('id', body.file_id)
        .maybeSingle();
      const venueName = (data as any)?.venue?.name as string | undefined;
      if (venueName) {
        return venueName;
      }
    }
  } catch (_) {
    // Ignore lookup failures and fall through to null default
  }

  return null;
}

function fmtFieldEs(field: string): string {
  switch (field) {
    case 'title': return 'Título';
    case 'description': return 'Descripción';
    case 'status': return 'Estado';
    case 'due_at': return 'Fecha límite';
    case 'priority': return 'Prioridad';
    case 'requirements': return 'Requerimientos';
    case 'notes': return 'Notas';
    case 'details': return 'Detalles';
    case 'progress': return 'Progreso';
    case 'start_time': return 'Inicio';
    case 'end_time': return 'Fin';
    case 'start_date': return 'Inicio';
    case 'end_date': return 'Fin';
    case 'timezone': return 'Zona horaria';
    case 'job_type': return 'Tipo';
    case 'location_id': return 'Ubicación';
    case 'tour_date_type': return 'Tipo de fecha';
    case 'color': return 'Color';
    case 'event_date': return 'Fecha';
    case 'event_time': return 'Hora';
    case 'event_type': return 'Tipo de evento';
    case 'transport_type': return 'Transporte';
    case 'loading_bay': return 'Muelle';
    case 'departments': return 'Departamentos';
    case 'license_plate': return 'Matrícula';
    default: return field;
  }
}

function channelEs(ch?: string): string {
  if (!ch) return '';
  return ch === 'whatsapp' ? 'WhatsApp' : 'correo';
}

function normalizeTaskChangeValue(field: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (field === 'due_at' || field.endsWith('_at') || field.endsWith('_date')) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTaskChangeValue('', item));
  }

  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  return value;
}

function formatTaskChangeValue(field: string, value: unknown): string {
  if (value === undefined) return 'sin definir';
  if (value === null) return 'sin definir';

  if (field === 'due_at' || field.endsWith('_date')) {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(parsed);
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatTaskChangeValue('', item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function summarizeTaskChanges(changes: BroadcastBody['changes']): string {
  if (!changes || typeof changes !== 'object') {
    return '';
  }

  const entries: Array<{ field: string; from?: unknown; to?: unknown; hasFrom: boolean; hasTo: boolean }> = [];
  for (const [field, raw] of Object.entries(changes as Record<string, any>)) {
    if (field === 'updated_at' || field === 'updatedAt') continue;
    if (raw && typeof raw === 'object' && ('from' in raw || 'to' in raw)) {
      const from = (raw as any).from;
      const to = (raw as any).to;
      entries.push({
        field,
        from: normalizeTaskChangeValue(field, from),
        to: normalizeTaskChangeValue(field, to),
        hasFrom: Object.prototype.hasOwnProperty.call(raw, 'from'),
        hasTo: Object.prototype.hasOwnProperty.call(raw, 'to'),
      });
    } else {
      entries.push({
        field,
        from: undefined,
        to: normalizeTaskChangeValue(field, raw),
        hasFrom: false,
        hasTo: true,
      });
    }
  }

  const parts = entries
    .map(({ field, from, to, hasFrom, hasTo }) => {
      const label = fmtFieldEs(field) || field;
      const fromText = formatTaskChangeValue(field, from);
      const toText = formatTaskChangeValue(field, to);

      if (hasFrom && hasTo) {
        if (fromText === toText) return '';
        return `${label}: ${fromText} → ${toText}`;
      }

      if (hasTo) {
        return `${label}: ${toText}`;
      }

      if (hasFrom) {
        return `${label}: ${fromText}`;
      }

      return '';
    })
    .filter((part) => part);

  return parts.join('; ');
}

async function handleBroadcast(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: BroadcastBody,
) {
  const type = body.type || '';
  // Resolve job id if missing and doc_id provided
  let jobId = body.job_id;
  if (!jobId && body.doc_id) {
    try {
      const { data } = await client.from('job_documents').select('job_id').eq('id', body.doc_id).maybeSingle();
      if (data?.job_id) jobId = data.job_id;
    } catch (_) { /* ignore */ }
  }
  const jobTitle = await getJobTitle(client, jobId);
  const tourId = body.tour_id;
  const tourName = body.tour_name || (await getTourName(client, tourId)) || null;

  // Determine recipients
  const recipients = new Set<string>();
  const management = new Set(await getManagementUserIds(client));
  const soundDept = new Set(await getSoundDepartmentUserIds(client));
  // Management audience should not include department-specific users by default
  const mgmt = new Set<string>(management);
  const participants = new Set(await getJobParticipantUserIds(client, jobId || ''));

  const addUsers = (ids: (string | null | undefined)[]) => {
    for (const id of ids) { if (id) recipients.add(id); }
  };

  // Prefer explicit recipients if provided
  if (Array.isArray((body as any).user_ids) && (body as any).user_ids.length) {
    addUsers(((body as any).user_ids as string[]));
  }

  // Always include the actor so they receive pushes across their own devices
  addUsers([userId]);

  // Compose Spanish title/body and choose default audience
  let title = '';
  let text = '';
  let url = body.url || (jobId ? `/jobs/${jobId}` : tourId ? `/tours/${tourId}` : '/');

  const actor = body.actor_name || (await getProfileDisplayName(client, userId)) || 'Alguien';
  const recipName = body.recipient_name || (await getProfileDisplayName(client, body.recipient_id)) || '';
  const ch = channelEs(body.channel);
  const metaExtras: { view?: string; department?: string; targetUrl?: string; targetDate?: string; singleDay?: boolean } = {};
  let changeSummary: string | undefined;

  const rawTargetDate = typeof (body as any)?.target_date === 'string' ? (body as any).target_date as string : undefined;
  const parsedTargetDate = rawTargetDate ? new Date(rawTargetDate) : null;
  const normalizedTargetDate = parsedTargetDate && !Number.isNaN(parsedTargetDate.getTime())
    ? parsedTargetDate.toISOString().split('T')[0]
    : null;
  const formattedTargetDate = normalizedTargetDate
    ? (() => {
        try {
          return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${normalizedTargetDate}T00:00:00Z`));
        } catch (_) {
          return normalizedTargetDate;
        }
      })()
    : null;
  const singleDayFlag = Boolean((body as any)?.single_day);

  if (type === 'job.created') {
    title = 'Trabajo creado';
    text = `${actor} creó "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
  } else if (type === 'job.updated') {
    title = 'Trabajo actualizado';
    if (body.changes && typeof body.changes === 'object') {
      const keys = Object.keys(body.changes as any);
      const labels = keys.slice(0, 4).map(fmtFieldEs); // summarize first few
      text = `${actor} actualizó "${jobTitle || 'Trabajo'}". Cambios: ${labels.join(', ')}.`;
    } else {
      text = `${actor} actualizó "${jobTitle || 'Trabajo'}".`;
    }
    addUsers(Array.from(mgmt));
    addUsers(Array.from(participants));
  } else if (type === 'document.uploaded') {
    title = 'Nuevo documento';
    const fname = body.file_name || 'documento';
    text = `${actor} subió "${fname}" a "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
    addUsers(Array.from(participants));
  } else if (type === 'document.deleted') {
    title = 'Documento eliminado';
    const fname = body.file_name || 'documento';
    text = `${actor} eliminó "${fname}" de "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
    addUsers(Array.from(participants));
  } else if (type === 'document.tech_visible.enabled') {
    title = 'Documento disponible para técnicos';
    const fname = body.file_name || 'documento';
    text = `Nuevo documento visible: "${fname}" en "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(participants));
  } else if (type === 'document.tech_visible.disabled') {
    title = 'Documento oculto para técnicos';
    const fname = body.file_name || 'documento';
    text = `El documento "${fname}" dejó de estar visible en "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(participants));
  } else if (type === 'staffing.availability.sent') {
    title = 'Solicitud de disponibilidad enviada';
    text = `${actor} envió solicitud a ${recipName || 'técnico'} (${ch}).`;
    addUsers(Array.from(mgmt));
    addUsers([body.recipient_id]);
  } else if (type === 'staffing.offer.sent') {
    title = 'Oferta enviada';
    text = `${actor} envió oferta a ${recipName || 'técnico'} (${ch}).`;
    addUsers(Array.from(mgmt));
    addUsers([body.recipient_id]);
  } else if (type === 'staffing.availability.confirmed') {
    title = 'Disponibilidad confirmada';
    text = `${recipName || 'Técnico'} confirmó disponibilidad para "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
  } else if (type === 'staffing.availability.declined') {
    title = 'Disponibilidad rechazada';
    text = `${recipName || 'Técnico'} rechazó disponibilidad para "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
  } else if (type === 'staffing.offer.confirmed') {
    title = 'Oferta aceptada';
    text = `${recipName || 'Técnico'} aceptó oferta para "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
    // No need to notify all participants here; keep it to management
  } else if (type === 'staffing.offer.declined') {
    title = 'Oferta rechazada';
    text = `${recipName || 'Técnico'} rechazó oferta para "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
  } else if (type === 'staffing.availability.cancelled') {
    title = 'Disponibilidad cancelada';
    text = `Solicitud de disponibilidad cancelada para "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
    addUsers([body.recipient_id]);
  } else if (type === 'staffing.offer.cancelled') {
    title = 'Oferta cancelada';
    text = `Oferta cancelada para "${jobTitle || 'Trabajo'}".`;
    addUsers(Array.from(mgmt));
    addUsers([body.recipient_id]);
  } else if (type === 'job.status.confirmed') {
    title = 'Trabajo confirmado';
    text = `"${jobTitle || 'Trabajo'}" ha sido confirmado.`;
    addUsers(Array.from(mgmt));
    addUsers(Array.from(participants));
  } else if (type === 'job.status.cancelled') {
    title = 'Trabajo cancelado';
    text = `"${jobTitle || 'Trabajo'}" ha sido cancelado.`;
    addUsers(Array.from(mgmt));
    addUsers(Array.from(participants));
  } else if (type === 'job.assignment.confirmed') {
    title = 'Asignación confirmada';
    if (singleDayFlag && formattedTargetDate) {
      if (recipName) {
        text = `${recipName}, has sido asignado a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`;
      } else {
        text = `Has sido asignado a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`;
      }
      if (normalizedTargetDate) {
        metaExtras.singleDay = true;
        metaExtras.targetDate = normalizedTargetDate;
      }
    } else {
      if (recipName) {
        text = `${recipName}, has sido asignado a "${jobTitle || 'Trabajo'}".`;
      } else {
        text = `Has sido asignado a "${jobTitle || 'Trabajo'}".`;
      }
      if (singleDayFlag && normalizedTargetDate) {
        metaExtras.singleDay = true;
        metaExtras.targetDate = normalizedTargetDate;
      }
    }
    addUsers([body.recipient_id]);
  } else if (type === 'task.assigned') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const jobLabel = jobId ? (jobTitle || 'Trabajo') : (tourName || 'Tour');
    title = 'Tarea asignada';
    text = recipName
      ? `${actor} asignó ${taskLabel} a ${recipName} en "${jobLabel}".`
      : `${actor} asignó ${taskLabel} en "${jobLabel}".`;
    url = body.url || (jobId ? `/job-management/${jobId}` : tourId ? `/tours/${tourId}` : url);
    addUsers([body.recipient_id]);
  } else if (type === 'task.updated') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const jobLabel = jobId ? (jobTitle || 'Trabajo') : (tourName || 'Tour');
    title = 'Tarea actualizada';
    changeSummary = summarizeTaskChanges(body.changes);
    text = changeSummary
      ? `${actor} actualizó ${taskLabel} en "${jobLabel}". Cambios: ${changeSummary}.`
      : `${actor} actualizó ${taskLabel} en "${jobLabel}".`;
    url = body.url || (jobId ? `/job-management/${jobId}` : tourId ? `/tours/${tourId}` : url);
    recipients.clear();
    addUsers([body.recipient_id]);
  } else if (type === 'task.completed') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const jobLabel = jobId ? (jobTitle || 'Trabajo') : (tourName || 'Tour');
    title = 'Tarea completada';
    text = recipName
      ? `${actor} marcó como completada ${taskLabel} de ${recipName} en "${jobLabel}".`
      : `${actor} marcó como completada ${taskLabel} en "${jobLabel}".`;
    url = body.url || (jobId ? `/job-management/${jobId}` : tourId ? `/tours/${tourId}` : url);
    addUsers([body.recipient_id]);
  } else if (type === 'logistics.transport.requested') {
    const department = (body as any)?.department as string | undefined;
    const departmentLabel = department ? department.charAt(0).toUpperCase() + department.slice(1) : undefined;
    title = 'Transporte solicitado';
    const context = jobTitle ? ` en "${jobTitle}"` : '';
    if (departmentLabel) {
      text = `${actor} solicitó transporte para ${departmentLabel}${context}.`;
    } else {
      text = `${actor} solicitó transporte${context}.`;
    }
    const logisticsUrl = jobId ? `/jobs/${jobId}` : '/logistics';
    url = body.url || logisticsUrl;
    recipients.clear();
    const logisticsRecipients = await getLogisticsManagementRecipients(client);
    addUsers(logisticsRecipients);
    metaExtras.view = 'logistics';
    metaExtras.department = department;
    metaExtras.targetUrl = logisticsUrl;
  } else if (
    type === 'logistics.event.created'
    || type === 'logistics.event.updated'
    || type === 'logistics.event.cancelled'
  ) {
    const eventType = (body as any)?.event_type as string | undefined;
    const eventDate = (body as any)?.event_date as string | undefined;
    const eventTime = (body as any)?.event_time as string | undefined;
    const transportType = (body as any)?.transport_type as string | undefined;
    const eventTitle = jobTitle || (body as any)?.title || 'Evento logístico';
    const autoCreated = Boolean((body as any)?.auto_created_unload);
    const pairedType = (body as any)?.paired_event_type as string | undefined;
    const pairedDate = (body as any)?.paired_event_date as string | undefined;
    const pairedTime = (body as any)?.paired_event_time as string | undefined;
    const departmentsList = Array.isArray((body as any)?.departments)
      ? ((body as any)?.departments as string[])
      : [];
    const rawChanges = (body as any)?.changes;
    const changeFields = Array.isArray(rawChanges)
      ? (rawChanges as string[])
      : (rawChanges && typeof rawChanges === 'object'
        ? Object.keys(rawChanges as Record<string, unknown>)
        : []);

    recipients.clear();
    const managementOnly = await getManagementOnlyUserIds(client);
    addUsers(managementOnly);

    const logisticsUrl = body.url || (jobId ? `/jobs/${jobId}` : '/logistics/calendar');
    url = logisticsUrl;
    metaExtras.view = 'logistics-calendar';
    metaExtras.targetUrl = logisticsUrl;
    metaExtras.department = 'logistics';

    const eventLabel = eventType === 'unload' ? 'Descarga' : 'Carga';
    const pairedLabel = pairedType === 'unload' ? 'descarga' : pairedType === 'load' ? 'carga' : undefined;

    let whenLabel = '';
    if (eventDate || eventTime) {
      const isoDate = eventDate && eventTime ? `${eventDate}T${eventTime}` : eventDate ? `${eventDate}T00:00:00` : undefined;
      if (isoDate) {
        try {
          const formatted = new Intl.DateTimeFormat('es-ES', {
            dateStyle: 'medium',
            timeStyle: eventTime ? 'short' : undefined,
          }).format(new Date(isoDate));
          whenLabel = formatted;
        } catch (_) {
          whenLabel = `${eventDate ?? ''} ${eventTime ?? ''}`.trim();
        }
      } else {
        whenLabel = `${eventDate ?? ''} ${eventTime ?? ''}`.trim();
      }
    }

    const transportLabel = transportType ? transportType.charAt(0).toUpperCase() + transportType.slice(1) : undefined;
    const deptText = departmentsList.length ? ` (${departmentsList.join(', ')})` : '';

    if (type === 'logistics.event.cancelled') {
      title = `${eventLabel} cancelada`;
      text = `Se canceló la ${eventLabel.toLowerCase()} de "${eventTitle}"${whenLabel ? ` (${whenLabel})` : ''}.`;
    } else if (type === 'logistics.event.updated') {
      title = `${eventLabel} actualizada`;
      text = `Se actualizó la ${eventLabel.toLowerCase()} de "${eventTitle}"${whenLabel ? ` (${whenLabel})` : ''}.`;
      if (changeFields.length) {
        const changeLabels = changeFields.map(fmtFieldEs);
        text += ` Cambios: ${changeLabels.join(', ')}.`;
      }
    } else {
      title = `${eventLabel} programada`;
      if (autoCreated) {
        text = `Se creó automáticamente una ${eventLabel.toLowerCase()} para "${eventTitle}"${whenLabel ? ` (${whenLabel})` : ''}.`;
      } else {
        text = `${eventLabel} para "${eventTitle}" programada${whenLabel ? ` (${whenLabel})` : ''}.`;
      }
    }

    if (transportLabel) {
      text += ` Transporte: ${transportLabel}.`;
    }

    if (type === 'logistics.event.created' && pairedLabel) {
      const pairedWhen = pairedDate || pairedTime ? `${pairedDate ?? ''} ${pairedTime ?? ''}`.trim() : '';
      text += autoCreated
        ? ` Vinculada a la ${pairedLabel} existente${pairedWhen ? ` (${pairedWhen})` : ''}.`
        : ` También se programó ${pairedLabel}${pairedWhen ? ` (${pairedWhen})` : ''}.`;
    }

    if (deptText) {
      text += deptText;
    }
  } else if (type === 'flex.folders.created') {
    title = 'Carpetas Flex creadas';
    text = jobTitle
      ? `Se han creado las carpetas de Flex para "${jobTitle}".`
      : 'Se han creado carpetas de Flex.';
    addUsers(Array.from(mgmt));
    addUsers(Array.from(participants));
  } else if (type === 'flex.tourdate_folder.created') {
    title = 'Carpeta de fecha creada';
    const tn = body.tour_name || '';
    const count = (body as any).dates_count as number | undefined;
    if (tn && count && count > 1) {
      text = `Se han creado ${count} carpetas de fecha para "${tn}".`;
    } else if (tn) {
      text = `Se ha creado carpeta de fecha para "${tn}".`;
    } else if (count && count > 1) {
      text = `Se han creado ${count} carpetas de fecha.`;
    } else {
      text = 'Se ha creado carpeta de fecha.';
    }
    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addUsers(Array.from(mgmt));
  } else if (type === 'message.received') {
    title = 'Nuevo mensaje';
    const preview = body.message_preview || '';
    text = `${actor}: ${preview}`;
    url = body.url || '/messages';
    // Only notify the recipient, not the sender
    recipients.clear();
    addUsers([body.recipient_id]);
  } else if (type === 'tourdate.created') {
    title = 'Fecha de tour creada';
    const tn = body.tour_name || '';
    text = tn ? `${actor} creó una fecha en "${tn}".` : `${actor} creó una nueva fecha de tour.`;
    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addUsers(Array.from(mgmt));
  } else if (type === 'tourdate.updated') {
    title = 'Fecha de tour actualizada';
    if (body.changes && typeof body.changes === 'object') {
      const keys = Object.keys(body.changes as any);
      const labels = keys.slice(0, 4).map(fmtFieldEs);
      text = `${actor} actualizó una fecha de tour. Cambios: ${labels.join(', ')}.`;
    } else {
      text = `${actor} actualizó una fecha de tour.`;
    }
    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addUsers(Array.from(mgmt));
  } else if (type === 'tourdate.deleted') {
    title = 'Fecha de tour eliminada';
    const tn = body.tour_name || '';
    text = tn ? `${actor} eliminó una fecha de "${tn}".` : `${actor} eliminó una fecha de tour.`;
    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addUsers(Array.from(mgmt));
  } else if (type === 'soundvision.file.uploaded' || type === 'soundvision.file.downloaded') {
    // SoundVision payloads should provide venue_name, or file_id/venue_id for lookup so we can compose contextual notifications.
    const venueName = (await resolveSoundVisionVenueName(client, body)) || 'desconocido';
    const action = type === 'soundvision.file.uploaded' ? 'subido' : 'descargado';
    title = type === 'soundvision.file.uploaded' ? 'Archivo SoundVision subido' : 'Archivo SoundVision descargado';
    text = `${actor} ha ${action} un archivo SoundVision ${venueName} a la base de datos.`;
    url = body.url || '/soundvision-files';
    // Notify only users who are both management and in the sound department
    const soundManagement = Array.from(management).filter((id) => soundDept.has(id));
    addUsers(soundManagement);
  } else {
    // Generic fallback using activity catalog label if available
    try {
      const { data: cat } = await client.from('activity_catalog').select('label').eq('code', type).maybeSingle();
      title = (cat?.label as string) || body.type || 'Nueva actividad';
    } catch (_) {
      title = body.type || 'Nueva actividad';
    }
    text = jobTitle ? `${actor} — ${title} en "${jobTitle}".` : `${actor} — ${title}.`;
    addUsers(Array.from(mgmt));
  }

  if (type === 'job.assignment.confirmed') {
    if (!body.recipient_id || body.recipient_id !== userId) {
      recipients.delete(userId);
    }
  }

  // Load subscriptions for recipients
  if (recipients.size === 0) {
    return jsonResponse({ status: 'skipped', reason: 'No recipients' });
  }

  const { data: subs, error: subsErr } = await client
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', Array.from(recipients));
  if (subsErr) {
    console.error('push broadcast fetch subs error', subsErr);
    return jsonResponse({ error: 'Failed to load subscriptions' }, 500);
  }
  if (!subs || subs.length === 0) {
    return jsonResponse({ status: 'skipped', reason: 'No subscriptions for recipients' });
  }

  const payload: PushPayload = {
    title,
    body: text,
    url,
    type,
    meta: {
      jobId: jobId,
      tourId,
      tourName: tourName ?? undefined,
      actor,
      recipient: recipName,
      channel: ch,
      ...('file_name' in body ? { fileName: body.file_name } : {}),
      ...('file_id' in body ? { fileId: body.file_id } : {}),
      ...('venue_id' in body ? { venueId: body.venue_id } : {}),
      ...('venue_name' in body ? { venueName: body.venue_name } : {}),
      ...('changes' in body ? { changes: body.changes } : {}),
      ...('message_preview' in body ? { messagePreview: body.message_preview } : {}),
      ...('message_id' in body ? { messageId: body.message_id } : {}),
      ...('task_id' in body ? { taskId: body.task_id } : {}),
      ...('task_type' in body ? { taskType: body.task_type } : {}),
      ...(changeSummary ? { changeSummary } : {}),
      ...(metaExtras.view ? { view: metaExtras.view } : {}),
      ...(metaExtras.department ? { department: metaExtras.department } : {}),
      ...(metaExtras.targetUrl ? { targetUrl: metaExtras.targetUrl } : {}),
    },
  };

  const results: Array<{ endpoint: string; ok: boolean; status?: number; skipped?: boolean }> = [];
  await Promise.all(subs.map(async (sub: any) => {
    const result = await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
    results.push({ endpoint: sub.endpoint, ok: result.ok, status: 'status' in result ? (result as any).status : undefined, skipped: 'skipped' in result ? (result as any).skipped : undefined });
  }));

  return jsonResponse({ status: 'sent', results, count: results.length });
}

async function handleSubscribe(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: SubscribeBody,
  req: Request,
) {
  if (!body.subscription?.endpoint) {
    return jsonResponse({ error: "Missing subscription endpoint" }, 400);
  }

  const payload = {
    user_id: userId,
    endpoint: body.subscription.endpoint,
    p256dh: body.subscription.keys?.p256dh ?? null,
    auth: body.subscription.keys?.auth ?? null,
    expiration_time: body.subscription.expirationTime ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await client
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });

  if (error) {
    console.error("push subscribe error", error);
    return jsonResponse({ error: "Failed to persist subscription" }, 500);
  }

  const welcomeResult = await sendPushNotification(
    client,
    {
      endpoint: body.subscription.endpoint,
      p256dh: body.subscription.keys?.p256dh ?? null,
      auth: body.subscription.keys?.auth ?? null,
    },
    {
      title: "Push notifications ready",
      body: "You'll now receive updates from Sector Pro.",
      url: "/",
      type: "welcome",
    },
  );

  const notificationStatus = welcomeResult.ok
    ? "sent"
    : "skipped" in welcomeResult
      ? "skipped"
      : "failed";

  return jsonResponse({
    status: "subscribed",
    notification: notificationStatus,
    errorCode:
      welcomeResult.ok || "skipped" in welcomeResult
        ? undefined
        : welcomeResult.status,
  });
}

async function handleUnsubscribe(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: UnsubscribeBody,
) {
  if (!body.endpoint) {
    return jsonResponse({ error: "Missing endpoint" }, 400);
  }

  const { error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", body.endpoint);

  if (error) {
    console.error("push unsubscribe error", error);
    return jsonResponse({ error: "Failed to remove subscription" }, 500);
  }

  return jsonResponse({ status: "unsubscribed" });
}

async function handleTest(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: TestBody,
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonResponse({ error: "VAPID keys are not configured" }, 500);
  }

  const { data, error } = await client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .returns<PushSubscriptionRow[]>();

  if (error) {
    console.error("push test fetch error", error);
    return jsonResponse({ error: "Failed to load subscriptions" }, 500);
  }

  if (!data?.length) {
    return jsonResponse({ status: "skipped", reason: "No subscriptions found" });
  }

  const payload = {
    title: "Push notifications ready",
    body: "You'll now receive updates from Sector Pro.",
    url: body.url ?? "/",
  };

  const results: Array<{ endpoint: string; ok: boolean; status?: number; skipped?: boolean }> = [];

  await Promise.all(
    data.map(async (sub) => {
      const result = await sendPushNotification(client, sub, payload);
      results.push({
        endpoint: sub.endpoint,
        ok: result.ok,
        status: "status" in result ? result.status : undefined,
        skipped: "skipped" in result ? result.skipped : undefined,
      });
    }),
  );

  return jsonResponse({ status: "sent", results });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  let body: RequestBody;

  try {
    body = await req.json();
  } catch (error) {
    console.error("push parse error", error);
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body?.action) {
    return jsonResponse({ error: "Missing action" }, 400);
  }

  const token = ensureAuthHeader(req);
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  // Allow service callers only for broadcast; user token for others
  const allowService = (body.action as Action) === 'broadcast';
  const { userId } = await resolveCaller(client, token, allowService);

  switch (body.action as Action) {
    case "subscribe":
      return await handleSubscribe(client, userId, body as SubscribeBody, req);
    case "unsubscribe":
      return await handleUnsubscribe(client, userId, body as UnsubscribeBody);
    case "test":
      return await handleTest(client, userId, body as TestBody);
    case "broadcast":
      return await handleBroadcast(client, userId, body as BroadcastBody);
    default:
      return jsonResponse({ error: "Unsupported action" }, 400);
  }
});
