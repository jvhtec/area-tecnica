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

  it('latest compute_tour_job_rate_quote_2025 migration applies the standard tour multiplier once per quote, not once per standard day', () => {
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

    expect(codeOnly).toMatch(/standard_multiplier_bonus numeric\(10,2\) := 0/i);
    expect(codeOnly).toMatch(/multiplied_standard_days int := 0/i);
    expect(codeOnly).toMatch(/standard_day_rate := ROUND\(standard_base,\s*2\)/i);
    expect(codeOnly).toMatch(/standard_multiplier_bonus := ROUND\(standard_after_discount \* \(per_job_multiplier - 1\.0\),\s*2\)/i);
    expect(codeOnly).toMatch(/standard_total := ROUND\(\(standard_day_rate \* standard_days\) \+ standard_multiplier_bonus,\s*2\)/i);
    expect(codeOnly).toMatch(/'multiplied_standard_days', multiplied_standard_days/i);
    expect(codeOnly).toMatch(/'standard_multiplier_bonus_eur', standard_multiplier_bonus/i);
  });
});
