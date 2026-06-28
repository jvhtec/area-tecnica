import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("technician/date rate-mode migration guard", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "supabase",
    "migrations",
    "20260411223000_add_admin_only_technician_rate_modes.sql",
  );
  const migration = readFileSync(migrationPath, "utf-8");
  const expandedMigration = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "..",
      "supabase",
      "migrations",
      "20260628120000_expand_technician_rate_modes.sql",
    ),
    "utf-8",
  );

  it("creates an admin-only technician/date override table", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.job_technician_rate_mode_dates/i);
    expect(migration).toMatch(/created_at timestamptz NOT NULL DEFAULT now\(\)/i);
    expect(migration).toMatch(/created_by uuid NULL DEFAULT auth\.uid\(\)/i);
    expect(migration).toMatch(/updated_at timestamptz NOT NULL DEFAULT now\(\)/i);
    expect(migration).toMatch(/updated_by uuid NULL DEFAULT auth\.uid\(\)/i);
    expect(migration).toMatch(/ALTER TABLE public\.job_technician_rate_mode_dates ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/FOR SELECT[\s\S]*USING \(public\.is_admin\(\)\)/i);
    expect(migration).toMatch(/FOR INSERT[\s\S]*WITH CHECK \(public\.is_admin\(\)\)/i);
    expect(migration).toMatch(/FOR UPDATE[\s\S]*USING \(public\.is_admin\(\)\)[\s\S]*WITH CHECK \(public\.is_admin\(\)\)/i);
    expect(migration).toMatch(/FOR DELETE[\s\S]*USING \(public\.is_admin\(\)\)/i);
  });

  it("touches updated_at and updated_by on database-side updates", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.tg_job_technician_rate_mode_dates_touch\(\)/i);
    expect(migration).toMatch(/NEW\.updated_at := now\(\)/i);
    expect(migration).toMatch(/NEW\.updated_by := COALESCE\(auth\.uid\(\), NEW\.updated_by, OLD\.updated_by\)/i);
    expect(migration).toMatch(/CREATE TRIGGER trg_job_technician_rate_mode_dates_touch/i);
    expect(migration).toMatch(/BEFORE UPDATE ON public\.job_technician_rate_mode_dates/i);
  });

  it("gives technician/date overrides precedence over job-wide rehearsal dates in both pricing functions", () => {
    expect(migration).toMatch(/FROM public\.job_technician_rate_mode_dates trmd[\s\S]*technician_id = v_timesheet\.technician_id/i);
    expect(migration).toMatch(/v_rate_mode_source := 'technician_override'/i);
    expect(migration).toMatch(/COALESCE\(trmd\.use_rehearsal_rate,\s*jrd\.job_id IS NOT NULL\)/i);
    expect(migration).toMatch(/technician_override_days/i);
  });

  it("guards expanded fixed/hourly rate modes from unsafe payout states", () => {
    expect(expandedMigration).toMatch(/rate_mode IN \('rehearsal','standard','tour_multipliers','no_multipliers','hourly','fixed'\)/i);
    expect(expandedMigration).toMatch(/ALTER COLUMN rate_mode DROP DEFAULT/i);
    expect(expandedMigration).toMatch(/tg_job_technician_rate_mode_dates_sync_legacy/i);
    expect(expandedMigration).toMatch(/WHEN COALESCE\(NEW\.use_rehearsal_rate, FALSE\) THEN 'rehearsal'/i);
    expect(expandedMigration).toMatch(/WHEN COALESCE\(trmd\.use_rehearsal_rate, FALSE\) THEN 'rehearsal'/i);
    expect(expandedMigration).toMatch(/fixed_amount_eur IS NOT NULL AND fixed_amount_eur >= 0/i);
    expect(expandedMigration).toMatch(/RAISE EXCEPTION 'Invalid fixed amount for timesheet %'/i);
    expect(expandedMigration).toMatch(/COUNT\(\*\) FILTER \(WHERE cpd\.eff_mode = 'hourly'\)::int/i);
    expect(expandedMigration).toMatch(/COUNT\(\*\) FILTER \(WHERE cpd\.eff_mode = 'fixed'\)::int/i);
    expect(expandedMigration).toMatch(/'hourly_total_eur', hourly_total/i);
    expect(expandedMigration).toMatch(/'fixed_total_eur', fixed_total/i);
  });
});
