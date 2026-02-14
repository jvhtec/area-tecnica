import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Regression guard: the compute_timesheet_amount_2025 SQL function must round
 * worked hours to the nearest WHOLE number via ROUND(v_worked_hours).
 *
 * The half-hour formula  ROUND(v_worked_hours * 2) / 2.0  has regressed
 * multiple times because new migrations copy the previous function body.
 * This test scans every migration that defines the function and ensures the
 * wrong pattern is not present.
 */
describe('timesheet rounding regression guard', () => {
  const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Find the LAST migration that defines compute_timesheet_amount_2025
  // (CREATE OR REPLACE means the last one wins at runtime)
  const functionMigrations = migrationFiles
    .map((f) => ({
      name: f,
      content: readFileSync(join(migrationsDir, f), 'utf-8'),
    }))
    .filter((f) => f.content.includes('compute_timesheet_amount_2025'));

  it('should have at least one migration defining compute_timesheet_amount_2025', () => {
    expect(functionMigrations.length).toBeGreaterThan(0);
  });

  it('the latest migration must NOT use half-hour rounding (ROUND(x * 2) / 2)', () => {
    const latest = functionMigrations[functionMigrations.length - 1];
    // Strip SQL comments (-- ...) before checking, so comments describing the
    // old formula don't trigger a false positive.
    const codeOnly = latest.content
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    const hasHalfHourRounding = /ROUND\s*\(\s*v_worked_hours\s*\*\s*2\s*\)\s*\/\s*2/i.test(
      codeOnly,
    );

    expect(
      hasHalfHourRounding,
      `Migration ${latest.name} uses half-hour rounding (ROUND(v_worked_hours * 2) / 2.0). ` +
        `This is WRONG. Use ROUND(v_worked_hours) for whole-hour rounding. ` +
        `See: supabase/migrations/20260208120000_fix_timesheet_rounding_whole_hours.sql`,
    ).toBe(false);
  });

  it('the latest migration must use whole-hour rounding: ROUND(v_worked_hours)', () => {
    const latest = functionMigrations[functionMigrations.length - 1];
    const hasWholeHourRounding = /v_worked_hours\s*:=\s*ROUND\s*\(\s*v_worked_hours\s*\)/i.test(
      latest.content,
    );

    expect(
      hasWholeHourRounding,
      `Migration ${latest.name} does not contain "v_worked_hours := ROUND(v_worked_hours)". ` +
        `Timesheet hours MUST be rounded to the nearest whole number.`,
    ).toBe(true);
  });
});
