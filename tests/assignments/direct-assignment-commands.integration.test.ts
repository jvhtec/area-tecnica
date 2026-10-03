import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PsqlSession, waitUntilBlocked } from './helpers/psqlSession';

// Destructive opt-in test on the disposable CI database (or an explicitly
// named local container). Real psql backends hold real transactions so each
// race below is a genuine lock wait, not a mocked interleaving.
const container = process.env.STAFFING_TEST_DB_CONTAINER;
const permitted = Boolean(container) && (
  (process.env.GITHUB_ACTIONS === 'true' && container === 'supabase_db_syldobdcdsgfgjtbuwxm')
  || process.env.ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL === container
);

type CommandResult = {
  ok: boolean;
  outcome: 'committed' | 'noop' | 'rejected';
  code?: string;
  replayed: boolean;
  state_token: string;
  dates: string[];
  assignment: { status: string } | null;
};

const sql = (value: string | null) => (value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`);

describe.skipIf(!permitted)('assignment commands under real concurrency', () => {
  let observer: PsqlSession;
  const techId = randomUUID();
  const jobs = Array.from({ length: 8 }, () => randomUUID());

  const session = async (name: string) => {
    const s = new PsqlSession(container!);
    await s.query(`SET application_name = '${name}'; SET statement_timeout = '15s'; SET lock_timeout = '10s';
      SET request.jwt.claim.role = 'service_role'; SET ROLE service_role;`);
    return s;
  };

  const applyCall = (args: {
    command?: string; job: string; dates: string[]; token?: string | null; policy?: 'reject' | 'allow';
    from?: string | null; status?: 'invited' | 'confirmed'; role?: string;
  }) => `SELECT public.apply_direct_assignment(${sql(args.command ?? randomUUID())}, ${sql(args.job)}, ${sql(techId)},
      ${sql(args.role ?? 'SND-FOH-R')}, ${sql(args.status ?? 'invited')}, 'multi', ARRAY[${args.dates.map(sql).join(',')}]::date[],
      'replace', ${sql(args.token ?? null)}, ${sql(args.from ?? null)}, NULL, ${sql(args.policy ?? 'reject')}, 'assignment-dialog', NULL, '{}'::jsonb);`;

  const parse = (output: string): CommandResult => JSON.parse(output.split('\n').filter(Boolean).at(-1)!);

  const tokenFor = async (job: string) => observer.query(
    `SELECT public.assignment_state_token(${sql(job)}, ${sql(techId)});`);

  const scheduleOf = async (job: string) => observer.query(`SELECT COALESCE(string_agg(date::text, ',' ORDER BY date), '')
    FROM public.timesheets WHERE job_id = ${sql(job)} AND technician_id = ${sql(techId)} AND is_active;`);

  /** Runs `first` inside an open transaction, races `second` against it, then commits. */
  async function race(first: string, second: (s: PsqlSession) => Promise<string>) {
    const name = randomUUID().slice(0, 8);
    const a = await session(`cmd-a-${name}`);
    const b = await session(`cmd-b-${name}`);
    try {
      const firstOutput = await a.query(`BEGIN; ${first}`);
      const secondPromise = second(b);
      const settled = Promise.allSettled([secondPromise]);
      await waitUntilBlocked(observer, `cmd-b-${name}`, `cmd-a-${name}`);
      await a.query('COMMIT;');
      const [secondResult] = await settled;
      if (secondResult.status === 'rejected') throw secondResult.reason;
      return { first: firstOutput, second: secondResult.value };
    } finally {
      await a.query('ROLLBACK;').catch(() => undefined);
      await Promise.all([a.close(), b.close()]);
    }
  }

  beforeAll(async () => {
    observer = new PsqlSession(container!);
    await observer.query(`SET statement_timeout = '15s'; SET request.jwt.claim.role = 'service_role';
      INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
      SELECT code, code, 'management', 'info', false
      FROM unnest(ARRAY['job.created', 'assignment.created', 'assignment.updated', 'assignment.removed']) code
      ON CONFLICT (code) DO NOTHING;
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
        VALUES (${sql(techId)}, '${techId}@test.local', '{}', '{}', 'authenticated', 'authenticated');
      INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
        VALUES (${sql(techId)}, '${techId}@test.local', 'Command', 'Race', 'technician', 'sound')
        ON CONFLICT (id) DO UPDATE SET department = 'sound';
      INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
      SELECT j, 'Disposable command race', '2026-12-01 08:00+01', '2026-12-04 20:00+01', 'single', 'Confirmado'
      FROM unnest(ARRAY[${jobs.map(sql).join(',')}]::uuid[]) j;`);
  });

  afterAll(async () => {
    await observer.query(`DELETE FROM public.jobs WHERE id = ANY(ARRAY[${jobs.map(sql).join(',')}]::uuid[]);
      DELETE FROM public.assignment_commands WHERE technician_id = ${sql(techId)};
      DELETE FROM auth.users WHERE id = ${sql(techId)};`);
    await observer.close();
  });

  it('two managers with the same loaded state: the second is rejected as stale, not overwritten', async () => {
    const token = await tokenFor(jobs[0]);
    const { first, second } = await race(
      applyCall({ job: jobs[0], dates: ['2026-12-01'], token, role: 'SND-FOH-R' }),
      s => s.query(applyCall({ job: jobs[0], dates: ['2026-12-02'], token, role: 'SND-MON-E' })),
    );
    expect(parse(first).outcome).toBe('committed');
    expect(parse(second)).toMatchObject({ ok: false, code: 'stale_state' });
    expect(await scheduleOf(jobs[0])).toBe('2026-12-01');
    expect(await observer.query(`SELECT sound_role FROM public.job_assignments WHERE job_id = ${sql(jobs[0])};`)).toBe('SND-FOH-R');
  });

  it('two managers booking one technician on different jobs for the same day cannot both commit', async () => {
    const { first, second } = await race(
      applyCall({ job: jobs[1], dates: ['2026-12-03'] }),
      s => s.query(applyCall({ job: jobs[2], dates: ['2026-12-03'] })),
    );
    expect(parse(first).outcome).toBe('committed');
    expect(parse(second)).toMatchObject({ ok: false, code: 'conflict' });
    expect(await scheduleOf(jobs[2])).toBe('');
  });

  it('a concurrent retry of the same command replays the committed result once', async () => {
    const command = randomUUID();
    const { first, second } = await race(
      applyCall({ command, job: jobs[3], dates: ['2026-12-01', '2026-12-02'], policy: 'allow' }),
      s => s.query(applyCall({ command, job: jobs[3], dates: ['2026-12-01', '2026-12-02'], policy: 'allow' })),
    );
    expect(parse(first)).toMatchObject({ outcome: 'committed', replayed: false });
    expect(parse(second)).toMatchObject({ outcome: 'committed', replayed: true, state_token: parse(first).state_token });
    expect(await observer.query(`SELECT count(*) FROM public.assignment_commands WHERE command_id = ${sql(command)};`)).toBe('1');
    expect(await scheduleOf(jobs[3])).toBe('2026-12-01,2026-12-02');
  });

  it('direct assignment and offer acceptance serialize on the pair without a deadlock', async () => {
    const requestId = randomUUID();
    await observer.query(`INSERT INTO public.staffing_requests (id, job_id, profile_id, phase, status, token_hash, token_expires_at)
      VALUES (${sql(requestId)}, ${sql(jobs[4])}, ${sql(techId)}, 'offer', 'confirmed', 'hash', now() + interval '48 hours');`);
    const { first, second } = await race(
      applyCall({ job: jobs[4], dates: ['2026-12-01'], status: 'invited', policy: 'allow' }),
      s => s.query(`SELECT public.assign_staffing_offer(${sql(requestId)}, ARRAY['2026-12-02']::date[], false, 'SND-FOH-R');`),
    );
    expect(parse(first).outcome).toBe('committed');
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(await observer.query(`SELECT status FROM public.job_assignments WHERE job_id = ${sql(jobs[4])};`)).toBe('confirmed');
    expect(await scheduleOf(jobs[4])).toBe('2026-12-01,2026-12-02');
  });

  it('a move and a competing removal of the source never expose a half-move', async () => {
    await observer.query(applyCall({ job: jobs[5], dates: ['2026-12-04'], policy: 'allow' }));
    const fromToken = await tokenFor(jobs[5]);
    const { first, second } = await race(
      `SELECT public.apply_direct_assignment(${sql(randomUUID())}, ${sql(jobs[0])}, ${sql(techId)}, 'SND-FOH-R', 'invited', 'multi',
        ARRAY['2026-12-01','2026-12-04']::date[], 'add', NULL, ${sql(jobs[5])}, ${sql(fromToken)}, 'allow', 'assignment-dialog', NULL, '{}'::jsonb);`,
      s => s.query(`SELECT public.remove_direct_assignment(${sql(randomUUID())}, ${sql(jobs[5])}, ${sql(techId)}, ${sql(fromToken)});`),
    );
    expect(parse(first)).toMatchObject({ ok: true, outcome: 'committed' });
    expect(parse(second)).toMatchObject({ ok: false, code: 'stale_state' });
    expect(await observer.query(`SELECT count(*) FROM public.job_assignments WHERE job_id = ${sql(jobs[5])};`)).toBe('0');
    expect(await scheduleOf(jobs[5])).toBe('');
    expect(await scheduleOf(jobs[0])).toBe('2026-12-01,2026-12-04');
  });

  it('a manager confirmation and a same-day booking elsewhere cannot both commit', async () => {
    await observer.query(applyCall({ job: jobs[6], dates: ['2026-12-03'], policy: 'allow' }));
    // Clear the earlier same-day schedule so the confirmation alone is valid.
    await observer.query(`DELETE FROM public.job_assignments WHERE technician_id = ${sql(techId)}
      AND job_id <> ${sql(jobs[6])} AND job_id IN (SELECT job_id FROM public.timesheets WHERE technician_id = ${sql(techId)} AND date = '2026-12-03');`);
    const { first, second } = await race(
      applyCall({ job: jobs[7], dates: ['2026-12-03'], policy: 'allow' }),
      s => s.query(`SELECT public.set_assignment_status(${sql(randomUUID())}, ${sql(jobs[6])}, ${sql(techId)}, 'confirm');`),
    );
    expect(parse(first).outcome).toBe('committed');
    expect(parse(second)).toMatchObject({ ok: false, code: 'conflict' });
    expect(await observer.query(`SELECT status FROM public.job_assignments WHERE job_id = ${sql(jobs[6])};`)).toBe('invited');
  });
});
