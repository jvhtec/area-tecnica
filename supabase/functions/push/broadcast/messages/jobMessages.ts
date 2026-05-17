import type { BroadcastBody, DepartmentRoleSummary } from "../../types.ts";
import { fmtFieldEs } from "../../format.ts";
import { formatSpanishMediumDate } from "../date.ts";

const DATE_TYPE_LABELS: Record<string, string> = {
  show: 'Concierto',
  rehearsal: 'Ensayo',
  travel: 'Viaje',
  setup: 'Montaje',
  rigging: 'Rigging',
  off: 'Día libre',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  single: 'Trabajo individual',
  tour: 'Gira',
  festival: 'Festival',
  ciclo: 'Ciclo',
  dryhire: 'Alquiler seco',
  tourdate: 'Fecha de gira',
  evento: 'Evento',
};

const jobLabel = (jobTitle: string) => jobTitle || 'Trabajo';

export function buildJobUpdatedText(
  actor: string,
  jobTitle: string,
  changes: BroadcastBody['changes'],
): string {
  if (changes && typeof changes === 'object') {
    const keys = Object.keys(changes as Record<string, unknown>);
    const labels = keys.slice(0, 4).map(fmtFieldEs);
    if (labels.length > 0) {
      return `${actor} actualizó "${jobLabel(jobTitle)}". Cambios: ${labels.join(', ')}.`;
    }
  }

  return `${actor} actualizó "${jobLabel(jobTitle)}".`;
}

export function buildJobRequirementsUpdatedText(
  actor: string,
  jobTitle: string,
  summaryText: string,
): string {
  return summaryText
    ? `${actor} actualizó los requerimientos de "${jobLabel(jobTitle)}".\n\n${summaryText}`
    : `${actor} actualizó los requerimientos de "${jobLabel(jobTitle)}".`;
}

export function buildJobInvoicingCompanyChangedText(
  actor: string,
  jobTitle: string,
  changes: BroadcastBody['changes'],
): string {
  const companyChanges = changes as Record<string, { from?: unknown; to?: unknown }> | undefined;
  const oldCompany = companyChanges?.invoicing_company?.from || '(ninguna)';
  const newCompany = companyChanges?.invoicing_company?.to || '(ninguna)';

  return `${actor} cambió la empresa de facturación de "${jobLabel(jobTitle)}" de ${oldCompany} a ${newCompany}.`;
}

export function buildJobDateTypeChangedMessage(
  type: string,
  actor: string,
  jobTitle: string,
  body: BroadcastBody,
): { title: string; text: string } {
  const jobName = jobTitle || 'trabajo';
  const newType = body.new_type || (typeof type === 'string' ? type.split('.').pop() : '') || '';
  const label = DATE_TYPE_LABELS[newType] || newType || 'actualizada';

  let title = 'Tipo de fecha del trabajo cambiado';
  if (type === 'jobdate.type.changed.show') {
    title = 'Fecha del trabajo: Concierto';
  } else if (type === 'jobdate.type.changed.rehearsal') {
    title = 'Fecha del trabajo: Ensayo';
  } else if (type === 'jobdate.type.changed.travel') {
    title = 'Fecha del trabajo: Viaje';
  } else if (type === 'jobdate.type.changed.setup') {
    title = 'Fecha del trabajo: Montaje';
  } else if (type === 'jobdate.type.changed.rigging') {
    title = 'Fecha del trabajo: Rigging';
  } else if (type === 'jobdate.type.changed.off') {
    title = 'Fecha del trabajo: Día libre';
  }

  const targetDate = body.target_date as string | undefined;
  const formatted = formatSpanishMediumDate(targetDate ?? null);
  const text = formatted
    ? `${actor} marcó "${jobName}" como ${label} para ${formatted}.`
    : `${actor} marcó "${jobName}" como ${label}.`;

  return { title, text };
}

export function buildJobTypeChangedMessage(
  type: string,
  actor: string,
  jobTitle: string,
  body: BroadcastBody,
): { title: string; text: string } {
  const jobName = jobTitle || 'trabajo';
  const oldType = body.old_type || '';
  const newType = body.new_type || '';
  const oldTypeLabel = JOB_TYPE_LABELS[oldType] || oldType;
  const newTypeLabel = JOB_TYPE_LABELS[newType] || newType;

  if (type === 'job.type.changed.single') {
    return { title: 'Trabajo cambiado a Individual', text: `${actor} cambió "${jobName}" a Trabajo individual.` };
  }
  if (type === 'job.type.changed.tour') {
    return { title: 'Trabajo cambiado a Gira', text: `${actor} cambió "${jobName}" a Gira.` };
  }
  if (type === 'job.type.changed.festival') {
    return { title: 'Trabajo cambiado a Festival', text: `${actor} cambió "${jobName}" a Festival.` };
  }
  if (type === 'job.type.changed.ciclo') {
    return { title: 'Trabajo cambiado a Ciclo', text: `${actor} cambió "${jobName}" a Ciclo.` };
  }
  if (type === 'job.type.changed.dryhire') {
    return { title: 'Trabajo cambiado a Alquiler seco', text: `${actor} cambió "${jobName}" a Alquiler seco.` };
  }
  if (type === 'job.type.changed.tourdate') {
    return { title: 'Trabajo cambiado a Fecha de gira', text: `${actor} cambió "${jobName}" a Fecha de gira.` };
  }
  if (type === 'job.type.changed.evento') {
    return { title: 'Trabajo cambiado a Evento', text: `${actor} cambió "${jobName}" a Evento.` };
  }

  return {
    title: 'Tipo de trabajo cambiado',
    text: oldType && newType
      ? `${actor} cambió "${jobName}" de ${oldTypeLabel} a ${newTypeLabel}.`
      : `${actor} cambió el tipo de "${jobName}".`,
  };
}

export function hasRequirementSummary(summary: DepartmentRoleSummary[]): boolean {
  return summary.length > 0;
}
