import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("tour cancellation migration guard", () => {
  const migration = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "..",
      "supabase",
      "migrations",
      "20260629120000_limit_tour_cancellation_to_future_jobs.sql",
    ),
    "utf-8",
  );
  const codeOnly = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("cascades cancellation only to future non-completed tour jobs", () => {
    expect(codeOnly).toMatch(/CREATE OR REPLACE FUNCTION public\.cascade_tour_cancellation\(\)/i);
    expect(codeOnly).toMatch(/j\.start_time > now\(\)/i);
    expect(codeOnly).toMatch(/j\.status NOT IN \(\s*'Cancelado'::public\.job_status,\s*'Completado'::public\.job_status\s*\)/i);
  });

  it("repairs only past cancelled jobs with status history or worked timesheet evidence", () => {
    expect(codeOnly).toMatch(/WITH worked_cancelled_past_tour_jobs AS/i);
    expect(codeOnly).toMatch(/j\.end_time <= now\(\)/i);
    expect(codeOnly).toMatch(/FROM public\.activity_log al/i);
    expect(codeOnly).toMatch(/al\.payload #>> '\{diff,status,from\}' = 'Completado'/i);
    expect(codeOnly).toMatch(/al\.payload #>> '\{diff,status,to\}' = 'Cancelado'/i);
    expect(codeOnly).toMatch(/ts\.status IN \(\s*'submitted'::public\.timesheet_status,\s*'approved'::public\.timesheet_status\s*\)/i);
    expect(codeOnly).toMatch(/COALESCE\(ts\.is_schedule_only, false\) = false/i);
  });
});
