export type StaffingCampaignStatus = 'active' | 'paused' | 'stopped' | 'completed' | 'failed' | string;

const RESTARTABLE_STATUSES = new Set(['paused', 'stopped', 'completed']);

export function canResumeStaffingCampaign(status: unknown): boolean {
  return RESTARTABLE_STATUSES.has(String(status || '').toLowerCase());
}

export function staffingCampaignResumeLabel(status: unknown): string {
  return String(status || '').toLowerCase() === 'paused' ? 'Reanudar' : 'Reiniciar';
}

export function staffingCampaignResumeToastTitle(agentName: string, status: unknown): string {
  return String(status || '').toLowerCase() === 'paused'
    ? `${agentName} reanudado`
    : `${agentName} reiniciado`;
}

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  paused: 'Pausada',
  stopped: 'Detenida',
  completed: 'Completada',
  failed: 'Fallida',
}

const CAMPAIGN_ROLE_STAGE_LABELS: Record<string, string> = {
  idle: 'Pendiente',
  availability: 'Disponibilidad',
  offer: 'Oferta',
  filled: 'Cubierto',
  escalating: 'Escalando',
}

export function staffingCampaignStatusLabel(status: unknown): string {
  const normalized = String(status || '').toLowerCase()
  return CAMPAIGN_STATUS_LABELS[normalized] ?? normalized
}

export function staffingCampaignRoleStageLabel(stage: unknown): string {
  const normalized = String(stage || '').toLowerCase()
  return CAMPAIGN_ROLE_STAGE_LABELS[normalized] ?? normalized
}
