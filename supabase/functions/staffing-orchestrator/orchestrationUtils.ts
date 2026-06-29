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
