import type { SupabaseClient } from "./deps.ts";
import { HttpError } from "../_shared/http.ts";
import type { BroadcastBody } from "./types.ts";

export type PushCaller = {
  userId: string;
  isService: boolean;
};

type CallerProfile = {
  role: string | null;
  department: string | null;
};

const PRIVILEGED_ROLES = new Set(["admin", "management"]);
const SERVICE_ONLY_EVENTS = new Set([
  "job.invoicing_company.changed",
  "staffing.availability.sent",
  "staffing.availability.confirmed",
  "staffing.availability.declined",
  "staffing.offer.sent",
  "staffing.offer.confirmed",
  "staffing.offer.declined",
  "festival.public_form.submitted",
  "festival.public_rider.uploaded",
]);
const TASK_TABLES = [
  "sound_job_tasks",
  "lights_job_tasks",
  "video_job_tasks",
  "production_job_tasks",
  "administrative_job_tasks",
] as const;

const KNOWN_EVENT_PATTERNS = [
  /^job\.(created|updated|deleted|requirements\.updated|calltime\.updated|status\.(confirmed|cancelled)|type\.changed\.(single|tour|tourdate|festival|ciclo|dryhire|evento)|invoicing_company\.changed)$/,
  /^jobdate\.type\.changed\.(show|rehearsal|travel|setup|rigging|off|prep_day)$/,
  /^(job\.assignment\.(confirmed|direct)|assignment\.removed)$/,
  /^document\.(uploaded|deleted|tech_visible\.(enabled|disabled))$/,
  /^hoja\.updated$/,
  /^incident\.report\.uploaded$/,
  /^staffing\.(availability|offer)\.(sent|confirmed|declined|cancelled)$/,
  /^timesheet\.(submitted|approved|rejected)$/,
  /^task\.(assigned|updated|completed)$/,
  /^logistics\.(transport\.requested|event\.(created|updated|cancelled))$/,
  /^flex\.(folders\.created|tourdate_folder\.created)$/,
  /^message\.received$/,
  /^tourdate\.(created|updated|deleted|type\.changed\.(show|rehearsal|travel|setup|rigging|off))$/,
  /^soundvision\.file\.(uploaded|downloaded)$/,
  /^festival\.public_(form\.submitted|rider\.uploaded)$/,
  /^changelog\.updated$/,
] as const;

const USER_SELF_EVENTS = new Set([
  "staffing.availability.confirmed",
  "staffing.availability.declined",
  "staffing.offer.confirmed",
  "staffing.offer.declined",
  "timesheet.submitted",
]);

function isKnownEvent(type: string): boolean {
  return KNOWN_EVENT_PATTERNS.some((pattern) => pattern.test(type));
}

async function loadCallerProfile(client: SupabaseClient, userId: string): Promise<CallerProfile> {
  const { data, error } = await client
    .from("profiles")
    .select("role, department")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new HttpError(403, "No se pudo verificar el perfil del remitente");
  }
  return data as CallerProfile;
}

async function isTaskParticipant(
  client: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<boolean> {
  for (const table of TASK_TABLES) {
    const { data, error } = await client
      .from(table)
      .select("assigned_to, created_by")
      .eq("id", taskId)
      .maybeSingle();
    if (error) continue;
    if (data) {
      return data.assigned_to === userId || data.created_by === userId;
    }
  }
  return false;
}

async function isAuthorizedMessageProducer(
  client: SupabaseClient,
  body: BroadcastBody,
  userId: string,
): Promise<boolean> {
  if (!body.message_id || !body.recipient_id) return false;

  const { data: message, error } = await client
    .from("messages")
    .select("sender_id, department")
    .eq("id", body.message_id)
    .maybeSingle();
  if (error || !message || message.sender_id !== userId) return false;

  const { data: recipient } = await client
    .from("profiles")
    .select("role, department")
    .eq("id", body.recipient_id)
    .maybeSingle();
  if (!recipient) return false;
  return recipient.role === "admin"
    || (recipient.role === "management" && recipient.department === message.department);
}

/**
 * Authorizes the event producer before any email, recipient routing, or provider
 * side effect begins. Service callers retain compatibility for server-originated
 * events; signed-in users are limited to known events and authoritative context.
 */
export async function authorizeBroadcast(
  client: SupabaseClient,
  caller: PushCaller,
  body: BroadcastBody,
): Promise<void> {
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!type || type.length > 120) {
    throw new HttpError(400, "Tipo de notificación no válido");
  }

  if (!isKnownEvent(type)) {
    throw new HttpError(400, "Tipo de notificación no compatible");
  }
  if (caller.isService) return;
  if (SERVICE_ONLY_EVENTS.has(type)) {
    throw new HttpError(403, "Este evento solo puede emitirlo un servicio autorizado");
  }
  if (body.actor_id && body.actor_id !== caller.userId) {
    throw new HttpError(403, "No puedes suplantar al remitente de una notificación");
  }

  if (Array.isArray(body.user_ids) && body.user_ids.some((id) => id !== caller.userId)) {
    // Recipient fan-out is always derived by the server for user-originated events.
    body.user_ids = undefined;
  }
  body.actor_id = caller.userId;
  body.actor_name = undefined;

  const profile = await loadCallerProfile(client, caller.userId);
  if (PRIVILEGED_ROLES.has(profile.role ?? "")) return;
  if (
    profile.role === "logistics"
    && /^(job\.|jobdate\.|tourdate\.|logistics\.|flex\.|document\.uploaded|task\.)/.test(type)
  ) return;

  if (USER_SELF_EVENTS.has(type)) {
    const selfId = body.technician_id || body.recipient_id;
    if (selfId === caller.userId) return;
    throw new HttpError(403, "La notificación no corresponde al usuario actual");
  }

  if ((type === "task.updated" || type === "task.completed") && body.task_id) {
    if (await isTaskParticipant(client, body.task_id, caller.userId)) return;
  }

  if (type === "message.received") {
    if (await isAuthorizedMessageProducer(client, body, caller.userId)) return;
  }

  if (type === "incident.report.uploaded" && profile.role === "technician" && body.job_id) {
    return;
  }

  if (
    type === "document.uploaded"
    && (profile.role === "technician" || profile.role === "house_tech")
    && body.job_id
  ) {
    return;
  }

  if (
    type.startsWith("soundvision.file.")
    && (profile.role === "house_tech" || profile.role === "technician")
    && profile.department === "sound"
  ) {
    return;
  }

  throw new HttpError(403, "No tienes permiso para emitir esta notificación");
}
