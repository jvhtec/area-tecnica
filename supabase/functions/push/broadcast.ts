import { EVENT_TYPES } from "./config.ts";
import { createClient } from "./deps.ts";
import {
  formatDepartmentRolesSummary,
  getAdminUserIds,
  getAdminUserIdsForStaffingNotifications,
  getJobDepartment,
  getJobParticipantUserIds,
  getJobRequiredRolesSummary,
  getJobTitle,
  getJobType,
  getLogisticsManagementRecipients,
  getManagementByDepartmentUserIds,
  getManagementOnlyUserIds,
  getManagementUserIds,
  getProfileDisplayName,
  getSoundDepartmentUserIds,
  getTechnicianDepartment,
  getTimesheetSubmittingTechDepartment,
  getTourName,
  normalizeDepartmentRolesPayload,
  resolveSoundVisionVenueName,
} from "./data.ts";
import { channelEs, fmtFieldEs, summarizeTaskChanges } from "./format.ts";
import { jsonResponse } from "./http.ts";
import { applyRoutingOverrides, getPushNotificationRoutes } from "./routing.ts";
import { resolveNotificationUrl, validateInternalUrl } from "./urls.ts";
import { sendNativePushNotification } from "./apns.ts";
import { sendPushNotification } from "./webpush.ts";
import type { BroadcastBody, DepartmentRoleSummary, NativePushTokenRow, PushPayload } from "./types.ts";

const loadNativeTokens = async (
  client: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<NativePushTokenRow[]> => {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("push_device_tokens")
    .select("user_id, device_token, platform")
    .in("user_id", userIds)
    .returns<NativePushTokenRow[]>();

  if (error) {
    console.error("push broadcast fetch native tokens error", error);
    return [];
  }

  return data ?? [];
};

export async function handleBroadcast(
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
  const jobDepartment = await getJobDepartment(client, jobId);
  const jobType = await getJobType(client, jobId);
  const tourId = body.tour_id;
  const tourName = body.tour_name || (await getTourName(client, tourId)) || null;

  const routes = await getPushNotificationRoutes(client, type);

  // Determine recipients
  const recipients = new Set<string>();
  const naturalRecipients = new Set<string>();
  const management = new Set(await getManagementUserIds(client));
  const soundDept = new Set(await getSoundDepartmentUserIds(client));
  const admin = new Set(await getAdminUserIds(client));
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

  // Determine navigation URL: validate custom URL or resolve based on event type
  let url = validateInternalUrl(body.url) || resolveNotificationUrl(type, jobId, tourId, jobType);

  const actorIdForLookup = (body as any)?.actor_id || userId;
  const actor = body.actor_name || (await getProfileDisplayName(client, actorIdForLookup)) || 'Alguien';
  const recipName = body.recipient_name || (await getProfileDisplayName(client, body.recipient_id)) || '';
  const ch = channelEs(body.channel);
  const metaExtras: {
    view?: string;
    department?: string;
    targetUrl?: string;
    targetDate?: string;
    singleDay?: boolean;
    requirementsSummary?: DepartmentRoleSummary[];
    requirementsSummaryText?: string;
  } = {};
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

  // ========================================================================
  // JOB EVENTS (7 events)
  // ========================================================================

  if (type === 'job.created') {
    title = 'Trabajo creado';
    text = `${actor} creó "${jobTitle || 'Trabajo'}".`;
    addNaturalRecipients(Array.from(mgmt));

  // ========================================================================
  // TIMESHEET EVENTS (3 events)
  // ========================================================================

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

  // ========================================================================
  // JOB EVENTS CONTINUED (update, type change, calltime)
  // ========================================================================

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

  } else if (type === EVENT_TYPES.JOB_REQUIREMENTS_UPDATED) {
    title = 'Requerimientos de equipo actualizados';
    const providedSummary = normalizeDepartmentRolesPayload((body as any)?.department_roles);
    let summary = await getJobRequiredRolesSummary(client, jobId);
    if (!summary.length) {
      summary = providedSummary;
    }

    const summaryText = formatDepartmentRolesSummary(summary);
    if (summaryText) {
      text = `${actor} actualizó los requerimientos de "${jobTitle || 'Trabajo'}".\n\n${summaryText}`;
    } else {
      text = `${actor} actualizó los requerimientos de "${jobTitle || 'Trabajo'}".`;
    }

    metaExtras.requirementsSummary = summary;
    metaExtras.requirementsSummaryText = summaryText || undefined;

    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));

  } else if (type === EVENT_TYPES.JOB_INVOICING_COMPANY_CHANGED) {
    // Invoicing company change notification
    const changes = body.changes as Record<string, { from?: unknown; to?: unknown }> | undefined;
    const oldCompany = changes?.invoicing_company?.from || '(ninguna)';
    const newCompany = changes?.invoicing_company?.to || '(ninguna)';

    title = 'Empresa de facturación modificada';
    text = `${actor} cambió la empresa de facturación de "${jobTitle || 'Trabajo'}" de ${oldCompany} a ${newCompany}.`;

    addNaturalRecipients(Array.from(mgmt));

  // ========================================================================
  // DOCUMENT EVENTS (4 events)
  // ========================================================================

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

  // ========================================================================
  // INCIDENT REPORTS (1 event - CRITICAL for safety)
  // ========================================================================

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

  // ========================================================================
  // STAFFING EVENTS (8 events)
  // ========================================================================

  } else if (type === 'staffing.availability.sent') {
    title = 'Solicitud de disponibilidad enviada';
    text = `${actor} envió solicitud a ${recipName || 'técnico'} (${ch}).`;
    // Department-aware: scope to technician's department, not job's department
    // This ensures lights managers only get notifications for lights techs, etc.
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
    addRecipients([body.recipient_id]);
  } else if (type === 'staffing.offer.sent') {
    title = 'Oferta enviada';
    text = `${actor} envió oferta a ${recipName || 'técnico'} (${ch}).`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
    addRecipients([body.recipient_id]);
  } else if (type === 'staffing.availability.confirmed') {
    title = 'Disponibilidad confirmada';
    text = `${recipName || 'Técnico'} confirmó disponibilidad para "${jobTitle || 'Trabajo'}".`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
  } else if (type === 'staffing.availability.declined') {
    title = 'Disponibilidad rechazada';
    text = `${recipName || 'Técnico'} rechazó disponibilidad para "${jobTitle || 'Trabajo'}".`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
  } else if (type === 'staffing.offer.confirmed') {
    title = 'Oferta aceptada';
    text = `${recipName || 'Técnico'} aceptó oferta para "${jobTitle || 'Trabajo'}".`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
    // No need to notify all participants here; keep it to management
  } else if (type === 'staffing.offer.declined') {
    title = 'Oferta rechazada';
    text = `${recipName || 'Técnico'} rechazó oferta para "${jobTitle || 'Trabajo'}".`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
  } else if (type === 'staffing.availability.cancelled') {
    title = 'Disponibilidad cancelada';
    text = `Solicitud de disponibilidad cancelada para "${jobTitle || 'Trabajo'}".`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
    addRecipients([body.recipient_id]);
  } else if (type === 'staffing.offer.cancelled') {
    title = 'Oferta cancelada';
    text = `Oferta cancelada para "${jobTitle || 'Trabajo'}".`;
    // Department-aware: scope to technician's department, not job's department
    const techDepartment = await getTechnicianDepartment(client, body.recipient_id);
    const deptMgmt = techDepartment ? await getManagementByDepartmentUserIds(client, techDepartment) : [];
    const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
    addNaturalRecipients([...deptMgmt, ...relevantAdmins]);
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

  // ========================================================================
  // JOB DELETION (1 event - CRITICAL)
  // ========================================================================

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

  // ========================================================================
  // ASSIGNMENT EVENTS (3 events)
  // ========================================================================

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

      const techTokens = await loadNativeTokens(client, [assignedTechId]);

      if ((techSubs && techSubs.length > 0) || techTokens.length > 0) {
        techSubsCount = (techSubs?.length || 0) + techTokens.length;
        const techPayload: PushPayload = {
          title: techTitle,
          body: techText,
          url,
          type,
          meta: baseMeta,
        };

        await Promise.all([
          ...(techSubs || []).map(async (sub: any) => {
            await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, techPayload);
          }),
          ...techTokens.map(async (tokenRow) => {
            await sendNativePushNotification(client, tokenRow.device_token, techPayload);
          }),
        ]);
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

    const mgmtTokens = await loadNativeTokens(client, Array.from(mgmt));

    if ((mgmtSubs && mgmtSubs.length > 0) || mgmtTokens.length > 0) {
      mgmtSubsCount = (mgmtSubs?.length || 0) + mgmtTokens.length;
      const mgmtPayload: PushPayload = {
        title: mgmtTitle,
        body: mgmtText,
        url,
        type,
        meta: baseMeta,
      };

      await Promise.all([
        ...(mgmtSubs || []).map(async (sub: any) => {
          await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, mgmtPayload);
        }),
        ...mgmtTokens.map(async (tokenRow) => {
          await sendNativePushNotification(client, tokenRow.device_token, mgmtPayload);
        }),
      ]);
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

      const techTokens = await loadNativeTokens(client, [removedTechId]);

      if ((techSubs && techSubs.length > 0) || techTokens.length > 0) {
        techSubsCount = (techSubs?.length || 0) + techTokens.length;
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

        await Promise.all([
          ...(techSubs || []).map(async (sub: any) => {
            await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, techPayload);
          }),
          ...techTokens.map(async (tokenRow) => {
            await sendNativePushNotification(client, tokenRow.device_token, techPayload);
          }),
        ]);
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

    const mgmtTokens = await loadNativeTokens(client, Array.from(mgmt));

    if ((mgmtSubs && mgmtSubs.length > 0) || mgmtTokens.length > 0) {
      mgmtSubsCount = (mgmtSubs?.length || 0) + mgmtTokens.length;
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

      await Promise.all([
        ...(mgmtSubs || []).map(async (sub: any) => {
          await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, mgmtPayload);
        }),
        ...mgmtTokens.map(async (tokenRow) => {
          await sendNativePushNotification(client, tokenRow.device_token, mgmtPayload);
        }),
      ]);
    }

    console.log('🚫 Assignment removal notification sent');
    return jsonResponse({ status: 'sent', count: techSubsCount + mgmtSubsCount });

  // ========================================================================
  // TASK EVENTS (3 events)
  // ========================================================================

  } else if (type === 'task.assigned') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const contextLabel = jobId ? (jobTitle || 'Trabajo') : tourName;
    const context = contextLabel ? ` en "${contextLabel}"` : '';
    title = 'Tarea asignada';
    text = recipName
      ? `${actor} asignó ${taskLabel} a ${recipName}${context}.`
      : `${actor} asignó ${taskLabel}${context}.`;
    // URL already resolved by resolveNotificationUrl(), no override needed
    addRecipients([body.recipient_id]);
  } else if (type === 'task.updated') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const contextLabel = jobId ? (jobTitle || 'Trabajo') : tourName;
    const context = contextLabel ? ` en "${contextLabel}"` : '';
    title = 'Tarea actualizada';
    changeSummary = summarizeTaskChanges(body.changes);
    text = changeSummary
      ? `${actor} actualizó ${taskLabel}${context}. Cambios: ${changeSummary}.`
      : `${actor} actualizó ${taskLabel}${context}.`;
    // URL already resolved by resolveNotificationUrl(), no override needed
    clearAllRecipients();
    addRecipients([body.recipient_id]);
  } else if (type === 'task.completed') {
    const taskLabel = body.task_type ? `la tarea "${body.task_type}"` : 'una tarea';
    const contextLabel = jobId ? (jobTitle || 'Trabajo') : tourName;
    const context = contextLabel ? ` en "${contextLabel}"` : '';
    title = 'Tarea completada';
    text = recipName
      ? `${actor} marcó como completada ${taskLabel} de ${recipName}${context}.`
      : `${actor} marcó como completada ${taskLabel}${context}.`;
    // URL already resolved by resolveNotificationUrl(), no override needed
    addRecipients([body.recipient_id]);

  // ========================================================================
  // LOGISTICS EVENTS (4 events)
  // ========================================================================

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

  // ========================================================================
  // FLEX EVENTS (2 events)
  // ========================================================================

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

  // ========================================================================
  // MESSAGING (1 event)
  // ========================================================================

  } else if (type === 'message.received') {
    title = 'Nuevo mensaje';
    const preview = body.message_preview || '';
    text = `${actor}: ${preview}`;
    // URL already resolved by resolveNotificationUrl() to /dashboard?showMessages=true
    // Only notify the recipient, not the sender
    clearAllRecipients();
    addRecipients([body.recipient_id]);

  // ========================================================================
  // TOUR EVENTS (3 events)
  // ========================================================================

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

  // ========================================================================
  // TOUR DATE TYPE CHANGE EVENTS (6 events)
  // ========================================================================

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

  // ========================================================================
  // JOB DATE TYPE CHANGE EVENTS (6 events)
  // ========================================================================

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

  // ========================================================================
  // JOB TYPE CHANGE EVENTS (6 events)
  // ========================================================================

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
      'tourdate': 'Fecha de gira',
      'evento': 'Evento'
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
    } else if (type === 'job.type.changed.evento') {
      title = 'Trabajo cambiado a Evento';
      text = `${actor} cambió "${jobName}" a Evento.`;
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

  // ========================================================================
  // SOUNDVISION EVENTS (2 events)
  // ========================================================================

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

  // ========================================================================
  // CHANGELOG EVENTS (1 event)
  // ========================================================================

  } else if (type === EVENT_TYPES.CHANGELOG_UPDATED) {
    // Notify all users when changelog is updated
    const version = (body as any)?.version as string | undefined;
    const content = (body as any)?.content as string | undefined;

    title = '⚠️ ¡Actualiza ahora!';
    if (content) {
      // Show the full changelog content in the notification
      text = content;
    } else if (version) {
      text = `Nueva versión v${version} disponible. Actualiza la aplicación para ver las novedades.`;
    } else {
      text = 'Se han publicado cambios importantes. Actualiza la aplicación.';
    }

    // Deeplink to open About modal - works for both tech-app and regular layout
    url = body.url || '/?showAbout=1';
    // Broadcast to all authenticated users
    clearAllRecipients();
    const { data: allUsers } = await client
      .from('profiles')
      .select('id');
    if (allUsers && allUsers.length > 0) {
      addNaturalRecipients(allUsers.map(u => u.id));
    }

  // ========================================================================
  // FALLBACK (Unknown event types)
  // ========================================================================

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

  const recipientIds = Array.from(recipients);
  const { data: subs, error: subsErr } = await client
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', recipientIds);
  if (subsErr) {
    console.error('push broadcast fetch subs error', subsErr);
    return jsonResponse({ error: 'Failed to load subscriptions' }, 500);
  }
  const nativeTokens = await loadNativeTokens(client, recipientIds);
  if ((!subs || subs.length === 0) && nativeTokens.length === 0) {
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
      ...(metaExtras.requirementsSummary ? { departmentRoles: metaExtras.requirementsSummary } : {}),
      ...(metaExtras.requirementsSummaryText ? { departmentRolesText: metaExtras.requirementsSummaryText } : {}),
    },
  };

  const results: Array<{ endpoint: string; ok: boolean; status?: number; skipped?: boolean }> = [];
  await Promise.all([
    ...(subs || []).map(async (sub: any) => {
      const result = await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
      results.push({ endpoint: sub.endpoint, ok: result.ok, status: 'status' in result ? (result as any).status : undefined, skipped: 'skipped' in result ? (result as any).skipped : undefined });
    }),
    ...nativeTokens.map(async (tokenRow) => {
      const result = await sendNativePushNotification(client, tokenRow.device_token, payload);
      results.push({ endpoint: `apns:${tokenRow.device_token}`, ok: result.ok, status: 'status' in result ? (result as any).status : undefined, skipped: 'skipped' in result ? (result as any).skipped : undefined });
    }),
  ]);

  return jsonResponse({ status: 'sent', results, count: results.length });
}
