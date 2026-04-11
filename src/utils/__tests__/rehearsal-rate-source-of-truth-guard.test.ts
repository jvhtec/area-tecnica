import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("rehearsal-rate source-of-truth migration guard", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "supabase",
    "migrations",
    "20260411130000_unify_rehearsal_rate_source_of_truth.sql",
  );
  const migration = readFileSync(migrationPath, "utf-8");

  it("backfills rehearsal toggle rows from scheduled dates and persisted timesheet dates", () => {
    expect(migration).toMatch(/INSERT INTO public\.job_rehearsal_dates \(job_id, date\)/i);
    expect(migration).toMatch(/generate_series\(/i);
    expect(migration).toMatch(/UNION/i);
    expect(migration).toMatch(/FROM public\.timesheets t/i);
    expect(migration).toMatch(/SELECT\s+t\.job_id,\s+t\.date/i);
    expect(migration).toMatch(/t\.date IS NOT NULL/i);
    expect(migration).toMatch(/ON CONFLICT \(job_id, date\) DO NOTHING/i);
  });
});
