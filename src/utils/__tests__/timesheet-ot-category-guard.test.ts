import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('timesheet OT category regression guard', () => {
  const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const targetMigrationName = '20260303130950_house_tech_overtime_by_category.sql';
  const computeTimesheetAmountDefinitionPattern =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?public"?\.)?"?compute_timesheet_amount_2025"?\s*\(/i;
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  it('adds overtime category columns to custom_tech_rates', () => {
    expect(migrationFiles.includes(targetMigrationName)).toBe(true);
    const content = readFileSync(join(migrationsDir, targetMigrationName), 'utf-8');
    expect(content).toMatch(/ADD COLUMN IF NOT EXISTS overtime_hour_especialista_eur/i);
    expect(content).toMatch(/ADD COLUMN IF NOT EXISTS overtime_hour_responsable_eur/i);
  });

  it('maps house-tech legacy OT with 15 -> 20 responsable rule', () => {
    const content = readFileSync(join(migrationsDir, targetMigrationName), 'utf-8');
    expect(content).toMatch(/p\.role\s*=\s*'house_tech'/i);
    expect(content).toMatch(/overtime_hour_especialista_eur\s*=\s*COALESCE\([^)]*overtime_hour_eur/i);
    expect(content).toMatch(/CASE[\s\S]*overtime_hour_eur\s*=\s*15(?:\.00)?[\s\S]*THEN\s*20(?:\.00)?/i);
  });

  it('latest compute_timesheet_amount_2025 migration preserves category-aware OT logic', () => {
    const functionMigrations = migrationFiles
      .map((name) => ({
        name,
        content: readFileSync(join(migrationsDir, name), 'utf-8'),
      }))
      .filter((m) => computeTimesheetAmountDefinitionPattern.test(m.content));

    expect(functionMigrations.length).toBeGreaterThan(0);

    const latest = functionMigrations[functionMigrations.length - 1];

    const codeOnly = latest.content
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(codeOnly).toMatch(/v_is_house_tech\s+AND\s+v_category\s*=\s*'especialista'/i);
    expect(codeOnly).toMatch(/v_is_house_tech\s+AND\s+v_category\s*=\s*'responsable'/i);
    expect(codeOnly).toMatch(/overtime_hour_especialista_eur/i);
    expect(codeOnly).toMatch(/overtime_hour_responsable_eur/i);
    expect(codeOnly).toMatch(/CASE\s+WHEN\s+ctr\.overtime_hour_eur\s*=\s*15(?:\.00)?\s+THEN\s+20(?:\.00)?/i);
    expect(codeOnly).toMatch(/p\.role\s*=\s*'house_tech'/i);
  });

  it('the OT-category migration keeps the targeted persisted-timesheet backfill', () => {
    const content = readFileSync(join(migrationsDir, targetMigrationName), 'utf-8');

    expect(content).toMatch(/amount_breakdown->>'overtime_hours'/i);
    expect(content).toMatch(/PERFORM public\.compute_timesheet_amount_2025\(rec\.id,\s*true\)/i);
  });
});
