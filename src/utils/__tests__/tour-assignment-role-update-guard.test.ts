import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('tour assignment role update migration guard', () => {
  const migrationPath = join(
    __dirname,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260628121000_sync_tour_assignment_role_updates.sql',
  );
  const migration = readFileSync(migrationPath, 'utf-8');
  const codeOnly = migration
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  it('syncs role updates only to today-or-future tour-date jobs', () => {
    expect(codeOnly).toMatch(/CREATE OR REPLACE FUNCTION public\.sync_tour_assignment_role_update_to_future_jobs\(\)/i);
    expect(codeOnly).toMatch(/v_today date := \(now\(\) AT TIME ZONE 'Europe\/Madrid'\)::date/i);
    expect(codeOnly).toMatch(/j\.job_type = 'tourdate'/i);
    expect(codeOnly).toMatch(/COALESCE\([\s\S]*?jdt\.schedule_start[\s\S]*?td\.start_date[\s\S]*?j\.start_time AT TIME ZONE 'Europe\/Madrid'[\s\S]*?td\.date[\s\S]*?\) >= v_today/i);
    expect(codeOnly).toMatch(/INSERT INTO public\.job_assignments/i);
    expect(codeOnly).toMatch(/EXECUTE FUNCTION public\.sync_tour_assignment_role_update_to_future_jobs\(\)/i);
    expect(codeOnly).not.toMatch(/EXECUTE FUNCTION public\.sync_tour_assignments_to_jobs\(\)/i);
  });
});
