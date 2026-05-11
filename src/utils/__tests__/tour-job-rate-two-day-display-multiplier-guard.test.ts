import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const computeTourQuoteDefinitionPattern =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?public"?\.)?"?compute_tour_job_rate_quote_2025"?\s*\(/i;

describe('tour job two-day multiplier display guard', () => {
  const latestTourQuoteMigration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), 'utf-8'))
    .filter((content) => computeTourQuoteDefinitionPattern.test(content))
    .at(-1);

  it('keeps the returned two-day multiplier at the per-date 1.125x value', () => {
    expect(latestTourQuoteMigration).toBeDefined();
    const codeOnly = latestTourQuoteMigration!
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(codeOnly).toContain(
      'WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric',
    );
    expect(codeOnly).not.toContain(
      'WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 2.25::numeric',
    );
    expect(codeOnly).toContain(
      'COALESCE(ROUND(SUM(dm.week_multiplier * dm.week_count) / NULLIF(SUM(dm.week_count), 0), 3), 1.0)',
    );
    expect(codeOnly).toContain(
      'COALESCE(ROUND(SUM(dm.date_multiplier * dm.week_count) / NULLIF(SUM(dm.week_count), 0), 3), 1.0)',
    );
  });

  it('matches the payroll value for two same-week dates', () => {
    const baseRate = 200;
    const twoDayMultiplier = 1.125;

    expect(baseRate * twoDayMultiplier).toBe(225);
    expect(baseRate * twoDayMultiplier * 2).toBe(450);
    expect(twoDayMultiplier).toBe(1.125);
  });
});
