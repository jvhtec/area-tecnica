import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Writer inventory (Matrix hardening Phase C/G). Every app and edge-function
// source that writes job_assignments/timesheets or calls an assignment-writing
// RPC must appear, with a reason, in assignment-writers.allowlist.json. A new
// writer, a new kind of write in a listed file, or a stale entry fails here.

const ASSIGNMENT_RPCS = [
  'apply_direct_assignment',
  'remove_direct_assignment',
  'remove_assignment_date',
  'change_assignment_role',
  'set_assignment_status',
  'unconfirm_assignment',
  'assign_staffing_offer',
  'toggle_timesheet_day',
  'remove_assignment_with_timesheets',
  'manage_assignment_lifecycle',
];
const TABLES = 'job_assignments|timesheets';
const WRITE = 'insert|update|delete|upsert';

/** A write chained on the table builder anywhere in the same statement. */
const CHAINED_WRITE = new RegExp(`from\\(\\s*['"\`](${TABLES})['"\`]\\s*\\)[^;]*?\\.\\s*(${WRITE})\\s*\\(`, 'gs');
/** A builder kept in a variable and written later. */
const BUILDER_BINDING = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*[^;]*?from\\(\\s*['"\`](${TABLES})['"\`]\\s*\\)`, 'gs');
const RPC_CALL = new RegExp(`rpc\\(\\s*['"\`](${ASSIGNMENT_RPCS.join('|')})['"\`]`, 'g');

const repoRoot = process.cwd();
const allowlist = JSON.parse(readFileSync(join(repoRoot, 'tests/assignments/assignment-writers.allowlist.json'), 'utf8')) as {
  writers: Record<string, { writes: string[]; reason: string }>;
};

export function findAssignmentWrites(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(CHAINED_WRITE)) found.add(`${match[2]}:${match[1]}`);
  for (const binding of source.matchAll(BUILDER_BINDING)) {
    const write = new RegExp(`\\b${binding[1]}\\s*\\.\\s*(${WRITE})\\s*\\(`, 'g');
    for (const match of source.slice(binding.index ?? 0).matchAll(write)) found.add(`${match[1]}:${binding[2]}`);
  }
  for (const match of source.matchAll(RPC_CALL)) found.add(`rpc:${match[1]}`);
  return [...found].sort();
}

const sourceFiles = execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx', 'supabase/functions/**/*.ts'], {
  cwd: repoRoot, encoding: 'utf8',
}).split('\n').filter(Boolean)
  .filter((file) => !/(__tests__|\.test\.|\.spec\.|^src\/test\/|^src\/integrations\/supabase\/types\.ts$)/.test(file));

describe('assignment writer inventory', () => {
  const actual = new Map<string, string[]>();
  for (const file of sourceFiles) {
    const writes = findAssignmentWrites(readFileSync(join(repoRoot, file), 'utf8'));
    if (writes.length > 0) actual.set(file, writes);
  }

  it('every writer is listed with exactly the writes it performs', () => {
    const unlisted = [...actual.entries()]
      .map(([file, writes]) => [file, writes.filter((write) => !(allowlist.writers[file]?.writes ?? []).includes(write))] as const)
      .filter(([, extra]) => extra.length > 0);
    expect(unlisted, 'new assignment writers must use the command layer or be added to the allowlist with a reason').toEqual([]);
  });

  it('no allowlist entry is stale', () => {
    const stale = Object.entries(allowlist.writers)
      .map(([file, entry]) => [file, entry.writes.filter((write) => !(actual.get(file) ?? []).includes(write))] as const)
      .filter(([, missing]) => missing.length > 0);
    expect(stale, 'remove allowlist entries for writes that no longer exist').toEqual([]);
  });

  it('every allowlist entry explains itself', () => {
    for (const [file, entry] of Object.entries(allowlist.writers)) {
      expect(entry.reason.trim().length, file).toBeGreaterThan(20);
    }
  });

  it('only the command layer calls the assignment command RPCs', () => {
    const commandRpcs = ['apply_direct_assignment', 'remove_direct_assignment', 'remove_assignment_date', 'change_assignment_role', 'set_assignment_status', 'unconfirm_assignment'];
    const callers = [...actual.entries()]
      .filter(([, writes]) => writes.some((write) => commandRpcs.includes(write.replace('rpc:', ''))))
      .map(([file]) => file);
    expect(callers).toEqual(['src/features/assignments/commands/client.ts']);
  });

  it('detects writes through chained filters, backticks and stored builders', () => {
    expect(findAssignmentWrites("supabase.from(`timesheets`).select('id').eq('x', 1).update({ a: 1 })")).toEqual(['update:timesheets']);
    expect(findAssignmentWrites("const q = supabase.from('job_assignments');\nawait q.delete().eq('id', 1);")).toEqual(['delete:job_assignments']);
    expect(findAssignmentWrites("await dataLayerClient.rpc('toggle_timesheet_day', {})")).toEqual(['rpc:toggle_timesheet_day']);
    expect(findAssignmentWrites("supabase.from('timesheets').select('date').eq('job_id', id);")).toEqual([]);
  });
});
