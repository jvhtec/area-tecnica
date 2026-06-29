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
