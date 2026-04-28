import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('tour job quote schedule-range regression guard', () => {
  const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const computeTourQuoteDefinitionPattern =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?public"?\.)?"?compute_tour_job_rate_quote_2025"?\s*\(/i;
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  it('latest compute_tour_job_rate_quote_2025 migration derives multi-day span from job_date_types and prices only assigned technician dates', () => {
    const functionMigrations = migrationFiles
      .map((name) => ({
        name,
        content: readFileSync(join(migrationsDir, name), 'utf-8'),
      }))
      .filter((migration) => computeTourQuoteDefinitionPattern.test(migration.content));

    expect(functionMigrations.length).toBeGreaterThan(0);

    const latest = functionMigrations[functionMigrations.length - 1];
    const codeOnly = latest.content
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(codeOnly).toMatch(/SELECT MIN\(jdt\.date\), MAX\(jdt\.date\)/i);
    expect(codeOnly).toMatch(/FROM public\.job_date_types jdt/i);
    expect(codeOnly).toMatch(/schedule_start := COALESCE\(\s*job_date_type_start,\s*tour_date_start,\s*job_start_date,\s*tour_date_legacy_date/i);
    expect(codeOnly).toMatch(/schedule_end := COALESCE\(\s*job_date_type_end,\s*tour_date_end,\s*job_end_date,\s*tour_date_start,\s*tour_date_legacy_date,\s*job_start_date/i);
    expect(codeOnly).toMatch(/WITH active_timesheet_dates AS \(/i);
    expect(codeOnly).toMatch(/SELECT DISTINCT t\.date AS payable_date/i);
    expect(codeOnly).toMatch(/FROM public\.timesheets t/i);
    expect(codeOnly).toMatch(/AND COALESCE\(t\.is_active,\s*TRUE\)/i);
    expect(codeOnly).toMatch(/fallback_assignment_dates AS \(/i);
    expect(codeOnly).toMatch(/COALESCE\(ja\.single_day,\s*FALSE\)/i);
    expect(codeOnly).toMatch(/fallback_schedule_dates AS \(/i);
    expect(codeOnly).toMatch(/FROM payable_dates pd/i);
    expect(codeOnly).toMatch(/COUNT\(\*\)::int,\s*COUNT\(\*\) FILTER/i);
    expect(codeOnly).toMatch(/has_override := COALESCE\(has_override,\s*FALSE\)/i);
    expect(codeOnly).toMatch(/SELECT COALESCE\(\s*EXISTS\s*\(/i);
    expect(codeOnly).toMatch(/team_member := COALESCE\(team_member,\s*FALSE\)/i);
  });
});
