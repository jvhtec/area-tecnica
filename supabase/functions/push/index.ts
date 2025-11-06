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
  assignment_status?: string; // confirmed | invited (for direct assignments)
  changes?: Record<string, { from?: unknown; to?: unknown } | unknown> | Record<string, unknown>;
  message_preview?: string;
  message_id?: string;
  // Tour/Tourdate optional hints
  tour_id?: string;
  tour_date_id?: string;
  tour_name?: string;
  dates_count?: number;
  // Tour date type change hints
  location_name?: string;
  old_type?: string;
  new_type?: string;
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

type PushNotificationRoute = {
  event_code: string;
  recipient_type: 'management_user' | 'department' | 'broadcast' | 'natural' | 'assigned_technicians';
  target_id: string | null;
  include_natural_recipients: boolean;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const CONTACT_EMAIL = Deno.env.get("PUSH_CONTACT_EMAIL") ?? "mailto:dev@sectorpro.com";

// Event type constants for type safety and consistency
const EVENT_TYPES = {
  // Job events
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  JOB_DELETED: 'job.deleted',
  JOB_STATUS_CONFIRMED: 'job.status.confirmed',
  JOB_STATUS_CANCELLED: 'job.status.cancelled',
  JOB_CALLTIME_UPDATED: 'job.calltime.updated',
  JOB_TYPE_CHANGED: 'job.type.changed',

  // Assignment events
  JOB_ASSIGNMENT_CONFIRMED: 'job.assignment.confirmed',
  JOB_ASSIGNMENT_DIRECT: 'job.assignment.direct',
  ASSIGNMENT_REMOVED: 'assignment.removed',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_TECH_VISIBLE_ENABLED: 'document.tech_visible.enabled',
  DOCUMENT_TECH_VISIBLE_DISABLED: 'document.tech_visible.disabled',

  // Incident reports
  INCIDENT_REPORT_UPLOADED: 'incident.report.uploaded',

  // Staffing events
  STAFFING_AVAILABILITY_SENT: 'staffing.availability.sent',
  STAFFING_AVAILABILITY_CONFIRMED: 'staffing.availability.confirmed',
  STAFFING_AVAILABILITY_DECLINED: 'staffing.availability.declined',
  STAFFING_AVAILABILITY_CANCELLED: 'staffing.availability.cancelled',
  STAFFING_OFFER_SENT: 'staffing.offer.sent',
  STAFFING_OFFER_CONFIRMED: 'staffing.offer.confirmed',
  STAFFING_OFFER_DECLINED: 'staffing.offer.declined',
  STAFFING_OFFER_CANCELLED: 'staffing.offer.cancelled',

  // Timesheet events
  TIMESHEET_SUBMITTED: 'timesheet.submitted',
  TIMESHEET_APPROVED: 'timesheet.approved',
  TIMESHEET_REJECTED: 'timesheet.rejected',

  // Task events
  TASK_ASSIGNED: 'task.assigned',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',

  // Logistics events
  LOGISTICS_TRANSPORT_REQUESTED: 'logistics.transport.requested',
  LOGISTICS_EVENT_CREATED: 'logistics.event.created',
  LOGISTICS_EVENT_UPDATED: 'logistics.event.updated',
  LOGISTICS_EVENT_CANCELLED: 'logistics.event.cancelled',

  // Tour events
  TOURDATE_CREATED: 'tourdate.created',
  TOURDATE_UPDATED: 'tourdate.updated',
  TOURDATE_DELETED: 'tourdate.deleted',

  // Flex events
  FLEX_FOLDERS_CREATED: 'flex.folders.created',
  FLEX_TOURDATE_FOLDER_CREATED: 'flex.tourdate_folder.created',

  // Messaging
  MESSAGE_RECEIVED: 'message.received',

  // SoundVision
  SOUNDVISION_FILE_UPLOADED: 'soundvision.file.uploaded',
  SOUNDVISION_FILE_DOWNLOADED: 'soundvision.file.downloaded',

  // Hoja de ruta
  HOJA_UPDATED: 'hoja.updated',
} as const;

// Push notification configuration
const PUSH_CONFIG = {
  TTL_SECONDS: 3600, // 1 hour for devices to come online
  URGENCY_HIGH: 'high' as const,
  URGENCY_NORMAL: 'normal' as const,
  URGENCY_LOW: 'low' as const,
  MAX_RETRIES: 3,
  DEFAULT_ICON: '/icon-192.png',
  DEFAULT_BADGE: '/badge-72.png',
};

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
        TTL: PUSH_CONFIG.TTL_SECONDS,
        urgency: PUSH_CONFIG.URGENCY_HIGH,
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
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      error: err
    });

    // Clean up expired/invalid subscriptions (410 Gone, 404 Not Found)
    if (status === 404 || status === 410) {
      console.log('🗑️ Cleaning up expired subscription');
      try {
        await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      } catch (cleanupErr) {
        console.error('⚠️ Failed to cleanup subscription:', cleanupErr);
        // Don't fail the whole operation if cleanup fails
      }
    }

    return { ok: false, status };
  }
}

async function getPushNotificationRoutes(
  client: ReturnType<typeof createClient>,
  eventCode: string,
): Promise<PushNotificationRoute[]> {
  if (!eventCode) return [];
  try {
    const { data, error } = await client
      .from('push_notification_routes')
      .select('event_code, recipient_type, target_id, include_natural_recipients')
      .eq('event_code', eventCode)
      .returns<PushNotificationRoute[]>();
    if (error) {
      console.error('push routing fetch error', { eventCode, error });
      return [];
    }
    return data ?? [];
  } catch (error) {
    console.error('push routing fetch error', { eventCode, error });
    return [];
  }
}

type RoutingOverrideOptions = {
  routes: PushNotificationRoute[];
  recipients: Set<string>;
  naturalRecipients: Set<string>;
  management: Set<string>;
  getDepartmentRecipients: (department: string) => Promise<string[]>;
  participants?: Set<string>;
};

async function applyRoutingOverrides({
  routes,
  recipients,
  naturalRecipients,
  management,
  getDepartmentRecipients,
  participants,
}: RoutingOverrideOptions): Promise<void> {
  if (!routes.length) return;

  let includeNatural = false;
  for (const route of routes) {
    if (route.include_natural_recipients === true || route.recipient_type === 'natural') {
      includeNatural = true;
      break;
    }
  }

  if (!includeNatural) {
    for (const id of naturalRecipients) {
      recipients.delete(id);
    }
  }

  const departmentCache = new Map<string, string[]>();
  const add = (id: string | null | undefined) => {
    if (id) {
      recipients.add(id);
    }
  };

  for (const route of routes) {
    switch (route.recipient_type) {
      case 'broadcast':
        for (const id of management) add(id);
        break;
      case 'management_user':
        if (route.target_id) {
          add(route.target_id);
        } else {
          for (const id of management) add(id);
        }
        break;
      case 'department':
        if (route.target_id) {
          const key = route.target_id;
          let deptRecipients = departmentCache.get(key);
          if (!deptRecipients) {
            const fetched = await getDepartmentRecipients(route.target_id);
            deptRecipients = Array.isArray(fetched) ? fetched : [];
            departmentCache.set(key, deptRecipients);
          }
          for (const id of deptRecipients) add(id);
        }
        break;
      case 'natural':
        // no-op; handled by includeNatural flag
        break;
      case 'assigned_technicians':
        if (participants && participants.size) {
          for (const id of participants) add(id);
        }
        break;
    }
  }
}

async function runRoutingSelfTests() {
  try {
    const recipients = new Set<string>(['actor', 'natural-recipient']);
    const naturalRecipients = new Set<string>(['natural-recipient']);
    const management = new Set<string>(['manager-a']);
    const routes: PushNotificationRoute[] = [
      {
        event_code: 'unit.test',
        recipient_type: 'department',
        target_id: 'sound',
        include_natural_recipients: false,
      },
      {
        event_code: 'unit.test',
        recipient_type: 'assigned_technicians',
        target_id: null,
        include_natural_recipients: false,
      },
    ];
    const departmentMap = new Map<string, string[]>([['sound', ['dept-manager']]]);
    const participants = new Set<string>(['tech-a', 'tech-b']);
    await applyRoutingOverrides({
      routes,
      recipients,
      naturalRecipients,
      management,
      participants,
      getDepartmentRecipients: async (department) => departmentMap.get(department) ?? [],
    });
    console.assert(
      !recipients.has('natural-recipient'),
      'Natural recipients should be removed when include_natural_recipients is false',
    );
    console.assert(
      recipients.has('dept-manager'),
      'Department routes should include department-specific management users',
    );
    console.assert(
      recipients.has('tech-a') && recipients.has('tech-b'),
      'Assigned technicians route should include job participants',
    );
  } catch (error) {
    console.error('push routing self-test failed', error);
  }
}

void runRoutingSelfTests();

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

// Admin helpers and department-scoped management targeting
async function getAdminUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

async function getManagementByDepartmentUserIds(client: ReturnType<typeof createClient>, department: string): Promise<string[]> {
  if (!department) return [];
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'management')
    .eq('department', department);
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

async function getTimesheetSubmittingTechDepartment(
  client: ReturnType<typeof createClient>,
  jobId?: string | null,
  actorId?: string | null,
): Promise<string | null> {
  try {
    // Prefer actor's submitted timesheet for this job
    if (jobId && actorId) {
      const { data: anySubmitted } = await client
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('technician_id', actorId)
        .eq('status', 'submitted')
        .limit(1);
      if (anySubmitted && anySubmitted.length) {
        const { data: prof } = await client
          .from('profiles')
          .select('department')
          .eq('id', actorId)
          .maybeSingle();
        return (prof as any)?.department ?? null;
      }
    }

    // Fallback: latest submitted timesheet for the job, then resolve that tech's department
    if (jobId) {
      const { data: row } = await client
        .from('timesheets')
        .select('technician_id, updated_at')
        .eq('job_id', jobId)
        .eq('status', 'submitted')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const techId = (row as any)?.technician_id as string | undefined;
      if (techId) {
        const { data: prof } = await client
          .from('profiles')
          .select('department')
          .eq('id', techId)
          .maybeSingle();
        return (prof as any)?.department ?? null;
      }
    }
  } catch (_) {
    // ignore
  }
  // Last resort: try actor profile
  if (actorId) {
    try {
      const { data: prof } = await client
        .from('profiles')
        .select('department')
        .eq('id', actorId)
        .maybeSingle();
      return (prof as any)?.department ?? null;
    } catch (_) { /* ignore */ }
  }
  return null;
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
  try {
    const { data, error } = await client.from('jobs').select('title').eq('id', jobId).maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch job title:', { jobId, error });
      return null;
    }
    return data?.title ?? null;
  } catch (err) {
    console.error('⚠️ Exception fetching job title:', { jobId, err });
    return null;
  }
}

async function getTourName(client: ReturnType<typeof createClient>, tourId?: string): Promise<string | null> {
  if (!tourId) return null;
  try {
    const { data, error } = await client.from('tours').select('name').eq('id', tourId).maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch tour name:', { tourId, error });
      return null;
    }
    return data?.name ?? null;
  } catch (err) {
    console.error('⚠️ Exception fetching tour name:', { tourId, err });
    return null;
  }
}

async function getProfileDisplayName(client: ReturnType<typeof createClient>, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('first_name,last_name,nickname,email')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch profile display name:', { userId, error });
      return null;
    }
    if (!data) return null;
    const full = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    if (full) return full;
    if (data.nickname) return data.nickname;
    return data.email || null;
  } catch (err) {
    console.error('⚠️ Exception fetching profile display name:', { userId, err });
    return null;
  }
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

  const routes = await getPushNotificationRoutes(client, type);

  // Determine recipients
  const recipients = new Set<string>();
  const naturalRecipients = new Set<string>();
  const management = new Set(await getManagementUserIds(client));
  const soundDept = new Set(await getSoundDepartmentUserIds(client));
  // Management audience should not include department-specific users by default
  const mgmt = new Set<string>(management);
  const participants = new Set(await getJobParticipantUserIds(client, jobId || ''));

  const addRecipients = (ids: (string | null | undefined)[]) => {
    for (const id of ids) {
      if (id) recipients.add(id);
    }
  };
  const addNaturalRecipients = (ids: (string | null | undefined)[]) => {
    for (const id of ids) {
      if (id) {
        recipients.add(id);
        naturalRecipients.add(id);
      }
    }
  };
  const clearAllRecipients = () => {
    recipients.clear();
    naturalRecipients.clear();
  };

  // Prefer explicit recipients if provided
  if (Array.isArray((body as any).user_ids) && (body as any).user_ids.length) {
    addRecipients(((body as any).user_ids as string[]));
  }

  // Always include the actor so they receive pushes across their own devices
  addRecipients([userId]);

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
    addNaturalRecipients(Array.from(mgmt));
  } else if (type === 'timesheet.submitted') {
    // Department-scoped management notification for timesheet submissions.
    // We target: management users whose department matches the submitting technician, plus all admins.
    // The actor (submitting tech) stays included for self-device delivery.
    title = 'Parte enviado';
    text = `${actor} ha rellenado su hoja de horas para "${jobTitle || 'Trabajo'}".`;

    // Resolve department from the submitted timesheet joined to profiles
    const dept = await getTimesheetSubmittingTechDepartment(client, jobId || null, (body as any)?.actor_id || userId);
    const adminIds = await getAdminUserIds(client);
    const mgmtDeptIds = dept ? await getManagementByDepartmentUserIds(client, dept) : [];

    // Only scoped-management recipients + admins; skip generic management broadcast
    clearAllRecipients();
    addRecipients([userId]); // keep actor self-notification across devices
    addNaturalRecipients(Array.from(new Set([...adminIds, ...mgmtDeptIds])));
  } else if (type === EVENT_TYPES.TIMESHEET_APPROVED) {
    // Notify technician that their timesheet was approved
    title = 'Parte aprobado';
    const techId = body.recipient_id || (body as any)?.technician_id;
    const techName = recipName || (await getProfileDisplayName(client, techId)) || 'Tu';

    if (techId === userId) {
      text = `Tu parte para "${jobTitle || 'Trabajo'}" ha sido aprobado.`;
    } else {
      text = `El parte de ${techName} para "${jobTitle || 'Trabajo'}" ha sido aprobado.`;
    }

    clearAllRecipients();
    if (techId) {
      addRecipients([techId]);
    }
  } else if (type === EVENT_TYPES.TIMESHEET_REJECTED) {
    // Notify technician that their timesheet was rejected
    title = 'Parte rechazado';
    const techId = body.recipient_id || (body as any)?.technician_id;
    const techName = recipName || (await getProfileDisplayName(client, techId)) || 'Tu';
    const reason = (body as any)?.rejection_reason;

    if (techId === userId) {
      text = reason
        ? `Tu parte para "${jobTitle || 'Trabajo'}" ha sido rechazado. Motivo: ${reason}`
        : `Tu parte para "${jobTitle || 'Trabajo'}" ha sido rechazado.`;
    } else {
      text = reason
        ? `El parte de ${techName} para "${jobTitle || 'Trabajo'}" ha sido rechazado. Motivo: ${reason}`
        : `El parte de ${techName} para "${jobTitle || 'Trabajo'}" ha sido rechazado.`;
    }

    clearAllRecipients();
    if (techId) {
      addRecipients([techId]);
    }
  } else if (type === 'job.updated') {
    title = 'Trabajo actualizado';
    if (body.changes && typeof body.changes === 'object') {
      const keys = Object.keys(body.changes as any);
      const labels = keys.slice(0, 4).map(fmtFieldEs); // summarize first few
      text = `${actor} actualizó "${jobTitle || 'Trabajo'}". Cambios: ${labels.join(', ')}.`;
    } else {
      text = `${actor} actualizó "${jobTitle || 'Trabajo'}".`;
    }
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type === 'document.uploaded') {
    title = 'Nuevo documento';
    const fname = body.file_name || 'documento';
    text = `${actor} subió "${fname}" a "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type === 'document.deleted') {
    title = 'Documento eliminado';
    const fname = body.file_name || 'documento';
    text = `${actor} eliminó "${fname}" de "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type === 'document.tech_visible.enabled') {
    title = 'Documento disponible para técnicos';
    const fname = body.file_name || 'documento';
    text = `Nuevo documento visible: "${fname}" en "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(participants));
  } else if (type === 'document.tech_visible.disabled') {
    title = 'Documento oculto para técnicos';
    const fname = body.file_name || 'documento';
    text = `El documento "${fname}" dejó de estar visible en "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(participants));
  } else if (type === EVENT_TYPES.INCIDENT_REPORT_UPLOADED) {
    // CRITICAL: Incident reports are safety-critical and need immediate visibility
    title = '⚠️ Reporte de incidencia';
    const fname = body.file_name || 'reporte de incidencia';
    text = `${actor} ha reportado una incidencia en "${jobTitle || 'Trabajo'}": ${fname}`;

    // Target: Sound department management + all admins + job participants
    clearAllRecipients();
    addRecipients([userId]); // keep actor self-notification

    // Get sound department management users
    const soundMgmt = Array.from(management).filter((id) => soundDept.has(id));
    const adminIds = await getAdminUserIds(client);

    // Add all critical recipients
    addNaturalRecipients([...soundMgmt, ...adminIds]);
    addNaturalRecipients(Array.from(participants));

    // Mark as high priority in metadata
    metaExtras.view = 'incident-reports';
    metaExtras.targetUrl = `/incident-reports`;

    console.log('🚨 Incident report notification - recipients:', recipients.size);
  } else if (type === 'staffing.availability.sent') {
    title = 'Solicitud de disponibilidad enviada';
    text = `${actor} envió solicitud a ${recipName || 'técnico'} (${ch}).`;
    addNaturalRecipients(Array.from(mgmt));
    addRecipients([body.recipient_id]);
  } else if (type === 'staffing.offer.sent') {
    title = 'Oferta enviada';
    text = `${actor} envió oferta a ${recipName || 'técnico'} (${ch}).`;
    addNaturalRecipients(Array.from(mgmt));
    addRecipients([body.recipient_id]);
  } else if (type === 'staffing.availability.confirmed') {
    title = 'Disponibilidad confirmada';
    text = `${recipName || 'Técnico'} confirmó disponibilidad para "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
  } else if (type === 'staffing.availability.declined') {
    title = 'Disponibilidad rechazada';
    text = `${recipName || 'Técnico'} rechazó disponibilidad para "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
  } else if (type === 'staffing.offer.confirmed') {
    title = 'Oferta aceptada';
    text = `${recipName || 'Técnico'} aceptó oferta para "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
    // No need to notify all participants here; keep it to management
  } else if (type === 'staffing.offer.declined') {
    title = 'Oferta rechazada';
    text = `${recipName || 'Técnico'} rechazó oferta para "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
  } else if (type === 'staffing.availability.cancelled') {
    title = 'Disponibilidad cancelada';
    text = `Solicitud de disponibilidad cancelada para "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
    addRecipients([body.recipient_id]);
  } else if (type === 'staffing.offer.cancelled') {
    title = 'Oferta cancelada';
    text = `Oferta cancelada para "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));
    addRecipients([body.recipient_id]);
  } else if (type === 'job.status.confirmed') {
    title = 'Trabajo confirmado';
    text = `"${jobTitle || 'Trabajo'}" ha sido confirmado.`;
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type === 'job.status.cancelled') {
    title = 'Trabajo cancelado';
    text = `"${jobTitle || 'Trabajo'}" ha sido cancelado.`;
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type === EVENT_TYPES.JOB_DELETED) {
    // CRITICAL: Job deletion notification - all assigned technicians need to know
    title = 'Trabajo eliminado';
    // Use title from body if provided (job is already deleted), otherwise try to resolve from job_id
    const deletedJobTitle = body.title || jobTitle || 'Trabajo';
    text = `${actor} ha eliminado "${deletedJobTitle}". Este trabajo ya no está disponible.`;

    // Notify all participants and management
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));

    console.log('🗑️ Job deletion notification - participants:', participants.size, 'management:', mgmt.size);
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
    addRecipients([body.recipient_id]);
  } else if (type === 'job.assignment.direct') {
    // For direct assignments, we need to send different messages:
    // - To the assigned tech: "Actor te ha confirmado..." (you have been confirmed)
    // - To management: "Actor ha confirmado a TechName..." (has confirmed TechName)

    // We'll handle this specially by sending two separate notifications
    const statusText = (body as any)?.assignment_status === 'confirmed' ? 'confirmado' : 'asignado';
    const assignedTechId = body.recipient_id;
    const assignedTechName = recipName;

    // Prepare metadata
    if (singleDayFlag && normalizedTargetDate) {
      metaExtras.singleDay = true;
      metaExtras.targetDate = normalizedTargetDate;
    }

    const baseMeta = {
      jobId: jobId,
      tourId,
      tourName: tourName ?? undefined,
      actor,
      recipient: assignedTechName,
      ...metaExtras,
    };

    let techSubsCount = 0;
    let mgmtSubsCount = 0;

    // 1. Send notification to the assigned technician (personalized: "you")
    if (assignedTechId) {
      const techTitle = 'Nueva asignación';
      let techText = '';
      if (singleDayFlag && formattedTargetDate) {
        techText = `${actor} te ha ${statusText} a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`;
      } else {
        techText = `${actor} te ha ${statusText} a "${jobTitle || 'Trabajo'}".`;
      }

      const { data: techSubs } = await client
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth, user_id')
        .eq('user_id', assignedTechId);

      if (techSubs && techSubs.length > 0) {
        techSubsCount = techSubs.length;
        const techPayload: PushPayload = {
          title: techTitle,
          body: techText,
          url,
          type,
          meta: baseMeta,
        };

        await Promise.all(techSubs.map(async (sub: any) => {
          await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, techPayload);
        }));
      }
    }

    // 2. Send notification to management (using tech's name)
    const mgmtTitle = 'Asignación directa';
    let mgmtText = '';
    if (assignedTechName) {
      if (singleDayFlag && formattedTargetDate) {
        mgmtText = `${actor} ha ${statusText} a ${assignedTechName} a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`;
      } else {
        mgmtText = `${actor} ha ${statusText} a ${assignedTechName} a "${jobTitle || 'Trabajo'}".`;
      }
    } else {
      if (singleDayFlag && formattedTargetDate) {
        mgmtText = `${actor} ha ${statusText} un técnico a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`;
      } else {
        mgmtText = `${actor} ha ${statusText} un técnico a "${jobTitle || 'Trabajo'}".`;
      }
    }

    const { data: mgmtSubs } = await client
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', Array.from(mgmt));

    if (mgmtSubs && mgmtSubs.length > 0) {
      mgmtSubsCount = mgmtSubs.length;
      const mgmtPayload: PushPayload = {
        title: mgmtTitle,
        body: mgmtText,
        url,
        type,
        meta: baseMeta,
      };

      await Promise.all(mgmtSubs.map(async (sub: any) => {
        await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, mgmtPayload);
      }));
    }

    // Return early since we've already sent the notifications
    return jsonResponse({ status: 'sent', count: techSubsCount + mgmtSubsCount });
  } else if (type === EVENT_TYPES.ASSIGNMENT_REMOVED) {
    // CRITICAL: Technician needs to know they've been removed from a job
    title = 'Asignación eliminada';
    const removedTechId = body.recipient_id || (body as any)?.technician_id;
    const removedTechName = recipName || (await getProfileDisplayName(client, removedTechId)) || 'Un técnico';

    // Different messages for the removed technician vs management
    clearAllRecipients();

    let techSubsCount = 0;
    let mgmtSubsCount = 0;

    // Notify the removed technician
    if (removedTechId) {
      const techTitle = 'Asignación eliminada';
      const techText = singleDayFlag && formattedTargetDate
        ? `${actor} te ha eliminado de "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`
        : `${actor} te ha eliminado de "${jobTitle || 'Trabajo'}".`;

      const { data: techSubs } = await client
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth, user_id')
        .eq('user_id', removedTechId);

      if (techSubs && techSubs.length > 0) {
        techSubsCount = techSubs.length;
        const techPayload: PushPayload = {
          title: techTitle,
          body: techText,
          url,
          type,
          meta: {
            jobId: jobId,
            tourId,
            tourName: tourName ?? undefined,
            actor,
            recipient: removedTechName,
            ...metaExtras,
          },
        };

        await Promise.all(techSubs.map(async (sub: any) => {
          await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, techPayload);
        }));
      }
    }

    // Notify management
    const mgmtTitle = 'Asignación eliminada';
    const mgmtText = singleDayFlag && formattedTargetDate
      ? `${actor} ha eliminado a ${removedTechName} de "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`
      : `${actor} ha eliminado a ${removedTechName} de "${jobTitle || 'Trabajo'}".`;

    const { data: mgmtSubs } = await client
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', Array.from(mgmt));

    if (mgmtSubs && mgmtSubs.length > 0) {
      mgmtSubsCount = mgmtSubs.length;
      const mgmtPayload: PushPayload = {
        title: mgmtTitle,
        body: mgmtText,
        url,
        type,
        meta: {
          jobId: jobId,
          tourId,
          tourName: tourName ?? undefined,
          actor,
          recipient: removedTechName,
          ...metaExtras,
        },
      };

      await Promise.all(mgmtSubs.map(async (sub: any) => {
        await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, mgmtPayload);
      }));
    }

    console.log('🚫 Assignment removal notification sent');
    return jsonResponse({ status: 'sent', count: techSubsCount + mgmtSubsCount });
  } else if (type === 'task.assigned') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const jobLabel = jobId ? (jobTitle || 'Trabajo') : (tourName || 'Tour');
    title = 'Tarea asignada';
    text = recipName
      ? `${actor} asignó ${taskLabel} a ${recipName} en "${jobLabel}".`
      : `${actor} asignó ${taskLabel} en "${jobLabel}".`;
    url = body.url || (jobId ? `/festival-management/${jobId}` : tourId ? `/tours/${tourId}` : url);
    addRecipients([body.recipient_id]);
  } else if (type === 'task.updated') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const jobLabel = jobId ? (jobTitle || 'Trabajo') : (tourName || 'Tour');
    title = 'Tarea actualizada';
    changeSummary = summarizeTaskChanges(body.changes);
    text = changeSummary
      ? `${actor} actualizó ${taskLabel} en "${jobLabel}". Cambios: ${changeSummary}.`
      : `${actor} actualizó ${taskLabel} en "${jobLabel}".`;
    url = body.url || (jobId ? `/festival-management/${jobId}` : tourId ? `/tours/${tourId}` : url);
    clearAllRecipients();
    addRecipients([body.recipient_id]);
  } else if (type === 'task.completed') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const jobLabel = jobId ? (jobTitle || 'Trabajo') : (tourName || 'Tour');
    title = 'Tarea completada';
    text = recipName
      ? `${actor} marcó como completada ${taskLabel} de ${recipName} en "${jobLabel}".`
      : `${actor} marcó como completada ${taskLabel} en "${jobLabel}".`;
    url = body.url || (jobId ? `/festival-management/${jobId}` : tourId ? `/tours/${tourId}` : url);
    addRecipients([body.recipient_id]);
  } else if (type === 'logistics.transport.requested') {
    const department = (body as any)?.department as string | undefined;
    const description = (body as any)?.description as string | undefined;
    const departmentLabel = department ? department.charAt(0).toUpperCase() + department.slice(1) : undefined;
    title = 'Transporte solicitado';
    const context = jobTitle ? ` en "${jobTitle}"` : '';

    // Build notification text with optional description
    if (departmentLabel && description) {
      text = `${actor} solicitó transporte para ${departmentLabel}${context}: ${description}`;
    } else if (departmentLabel) {
      text = `${actor} solicitó transporte para ${departmentLabel}${context}.`;
    } else if (description) {
      text = `${actor} solicitó transporte${context}: ${description}`;
    } else {
      text = `${actor} solicitó transporte${context}.`;
    }

    const logisticsUrl = jobId ? `/jobs/${jobId}` : '/logistics';
    url = body.url || logisticsUrl;
    clearAllRecipients();
    const logisticsRecipients = await getLogisticsManagementRecipients(client);
    addNaturalRecipients(logisticsRecipients);
    metaExtras.view = 'logistics';
    metaExtras.department = department;
    metaExtras.description = description;
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

    clearAllRecipients();
    const managementOnly = await getManagementOnlyUserIds(client);
    addNaturalRecipients(managementOnly);

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
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
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
    addNaturalRecipients(Array.from(mgmt));
  } else if (type === 'message.received') {
    title = 'Nuevo mensaje';
    const preview = body.message_preview || '';
    text = `${actor}: ${preview}`;
    url = body.url || '/messages';
    // Only notify the recipient, not the sender
    clearAllRecipients();
    addRecipients([body.recipient_id]);
  } else if (type === 'tourdate.created') {
    title = 'Fecha de tour creada';
    const tn = body.tour_name || '';
    text = tn ? `${actor} creó una fecha en "${tn}".` : `${actor} creó una nueva fecha de tour.`;
    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addNaturalRecipients(Array.from(mgmt));
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
    addNaturalRecipients(Array.from(mgmt));
  } else if (type === 'tourdate.deleted') {
    title = 'Fecha de tour eliminada';
    const tn = body.tour_name || '';
    text = tn ? `${actor} eliminó una fecha de "${tn}".` : `${actor} eliminó una fecha de tour.`;
    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addNaturalRecipients(Array.from(mgmt));
  } else if (type.startsWith('tourdate.type.changed')) {
    // Tour date type change events
    const locationName = (body as any).location_name || 'fecha de tour';
    const oldType = (body as any).old_type || '';
    const newType = (body as any).new_type || '';
    const tourName = body.tour_name || '';

    // Map type names to Spanish
    const typeLabels: Record<string, string> = {
      'show': 'Concierto',
      'rehearsal': 'Ensayo',
      'travel': 'Viaje',
      'setup': 'Montaje',
      'off': 'Día libre'
    };

    const oldTypeLabel = typeLabels[oldType] || oldType;
    const newTypeLabel = typeLabels[newType] || newType;

    if (type === 'tourdate.type.changed.show') {
      title = 'Fecha cambiada a Concierto';
      text = tourName
        ? `${actor} cambió "${locationName}" a Concierto en "${tourName}".`
        : `${actor} cambió "${locationName}" a Concierto.`;
    } else if (type === 'tourdate.type.changed.rehearsal') {
      title = 'Fecha cambiada a Ensayo';
      text = tourName
        ? `${actor} cambió "${locationName}" a Ensayo en "${tourName}".`
        : `${actor} cambió "${locationName}" a Ensayo.`;
    } else if (type === 'tourdate.type.changed.travel') {
      title = 'Fecha cambiada a Viaje';
      text = tourName
        ? `${actor} cambió "${locationName}" a Viaje en "${tourName}".`
        : `${actor} cambió "${locationName}" a Viaje.`;
    } else if (type === 'tourdate.type.changed.setup') {
      title = 'Fecha cambiada a Montaje';
      text = tourName
        ? `${actor} cambió "${locationName}" a Montaje en "${tourName}".`
        : `${actor} cambió "${locationName}" a Montaje.`;
    } else if (type === 'tourdate.type.changed.off') {
      title = 'Fecha cambiada a Día libre';
      text = tourName
        ? `${actor} cambió "${locationName}" a Día libre en "${tourName}".`
        : `${actor} cambió "${locationName}" a Día libre.`;
    } else {
      // Generic type change
      title = 'Tipo de fecha cambiado';
      if (oldType && newType) {
        text = tourName
          ? `${actor} cambió "${locationName}" de ${oldTypeLabel} a ${newTypeLabel} en "${tourName}".`
          : `${actor} cambió "${locationName}" de ${oldTypeLabel} a ${newTypeLabel}.`;
      } else {
        text = tourName
          ? `${actor} cambió el tipo de "${locationName}" en "${tourName}".`
          : `${actor} cambió el tipo de "${locationName}".`;
      }
    }

    url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : url);
    addNaturalRecipients(Array.from(mgmt));
  } else if (type.startsWith('jobdate.type.changed')) {
    // Per-job per-day date type change events (from job_date_types)
    const jobName = jobTitle || 'trabajo';
    const newType = (body as any).new_type || (typeof type === 'string' ? type.split('.').pop() : '') || '';
    const targetDate = (body as any)?.target_date as string | undefined;

    const typeLabels: Record<string, string> = {
      'show': 'Concierto',
      'rehearsal': 'Ensayo',
      'travel': 'Viaje',
      'setup': 'Montaje',
      'off': 'Día libre',
    };

    const label = typeLabels[newType] || newType || 'actualizada';

    if (type === 'jobdate.type.changed.show') {
      title = 'Fecha del trabajo: Concierto';
    } else if (type === 'jobdate.type.changed.rehearsal') {
      title = 'Fecha del trabajo: Ensayo';
    } else if (type === 'jobdate.type.changed.travel') {
      title = 'Fecha del trabajo: Viaje';
    } else if (type === 'jobdate.type.changed.setup') {
      title = 'Fecha del trabajo: Montaje';
    } else if (type === 'jobdate.type.changed.off') {
      title = 'Fecha del trabajo: Día libre';
    } else {
      title = 'Tipo de fecha del trabajo cambiado';
    }

    if (targetDate) {
      try {
        const formatted = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${targetDate}T00:00:00Z`));
        text = `${actor} marcó "${jobName}" como ${label} para ${formatted}.`;
      } catch (_) {
        text = `${actor} marcó "${jobName}" como ${label}.`;
      }
    } else {
      text = `${actor} marcó "${jobName}" como ${label}.`;
    }

    url = body.url || (jobId ? `/jobs/${jobId}` : url);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type.startsWith('job.type.changed')) {
    // Job type change events
    const jobName = jobTitle || 'trabajo';
    const oldType = (body as any).old_type || '';
    const newType = (body as any).new_type || '';

    // Map type names to Spanish
    const jobTypeLabels: Record<string, string> = {
      'single': 'Trabajo individual',
      'tour': 'Gira',
      'festival': 'Festival',
      'dryhire': 'Alquiler seco',
      'tourdate': 'Fecha de gira'
    };

    const oldTypeLabel = jobTypeLabels[oldType] || oldType;
    const newTypeLabel = jobTypeLabels[newType] || newType;

    if (type === 'job.type.changed.single') {
      title = 'Trabajo cambiado a Individual';
      text = `${actor} cambió "${jobName}" a Trabajo individual.`;
    } else if (type === 'job.type.changed.tour') {
      title = 'Trabajo cambiado a Gira';
      text = `${actor} cambió "${jobName}" a Gira.`;
    } else if (type === 'job.type.changed.festival') {
      title = 'Trabajo cambiado a Festival';
      text = `${actor} cambió "${jobName}" a Festival.`;
    } else if (type === 'job.type.changed.dryhire') {
      title = 'Trabajo cambiado a Alquiler seco';
      text = `${actor} cambió "${jobName}" a Alquiler seco.`;
    } else if (type === 'job.type.changed.tourdate') {
      title = 'Trabajo cambiado a Fecha de gira';
      text = `${actor} cambió "${jobName}" a Fecha de gira.`;
    } else {
      // Generic type change
      title = 'Tipo de trabajo cambiado';
      if (oldType && newType) {
        text = `${actor} cambió "${jobName}" de ${oldTypeLabel} a ${newTypeLabel}.`;
      } else {
        text = `${actor} cambió el tipo de "${jobName}".`;
      }
    }

    url = body.url || (jobId ? `/jobs/${jobId}` : url);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
  } else if (type === 'soundvision.file.uploaded' || type === 'soundvision.file.downloaded') {
    // SoundVision payloads should provide venue_name, or file_id/venue_id for lookup so we can compose contextual notifications.
    const venueName = (await resolveSoundVisionVenueName(client, body)) || 'desconocido';
    const action = type === 'soundvision.file.uploaded' ? 'subido' : 'descargado';
    title = type === 'soundvision.file.uploaded' ? 'Archivo SoundVision subido' : 'Archivo SoundVision descargado';
    text = `${actor} ha ${action} un archivo SoundVision ${venueName} a la base de datos.`;
    url = body.url || '/soundvision-files';
    // Notify only users who are both management and in the sound department
    const soundManagement = Array.from(management).filter((id) => soundDept.has(id));
    addNaturalRecipients(soundManagement);
  } else {
    // Generic fallback using activity catalog label if available
    try {
      const { data: cat } = await client.from('activity_catalog').select('label').eq('code', type).maybeSingle();
      title = (cat?.label as string) || body.type || 'Nueva actividad';
    } catch (_) {
      title = body.type || 'Nueva actividad';
    }
    text = jobTitle ? `${actor} — ${title} en "${jobTitle}".` : `${actor} — ${title}.`;
    addNaturalRecipients(Array.from(mgmt));
  }

  await applyRoutingOverrides({
    routes,
    recipients,
    naturalRecipients,
    management: mgmt,
    getDepartmentRecipients: async (department: string) =>
      getManagementByDepartmentUserIds(client, department),
    participants,
  });

  if (type === 'job.assignment.confirmed' || type === 'job.assignment.direct') {
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
