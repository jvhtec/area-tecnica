import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roleOptionsForDiscipline } from '@/types/roles';

// The assignment commands validate roles against public.assignment_role_codes,
// seeded by the migration below. It must mirror the client role registry, or
// the UI offers roles the database rejects (or the reverse).
const MIGRATION = 'supabase/migrations/20261003210000_atomic_direct_assignment_command.sql';

const seeded = () => {
  const sql = readFileSync(join(process.cwd(), MIGRATION), 'utf8');
  const insert = sql.match(/INSERT INTO public\.assignment_role_codes \(code, discipline, level\) VALUES([^;]+);/);
  if (!insert) throw new Error('assignment_role_codes seed not found');
  return [...insert[1].matchAll(/\('([^']+)', '([^']+)', '([^']+)'\)/g)]
    .map(([, code, discipline, level]) => `${discipline}:${code}:${level}`).sort();
};

describe('assignment role registry parity', () => {
  it('the database role registry matches src/types/roles.ts exactly', () => {
    const client = (['sound', 'lights', 'video', 'production'] as const)
      .flatMap((discipline) => roleOptionsForDiscipline(discipline).map((role) => `${role.discipline}:${role.code}:${role.level}`))
      .sort();
    expect(client.length).toBeGreaterThan(0);
    expect(seeded()).toEqual(client);
  });
});
