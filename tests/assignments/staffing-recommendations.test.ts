import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260512090000_staffing_request_role_code_candidates.sql"),
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
