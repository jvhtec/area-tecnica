export type CampaignStatus = "active" | "paused" | "stopped" | "completed" | "failed" | string;

export type RequiredRoleLike = {
  role_code?: unknown;
  quantity?: unknown;
};

export type CampaignRoleLike = {
  role_code?: unknown;
};

export type CampaignRoleInsert = {
  campaign_id: string;
  role_code: string;
  stage: "idle";
  wave_number: 0;
  assigned_count: 0;
  pending_availability: 0;
  confirmed_availability: 0;
  pending_offers: 0;
  accepted_offers: 0;
};

const RESTARTABLE_CAMPAIGN_STATUSES = new Set(["paused", "stopped", "completed"]);

export function normalizeRoleCode(value: unknown): string {
  return String(value || "").trim();
}

export function canResumeCampaignStatus(status: unknown): boolean {
  return RESTARTABLE_CAMPAIGN_STATUSES.has(String(status || "").toLowerCase());
}

export function buildRequiredRoleQuantityMap(requiredRoles: RequiredRoleLike[]): Map<string, number> {
  const requiredByRole = new Map<string, number>();

  for (const role of requiredRoles) {
    const roleCode = normalizeRoleCode(role.role_code);
    if (!roleCode) continue;

    const quantity = Math.max(0, Number(role.quantity || 0));
    requiredByRole.set(roleCode, (requiredByRole.get(roleCode) || 0) + quantity);
  }

  return requiredByRole;
}

export function buildMissingCampaignRoleInserts(
  campaignId: string,
  requiredRoles: RequiredRoleLike[],
  campaignRoles: CampaignRoleLike[],
): CampaignRoleInsert[] {
  const existingRoleCodes = new Set(
    campaignRoles
      .map((role) => normalizeRoleCode(role.role_code))
      .filter(Boolean),
  );

  return Array.from(buildRequiredRoleQuantityMap(requiredRoles).entries())
    .filter(([roleCode, quantity]) => quantity > 0 && !existingRoleCodes.has(roleCode))
    .map(([roleCode]) => ({
      campaign_id: campaignId,
      role_code: roleCode,
      stage: "idle",
      wave_number: 0,
      assigned_count: 0,
      pending_availability: 0,
      confirmed_availability: 0,
      pending_offers: 0,
      accepted_offers: 0,
    }));
}

export type CampaignJobLike = {
  end_time?: string | null;
  status?: string | null;
} | null;

export type CampaignClosureReason = "job_missing" | "job_cancelled" | "job_completed" | "job_ended";

const CANCELLED_JOB_STATUSES = new Set(["cancelado", "cancelled"]);
const COMPLETED_JOB_STATUSES = new Set(["completado", "completed"]);

/**
 * Why an active campaign can no longer staff its job, or null while it still
 * can: the job was deleted, cancelled, marked completed, or its dates passed.
 * A campaign for a job that is over keeps ticking forever otherwise.
 */
export function campaignClosureReason(job: CampaignJobLike, now: Date): CampaignClosureReason | null {
  if (!job) return "job_missing";
  const status = String(job.status || "").trim().toLowerCase();
  if (CANCELLED_JOB_STATUSES.has(status)) return "job_cancelled";
  if (COMPLETED_JOB_STATUSES.has(status)) return "job_completed";
  if (job.end_time && new Date(job.end_time).getTime() < now.getTime()) return "job_ended";
  return null;
}

export type CampaignRoleCounters = {
  assigned_count?: unknown;
  pending_availability?: unknown;
  confirmed_availability?: unknown;
  pending_offers?: unknown;
  accepted_offers?: unknown;
  stage?: unknown;
  wave_number?: unknown;
  last_wave_at?: unknown;
};

const ROLE_COUNTER_FIELDS = [
  "assigned_count",
  "pending_availability",
  "confirmed_availability",
  "pending_offers",
  "accepted_offers",
  "stage",
  "wave_number",
] as const;

const instant = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const time = new Date(String(value)).getTime();
  return Number.isNaN(time) ? null : time;
};

/**
 * True when a tick's computed counters differ from the stored role row.
 * Ticks run every few minutes, so writing unchanged rows only produced
 * WAL and realtime traffic.
 */
export function campaignRoleChanged(current: CampaignRoleCounters, next: CampaignRoleCounters): boolean {
  for (const field of ROLE_COUNTER_FIELDS) {
    if (String(current[field] ?? "") !== String(next[field] ?? "")) return true;
  }
  return instant(current.last_wave_at) !== instant(next.last_wave_at);
}
