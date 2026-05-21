import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260512090000_staffing_request_role_code_candidates.sql"),
  "utf-8",
);

const smarterMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260519130000_smarter_staffing_skill_mapping.sql"),
  "utf-8",
);

const jobScopedAvailabilityMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260519165000_job_scoped_staffing_availability.sql"),
  "utf-8",
);

const declinedPenaltyMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260519170000_declined_staffing_request_ranking_penalty.sql"),
  "utf-8",
);

const profileRateScoringMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260520110000_crewing_profile_rate_scoring.sql"),
  "utf-8",
);

const staffingSweeperScheduleMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260520130000_schedule_staffing_sweeper.sql"),
  "utf-8",
);

const sendStaffingEmailFunction = readFileSync(
  join(process.cwd(), "supabase/functions/send-staffing-email/index.ts"),
  "utf-8",
);

const staffingPushFunction = readFileSync(
  join(process.cwd(), "supabase/functions/push/broadcast.ts"),
  "utf-8",
);

const staffingPushEvents = readFileSync(
  join(process.cwd(), "supabase/functions/push/broadcast/families/staffingEvents.ts"),
  "utf-8",
);

const staffingHook = readFileSync(
  join(process.cwd(), "src/features/staffing/hooks/useStaffing.ts"),
  "utf-8",
);

const staffingOrchestratorFunction = readFileSync(
  join(process.cwd(), "supabase/functions/staffing-orchestrator/index.ts"),
  "utf-8",
);

describe("staffing recommendation consultation guards", () => {
  it("stores a structured role_code for role-specific staffing requests", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS role_code text");
    expect(migration).toContain("NULLIF(BTRIM(se.meta->>'role'), '') AS role_code");
    expect(jobScopedAvailabilityMigration).toContain("WHERE phase = 'availability'");
    expect(jobScopedAvailabilityMigration).toContain("SET role_code = NULL");
    expect(sendStaffingEmailFunction).toContain("roleCode && phase === 'offer'");
  });

  it("excludes active job-level availability without treating expired as active", () => {
    expect(jobScopedAvailabilityMigration).toContain("Availability is job-scoped");
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.phase = 'availability'/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.status IN \('pending', 'confirmed'\)/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.phase = 'offer'/);
    expect(jobScopedAvailabilityMigration).not.toMatch(/sr\.status IN \('pending', 'confirmed', 'declined', 'expired'\)/);
  });

  it("blocks declined job-level availability when it overlaps the job dates", () => {
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.phase = 'availability'/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.status = 'declined'/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.single_day = false/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.target_date BETWEEN v_job_start::date AND v_job_end::date/);
  });
});

describe("smarter staffing recommendation migration", () => {
  it("scores role-prefix experience from completed confirmed assignments", () => {
    expect(smarterMigration).toMatch(/COUNT\(DISTINCT ja\.job_id\)::int AS role_completed_jobs/);
    expect(smarterMigration).toMatch(/ja\.status = 'confirmed'/);
    expect(smarterMigration).toMatch(/j\.status = 'Completado'/);
    expect(smarterMigration).toMatch(/public\.staffing_role_prefix\(/);
    expect(smarterMigration).toMatch(/GREATEST\(wr\.manual_skill_score, wr\.role_experience_score\)::int AS skills_score/);
    expect(smarterMigration).toContain("Role experience: ");
  });

  it("penalizes prior declined requests for the same role prefix", () => {
    expect(declinedPenaltyMigration).toContain("role_declines AS");
    expect(declinedPenaltyMigration).toMatch(/sr\.status = 'declined'/);
    expect(declinedPenaltyMigration).toMatch(/se\.meta->>'phase' = sr\.phase/);
    expect(declinedPenaltyMigration).toMatch(/public\.staffing_role_prefix\(/);
    expect(declinedPenaltyMigration).toContain("role_decline_penalty");
    expect(declinedPenaltyMigration).toContain("GREATEST(0, GREATEST(wr.manual_skill_score, wr.role_experience_score) - wr.role_decline_penalty)");
    expect(declinedPenaltyMigration).toContain("Declined role requests:");
  });

  it("applies profile cost/rate scoring without changing the candidate RPC shape", () => {
    expect(profileRateScoringMigration).toContain("rank_staffing_candidates(uuid,text,text,text,jsonb)");
    expect(profileRateScoringMigration).not.toContain("RETURNS TABLE");
    expect(profileRateScoringMigration).toContain("p_policy->'cost_scoring'->>'enabled'");
    expect(profileRateScoringMigration).toContain("p_policy->'weights'->>'cost_efficiency'");
    expect(profileRateScoringMigration).toContain("rate_adjustments AS");
    expect(profileRateScoringMigration).toContain("custom_tech_rates");
    expect(profileRateScoringMigration).toContain("rate_cards_2025");
    expect(profileRateScoringMigration).toContain("cost_efficiency_score");
    expect(profileRateScoringMigration).toContain("Rate adjustment:");
  });

  it("filters hard collisions and unavailability before candidates are returned", () => {
    expect(smarterMigration).toMatch(/FROM technician_availability ta/);
    expect(smarterMigration).toMatch(/JOIN target_dates td ON td\.target_date = ta\.date/);
    expect(smarterMigration).toMatch(/FROM timesheets ts/);
    expect(smarterMigration).toMatch(/ts\.is_active = true/);
    expect(smarterMigration).toMatch(/j2\.time_range && tstzrange\(v_job_start, v_job_end, '\[\]'\)/);
    expect(smarterMigration).toMatch(/WHERE ja\.job_id = p_job_id\s+AND ja\.technician_id = p\.id/);
  });

  it("dedupes job-level availability separately from role-specific offers", () => {
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.phase = 'availability'/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.status IN \('pending', 'confirmed'\)/);
    expect(jobScopedAvailabilityMigration).toMatch(/NULLIF\(BTRIM\(sr\.role_code\), ''\) = v_normalized_role_code/);
    expect(jobScopedAvailabilityMigration).toMatch(/sr\.phase = 'offer'/);
    expect(jobScopedAvailabilityMigration).not.toMatch(/sr\.status IN \('pending', 'confirmed', 'declined', 'expired'\)/);
  });

  it("uses role-prefix mappings for manual skills", () => {
    expect(smarterMigration).toMatch(/v_role_prefix := public\.staffing_role_prefix\(v_normalized_role_code\)/);
    expect(smarterMigration).toMatch(/JOIN role_skill_mapping rsm ON LOWER\(rsm\.skill_name\) = LOWER\(s\.name\)/);
    expect(smarterMigration).toMatch(/rsm\.role_prefix = v_role_prefix/);
  });

  it("adds scoped write policies and grants for role skill mappings", () => {
    expect(smarterMigration).toContain('CREATE POLICY "role_skill_mapping_insert_admin_or_scoped_management"');
    expect(smarterMigration).toContain('CREATE POLICY "role_skill_mapping_update_admin_or_scoped_management"');
    expect(smarterMigration).toContain('CREATE POLICY "role_skill_mapping_delete_admin_or_scoped_management"');
    expect(smarterMigration).toMatch(/public\.can_manage_role_skill_mapping\(role_prefix, skill_name\)/);
    expect(smarterMigration).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_skill_mapping TO authenticated");
  });

  it("blocks stale candidate-list sends when the candidate no longer matches displayed availability", () => {
    expect(sendStaffingEmailFunction).toContain("require_no_conflicts");
    expect(sendStaffingEmailFunction).toContain("RECOMMENDATION GUARD");
    expect(sendStaffingEmailFunction).toContain("overlapping_assignments");
    expect(sendStaffingEmailFunction).toContain("same_role_requests");
    expect(sendStaffingEmailFunction).toContain("job_availability_requests");
    expect(sendStaffingEmailFunction).toContain("roleless_declines");
    expect(sendStaffingEmailFunction).toContain("status: 409");
  });

  it("lets service-role automation send WhatsApp as the campaign creator", () => {
    expect(sendStaffingEmailFunction).toContain("isServiceRoleRequest");
    expect(sendStaffingEmailFunction).toContain("body?.actor_id");
    expect(staffingOrchestratorFunction).toContain("actor_id: campaign.created_by");
  });

  it("scopes staffing push notifications to the staffing department", () => {
    expect(sendStaffingEmailFunction).toContain("department: staffingDepartment");
    expect(sendStaffingEmailFunction).toContain('supabase.from("job_departments")');
    expect(sendStaffingEmailFunction).not.toContain("            department,\n            start_time");
    expect(staffingPushEvents).toContain("typeof body.department === 'string' ? body.department.trim() : ''");
    expect(staffingPushEvents).toContain("bodyDepartment || jobDepartment");
    expect(staffingPushFunction).toContain("resolveStaffingDepartment");
    expect(staffingPushFunction).toContain("filterStaffingRoutesForDepartment");
    expect(staffingPushFunction).toContain("getStaffingRoutingManagementIds");
    expect(staffingHook).not.toContain("Fan out push notification");
  });

  it("prioritizes confirmed assisted availability before auto mode contacts new candidates", () => {
    expect(staffingOrchestratorFunction).toContain("assisted_handoff_priority");
    expect(staffingOrchestratorFunction).toContain("normalizeCampaignPolicy");
    expect(staffingOrchestratorFunction).toContain("selected_job_profile");
    expect(staffingOrchestratorFunction).toContain("role_profiles");
    expect(staffingOrchestratorFunction).toContain("cost_scoring");
    expect(staffingOrchestratorFunction).toContain("waveWaitSeconds");
    expect(staffingOrchestratorFunction).toContain("confirmedAvailabilityRowsForJob");
    expect(staffingOrchestratorFunction).toContain("confirmedAvailabilityByRequestedRole");
    expect(staffingOrchestratorFunction).toContain(".order('created_at', { ascending: false })");
    expect(staffingOrchestratorFunction).toContain("const confirmedAvailabilityRows = matchingRequestedRole");
    expect(staffingOrchestratorFunction).toContain("offerRequestProfilesForJob");
    expect(staffingOrchestratorFunction).toContain("phase: 'offer'");
    expect(staffingOrchestratorFunction).toContain("require_no_conflicts: true");
    expect(staffingOrchestratorFunction).toContain("auto_actions");
  });

  it("lets auto mode send availability waves from the same ranked candidate workflow", () => {
    expect(staffingOrchestratorFunction).toContain("rank_staffing_candidates");
    expect(staffingOrchestratorFunction).toContain("phase: 'availability'");
    expect(staffingOrchestratorFunction).toContain("idempotency_key: `campaign:${campaign_id}:${roleCode}:${profileId}:availability:auto:${autoChannel}`");
    expect(staffingOrchestratorFunction).toContain("contactedProfilesByRole");
    expect(staffingOrchestratorFunction).toContain("wave_number: nextWaveNumber");
  });

  it("executes auto mode immediately and keeps future waves scheduled", () => {
    expect(staffingOrchestratorFunction).toContain("normalizedMode === 'auto'");
    expect(staffingOrchestratorFunction).toContain("initialTickResult = await tickCampaign(supabase, campaign.id)");
    expect(staffingOrchestratorFunction).toContain("const tickResult = await tickCampaign(supabase, campaign_id)");
    expect(staffingSweeperScheduleMigration).toContain("CREATE OR REPLACE FUNCTION public.invoke_staffing_sweeper()");
    expect(staffingSweeperScheduleMigration).toContain("'/functions/v1/staffing-sweeper'");
    expect(staffingSweeperScheduleMigration).toContain("PERFORM cron.schedule(");
    expect(staffingSweeperScheduleMigration).toContain("'* * * * *'");
  });
});
