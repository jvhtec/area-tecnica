import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PsqlSession, waitUntilBlocked } from './helpers/psqlSession';

const container = process.env.STAFFING_TEST_DB_CONTAINER;
const permitted = Boolean(container) && (
  (process.env.GITHUB_ACTIONS === 'true' && container === 'supabase_db_syldobdcdsgfgjtbuwxm')
  || process.env.ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL === container
);
const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;
const parse = (output: string) => JSON.parse(output.split('\n').filter(Boolean).at(-1)!);

// Distinct PostgreSQL backends observe actual blockers, not simulated scheduling.
describe.skipIf(!permitted)('matrix undo under real transaction races', () => {
  let observer: PsqlSession;
  const tech = randomUUID();
  const jobs = Array.from({ length: 6 }, () => randomUUID());
  const session = async (name: string) => {
    const s = new PsqlSession(container!);
    await s.query(`SET application_name=${sql(name)}; SET statement_timeout='15s';
      SET lock_timeout='12s'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`);
    return s;
  };
  const fixture = async (index: number) => {
    const job = jobs[index], command = randomUUID(), inverse = randomUUID();
    const prior = parse(await observer.query(`SELECT public.get_assignment_command_state(${sql(job)},${sql(tech)});`));
    const result = parse(await observer.query(`SELECT public.apply_direct_assignment(${sql(command)},${sql(job)},${sql(tech)},
      'SND-FOH-R','invited','full',NULL,'replace',${sql(prior.state_token)},NULL,NULL,'reject','matrix-inspector');`));
    expect(result.ok).toBe(true);
    const undo = `SELECT public.undo_assignment_command(${sql(inverse)},${sql(command)},
      ${sql(result.state_token)},${sql(JSON.stringify(prior))}::jsonb);`;
    return { job, command, inverse, prior, result, undo };
  };
  async function race(first: string, second: string) {
    const tag = randomUUID().slice(0, 8);
    const aName = `undo-a-${tag}`, bName = `undo-b-${tag}`;
    const a = await session(aName), b = await session(bName);
    try {
      const firstOutput = await a.query(`BEGIN; ${first}`);
      const secondPromise = b.query(second);
      const settled = Promise.allSettled([secondPromise]);
      await waitUntilBlocked(observer, bName, aName);
      await a.query('COMMIT;');
      const [outcome] = await settled;
      if (outcome.status === 'rejected') throw outcome.reason;
      return { first: parse(firstOutput), second: parse(outcome.value) };
    } finally {
      await a.query('ROLLBACK;').catch(() => undefined);
      await Promise.all([a.close(), b.close()]);
    }
  }
  beforeAll(async () => {
    observer = new PsqlSession(container!);
    await observer.query(`SET request.jwt.claim.role='service_role';
      INSERT INTO activity_catalog(code,label,default_visibility,severity,toast_enabled)
      SELECT code,code,'management','info',false FROM unnest(ARRAY['job.created','assignment.created','assignment.updated','assignment.removed']) code
      ON CONFLICT(code) DO NOTHING;
      INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data,aud,role)
      VALUES(${sql(tech)},${sql(tech + '@test.local')},'{}','{}','authenticated','authenticated');
      INSERT INTO profiles(id,email,first_name,last_name,role,department)
      VALUES(${sql(tech)},${sql(tech + '@test.local')},'Undo','Race','technician','sound')
      ON CONFLICT(id) DO UPDATE SET department='sound';
      INSERT INTO jobs(id,title,start_time,end_time,job_type,status)
      SELECT j,'Owned matrix undo race',timestamptz '2028-01-01 08:00+01'+n*interval '6 days',
        timestamptz '2028-01-03 20:00+01'+n*interval '6 days','single','Confirmado'
      FROM unnest(ARRAY[${jobs.map(sql).join(',')}]::uuid[]) WITH ORDINALITY s(j,n);`);
  });
  afterAll(async () => {
    if (!observer) return;
    await observer.query(`DELETE FROM assignment_commands WHERE technician_id=${sql(tech)};
      DELETE FROM jobs WHERE id=ANY(ARRAY[${jobs.map(sql).join(',')}]::uuid[]);
      DELETE FROM auth.users WHERE id=${sql(tech)};`);
    await observer.close();
  });

  it('undo commits both cancellations before a blocked claimant can see either plan', async () => {
    const f = await fixture(0);
    const raced = await race(f.undo, `SELECT public.claim_assignment_side_effects(${sql(f.command)},10);`);
    expect(raced.first.ok).toBe(true);
    expect(raced.second.effects).toEqual([]);
    expect(parse(await observer.query(`SELECT public.claim_assignment_side_effects(${sql(f.inverse)},10);`)).effects).toEqual([]);
    expect(await observer.query(`SELECT public.assignment_state_token(${sql(f.job)},${sql(tech)});`)).toBe(f.prior.state_token);
  });
  it('owner release wins over a blocked undo without mutating the committed assignment', async () => {
    const f = await fixture(1);
    const raced = await race(`SELECT public.release_assignment_command_effects(${sql(f.command)});`, f.undo);
    expect(raced.first.released).toBe(true);
    expect(raced.second).toMatchObject({ ok: false, code: 'invalid_transition' });
    expect(await observer.query(`SELECT public.assignment_state_token(${sql(f.job)},${sql(tech)});`)).toBe(f.result.state_token);
    expect(parse(await observer.query(`SELECT public.claim_assignment_side_effects(${sql(f.command)},10);`)).effects.length).toBeGreaterThan(0);
  });
  it('a claim after release wins and its historical claim survives lease expiry', async () => {
    const f = await fixture(2);
    await observer.query(`SELECT public.release_assignment_command_effects(${sql(f.command)});`);
    const raced = await race(`SELECT public.claim_assignment_side_effects(${sql(f.command)},10);`, f.undo);
    expect(raced.first.effects.length).toBeGreaterThan(0);
    expect(raced.second.ok).toBe(false);
    await observer.query(`UPDATE assignment_commands SET undo_expires_at=clock_timestamp()+interval '8 seconds',
      side_effects=(SELECT jsonb_agg(e||jsonb_build_object('claimed_until','2000-01-01T00:00:00Z'))
        FROM jsonb_array_elements(side_effects) e) WHERE command_id=${sql(f.command)};`);
    const retry = parse(await observer.query(f.undo.replace(sql(f.inverse), sql(randomUUID()))));
    expect(retry.ok).toBe(false);
    expect(await observer.query(`SELECT effects_claimed_at IS NOT NULL FROM assignment_commands WHERE command_id=${sql(f.command)};`)).toBe('t');
  });
  it('concurrent identical undo packets restore once and the second returns the durable replay', async () => {
    const f = await fixture(3);
    const raced = await race(f.undo, f.undo);
    expect(raced.first).toMatchObject({ ok: true, replayed: false });
    expect(raced.second).toMatchObject({ ok: true, replayed: true, state_token: f.prior.state_token });
    expect(await observer.query(`SELECT count(*) FROM assignment_command_undos WHERE original_command_id=${sql(f.command)};`)).toBe('1');
  });
  it('an undo waiting on the canonical technician lock rechecks actual deadline after the wait', async () => {
    const f = await fixture(4);
    // Shorten this owned fixture's window to make the real clock check bounded.
    await observer.query(`UPDATE assignment_commands SET undo_expires_at=clock_timestamp()+interval '2 seconds' WHERE command_id=${sql(f.command)};`);
    const aName = `deadline-a-${randomUUID()}`, bName = `deadline-b-${randomUUID()}`;
    const a = await session(aName), b = await session(bName);
    try {
      await a.query(`BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('assignment-technician:'||${sql(tech)},0));`);
      const settled = Promise.allSettled([b.query(f.undo)]);
      await waitUntilBlocked(observer, bName, aName);
      await observer.query(`SELECT pg_sleep(2.1);`);
      await a.query('COMMIT;');
      const [outcome] = await settled;
      if (outcome.status === 'rejected') throw outcome.reason;
      expect(parse(outcome.value)).toMatchObject({ ok: false, code: 'invalid_transition' });
      expect(await observer.query(`SELECT public.assignment_state_token(${sql(f.job)},${sql(tech)});`)).toBe(f.result.state_token);
    } finally {
      await a.query('ROLLBACK;').catch(() => undefined);
      await Promise.all([a.close(), b.close()]);
    }
  });

  it('an already committed undo replays while the technician profile is locked', async () => {
    const f = await fixture(5);
    expect(parse(await observer.query(f.undo))).toMatchObject({ ok: true, replayed: false });
    const locker = await session(`profile-lock-${randomUUID()}`);
    const replay = await session(`profile-replay-${randomUUID()}`);
    try {
      await locker.query(`BEGIN; SELECT id FROM profiles WHERE id=${sql(tech)} FOR UPDATE;`);
      // This completes before releasing the profile lock, or fails by timeout.
      await replay.query("SET statement_timeout='2s';");
      expect(parse(await replay.query(f.undo))).toMatchObject({ ok: true, replayed: true, state_token: f.prior.state_token });
      expect(await observer.query(`SELECT public.assignment_state_token(${sql(f.job)},${sql(tech)});`)).toBe(f.prior.state_token);
    } finally {
      await locker.query('ROLLBACK;').catch(() => undefined);
      await Promise.all([locker.close(), replay.close()]);
    }
  });
});
