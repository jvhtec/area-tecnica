import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260605203000_scope_prep_day_timesheets_to_assignments.sql",
  "utf8",
);

describe("prep day timesheet scope migration", () => {
  it("creates prep-day timesheets only for assignments scoped to that prep date", () => {
    expect(migration).toMatch(/COALESCE\(ja\.single_day,\s*false\)/);
    expect(migration).toMatch(/ja\.assignment_date\s*=\s*_date/);
    expect(migration).toMatch(/ja\.assignment_date\s*=\s*t\.date/);
  });

  it("re-runs the assignment trigger when prep-day assignment scope changes", () => {
    expect(migration).toMatch(
      /AFTER INSERT OR UPDATE OF job_id, technician_id, status, single_day, assignment_date/i,
    );
    expect(migration).toMatch(/AFTER DELETE/i);
  });

  it("deactivates prep-day rows without a matching prep-day assignment", () => {
    expect(migration).toMatch(/deactivate_unassigned_prep_day_timesheet/);
    expect(migration).toMatch(/SET is_active = false/);
    expect(migration).toMatch(/jdt\.type = 'prep_day'/);
  });
});
