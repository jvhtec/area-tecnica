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

const sendStaffingEmailFunction = readFileSync(
  join(process.cwd(), "supabase/functions/send-staffing-email/index.ts"),
  "utf-8",
);

describe("staffing recommendation consultation guards", () => {
  it("stores a structured role_code on staffing requests", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS role_code text");
    expect(migration).toContain("NULLIF(BTRIM(se.meta->>'role'), '') AS role_code");
  });

  it("excludes active same-role requests but does not treat expired as active", () => {
    expect(migration).toMatch(/NULLIF\(BTRIM\(sr\.role_code\), ''\) = v_normalized_role_code/);
    expect(migration).toMatch(/sr\.phase IN \('availability', 'offer'\)/);
    expect(migration).toMatch(/sr\.status IN \('pending', 'confirmed', 'declined'\)/);
    expect(migration).not.toMatch(/sr\.status IN \('pending', 'confirmed', 'declined', 'expired'\)/);
  });

  it("keeps role-less requests eligible unless a declined request overlaps the job dates", () => {
    expect(migration).toMatch(/NULLIF\(BTRIM\(sr\.role_code\), ''\) IS NULL/);
    expect(migration).toMatch(/sr\.status = 'declined'/);
    expect(migration).toMatch(/sr\.single_day = false/);
    expect(migration).toMatch(/sr\.target_date BETWEEN v_job_start::date AND v_job_end::date/);
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

  it("filters hard collisions and unavailability before candidates are returned", () => {
    expect(smarterMigration).toMatch(/FROM technician_availability ta/);
    expect(smarterMigration).toMatch(/JOIN target_dates td ON td\.target_date = ta\.date/);
    expect(smarterMigration).toMatch(/FROM timesheets ts/);
    expect(smarterMigration).toMatch(/ts\.is_active = true/);
    expect(smarterMigration).toMatch(/j2\.time_range && tstzrange\(v_job_start, v_job_end, '\[\]'\)/);
    expect(smarterMigration).toMatch(/WHERE ja\.job_id = p_job_id\s+AND ja\.technician_id = p\.id/);
  });

  it("dedupes active same-role requests without treating expired requests as active", () => {
    expect(smarterMigration).toMatch(/NULLIF\(BTRIM\(sr\.role_code\), ''\) = v_normalized_role_code/);
    expect(smarterMigration).toMatch(/sr\.phase IN \('availability', 'offer'\)/);
    expect(smarterMigration).toMatch(/sr\.status IN \('pending', 'confirmed', 'declined'\)/);
    expect(smarterMigration).not.toMatch(/sr\.status IN \('pending', 'confirmed', 'declined', 'expired'\)/);
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
    expect(sendStaffingEmailFunction).toContain("roleless_declines");
    expect(sendStaffingEmailFunction).toContain("status: 409");
  });
});
