import { EVENT_TYPES } from "../../config.ts";
import {
  formatDepartmentRolesSummary,
  getJobRequiredRolesSummary,
  normalizeDepartmentRolesPayload,
} from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import {
  buildJobDateTypeChangedMessage,
  buildJobInvoicingCompanyChangedText,
  buildJobRequirementsUpdatedText,
  buildJobTypeChangedMessage,
  buildJobUpdatedText,
} from "../messages/jobMessages.ts";

export async function handleJobEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, jobId, jobTitle, state, audience } = context;
  const { mgmt, participants, addNaturalRecipients } = audience;

  if (type === 'job.created') {
    setBroadcastMessage(state, 'Trabajo creado', `${actor} creó "${jobTitle || 'Trabajo'}".`);
    addNaturalRecipients(Array.from(mgmt));
    return true;
  }

  if (type === 'job.updated') {
    setBroadcastMessage(state, 'Trabajo actualizado', buildJobUpdatedText(actor, jobTitle, body.changes));
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === EVENT_TYPES.JOB_REQUIREMENTS_UPDATED) {
    const providedSummary = normalizeDepartmentRolesPayload(body.department_roles);
    let summary = await getJobRequiredRolesSummary(context.client, jobId);
    if (!summary.length) {
      summary = providedSummary;
    }

    const summaryText = formatDepartmentRolesSummary(summary);
    setBroadcastMessage(
      state,
      'Requerimientos de equipo actualizados',
      buildJobRequirementsUpdatedText(actor, jobTitle, summaryText),
    );

    state.metaExtras.requirementsSummary = summary;
    state.metaExtras.requirementsSummaryText = summaryText || undefined;

    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === EVENT_TYPES.JOB_INVOICING_COMPANY_CHANGED) {
    setBroadcastMessage(
      state,
      'Empresa de facturación modificada',
      buildJobInvoicingCompanyChangedText(actor, jobTitle, body.changes),
    );
    addNaturalRecipients(Array.from(mgmt));
    return true;
  }

  if (type === 'job.status.confirmed') {
    setBroadcastMessage(state, 'Trabajo confirmado', `"${jobTitle || 'Trabajo'}" ha sido confirmado.`);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === 'job.status.cancelled') {
    setBroadcastMessage(state, 'Trabajo cancelado', `"${jobTitle || 'Trabajo'}" ha sido cancelado.`);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === EVENT_TYPES.JOB_DELETED) {
    const deletedJobTitle = body.title || jobTitle || 'Trabajo';
    setBroadcastMessage(
      state,
      'Trabajo eliminado',
      `${actor} ha eliminado "${deletedJobTitle}". Este trabajo ya no está disponible.`,
    );
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    console.log('Job deletion notification - participants:', participants.size, 'management:', mgmt.size);
    return true;
  }

  if (type.startsWith('jobdate.type.changed')) {
    const message = buildJobDateTypeChangedMessage(type, actor, jobTitle, body);
    setBroadcastMessage(state, message.title, message.text);
    state.url = body.url || (jobId ? `/jobs/${jobId}` : state.url);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type.startsWith('job.type.changed')) {
    const message = buildJobTypeChangedMessage(type, actor, jobTitle, body);
    setBroadcastMessage(state, message.title, message.text);
    state.url = body.url || (jobId ? `/jobs/${jobId}` : state.url);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  return false;
}
