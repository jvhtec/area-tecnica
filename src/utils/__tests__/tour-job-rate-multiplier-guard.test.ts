import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('tour job quote multiplier regression guard', () => {
  const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const computeTourQuoteDefinitionPattern =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?public"?\.)?"?compute_tour_job_rate_quote_2025"?\s*\(/i;
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  function latestTourQuoteMigration() {
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

    return { latest, codeOnly };
  }

  it('latest compute_tour_job_rate_quote_2025 migration applies the standard tour multiplier to each eligible tour date', () => {
    const { codeOnly } = latestTourQuoteMigration();

    expect(codeOnly).toMatch(/standard_multiplier_bonus numeric\(10,2\) := 0/i);
    expect(codeOnly).toMatch(/multiplied_standard_days int := 0/i);
    expect(codeOnly).toMatch(/date_multipliers AS/i);
    expect(codeOnly).toMatch(/SUM\(standard_after_discount \* dm\.date_multiplier\)/i);
    expect(codeOnly).toMatch(/SUM\(\(standard_after_discount \* dm\.date_multiplier\) - standard_after_discount\)/i);
    expect(codeOnly).toMatch(/COUNT\(\*\) FILTER \(WHERE dm\.date_multiplier > 1\.0\)::int/i);
    expect(codeOnly).toMatch(/'multiplied_standard_days', multiplied_standard_days/i);
    expect(codeOnly).toMatch(/'standard_multiplier_bonus_eur', standard_multiplier_bonus/i);
    expect(codeOnly).toMatch(/'per_payable_date_weekly_multipliers', true/i);
  });

  it('keeps expanded typed tour dates as the payable source of truth instead of shrinking to partial timesheets', () => {
    const { codeOnly } = latestTourQuoteMigration();

    expect(codeOnly).toMatch(/raw_scheduled_job_date_type_dates AS/i);
    expect(codeOnly).toMatch(/scheduled_job_date_type_dates AS/i);
    expect(codeOnly).toMatch(/active_timesheet_dates AS/i);
    expect(codeOnly).toMatch(/SELECT payable_date\s+FROM active_timesheet_dates\s+UNION\s+SELECT payable_date\s+FROM single_day_assignment_dates\s+UNION\s+SELECT payable_date\s+FROM scheduled_job_date_type_dates/is);
    expect(codeOnly).toMatch(/fallback_schedule_dates AS \([\s\S]*?WHERE NOT EXISTS \(SELECT 1 FROM raw_scheduled_job_date_type_dates\)/i);
    expect(codeOnly).not.toMatch(/fallback_schedule_dates AS \([\s\S]*?WHERE NOT EXISTS \(SELECT 1 FROM scheduled_job_date_type_dates\)/i);
  });

  it('does not let unassigned rigging dates count for every technician', () => {
    const { codeOnly } = latestTourQuoteMigration();

    expect(codeOnly).toMatch(/raw\.type <> 'rigging'/i);
    expect(codeOnly).toMatch(/rja\.technician_id = _tech_id[\s\S]*?COALESCE\(rja\.single_day, FALSE\)[\s\S]*?rja\.assignment_date = raw\.payable_date/i);
    expect(codeOnly).toMatch(/rt\.job_id = _job_id[\s\S]*?rt\.technician_id = _tech_id[\s\S]*?rt\.date = raw\.payable_date[\s\S]*?COALESCE\(rt\.is_active, TRUE\)/i);
    expect(codeOnly).toMatch(/NOT COALESCE\(ja\.single_day, FALSE\)[\s\S]*?AND pd\.type <> 'rigging'/i);
    expect(codeOnly).toMatch(/COALESCE\(ja\.single_day, FALSE\) AND ja\.assignment_date = pd\.date/i);
    expect(codeOnly).toMatch(/'rigging_dates_scoped_to_assigned_techs', true/i);
  });

  it('counts weekly multipliers by payable date week, not by the tour job start week', () => {
    const { codeOnly } = latestTourQuoteMigration();

    expect(codeOnly).toMatch(/CROSS JOIN LATERAL public\.iso_year_week_madrid\(spd\.payable_date::timestamptz\) iw/i);
    expect(codeOnly).toMatch(/CROSS JOIN LATERAL public\.iso_year_week_madrid\(pd\.date::timestamptz\) other_iw/i);
    expect(codeOnly).toMatch(/other_iw\.iso_year = iw\.iso_year/i);
    expect(codeOnly).toMatch(/other_iw\.iso_week = iw\.iso_week/i);
    expect(codeOnly).not.toMatch(/iso_year_week_madrid\(j\.start_time\)/i);
  });
});
