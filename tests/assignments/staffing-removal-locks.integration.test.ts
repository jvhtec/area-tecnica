import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// Destructive opt-in test on the same disposable database as the HTTP suite.
// Persistent psql connections provide controlled, real transaction boundaries.
const container = process.env.STAFFING_TEST_DB_CONTAINER;

class SqlSession {
  private process;
  private output = '';
  private errors = '';
  private pending?: { marker: string; resolve: (output: string) => void; reject: (error: Error) => void };

  constructor() {
    this.process = spawn('docker', ['exec', '-i', container!, 'psql', '-X', '-qAt',
      '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', 'postgres'], { stdio: 'pipe' });
    this.process.stdout.on('data', chunk => {
      this.output += String(chunk);
      if (this.pending && this.output.includes(this.pending.marker)) {
        const pending = this.pending;
        this.pending = undefined;
        pending.resolve(this.output.split(pending.marker)[0].trim());
      }
    });
    this.process.stderr.on('data', chunk => { this.errors += String(chunk); });
    this.process.on('error', error => { this.pending?.reject(error); this.pending = undefined; });
    this.process.on('exit', code => {
      this.pending?.reject(new Error(`psql exited ${code}: ${this.errors}`));
      this.pending = undefined;
    });
  }

  query(sql: string): Promise<string> {
    if (this.pending) throw new Error('Only one query per connection may be in flight');
    if (this.process.exitCode !== null) throw new Error(this.errors);
    this.output = '';
    const marker = `done_${randomUUID()}`;
    return new Promise((resolve, reject) => {
      this.pending = { marker, resolve, reject };
      this.process.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }

  async close() {
    if (this.process.exitCode !== null) return;
    const exited = new Promise<void>(resolve => this.process.once('exit', () => resolve()));
    this.process.stdin.end('\\q\n');
    await exited;
  }
}

describe.skipIf(!container)('atomic acceptance versus assignment removal locks', () => {
  it.each(['lifecycle', 'timesheets', 'recreated', 'job', 'profile', 'creator'] as const)('serializes acceptance after %s removal without a deadlock', async mode => {
    if (container !== 'supabase_db_pr990staffingreview'
      && !(process.env.GITHUB_ACTIONS === 'true' && container === 'supabase_db_syldobdcdsgfgjtbuwxm')) {
      throw new Error('Only the disposable review or GitHub Actions database is permitted');
    }
    const observer = new SqlSession();
    const removal = new SqlSession();
    const acceptance = new SqlSession();
    const jobId = randomUUID();
    const requestId = randomUUID();
    const techId = randomUUID();
    const creatorId = randomUUID();
    const profileDeletion = mode === 'profile' || mode === 'creator';
    const removalName = `staffing-removal-${jobId}`;
    const acceptanceName = `staffing-acceptance-${jobId}`;
    let gateHeld = false;
    let operations: Promise<PromiseSettledResult<string>[]> | undefined;

    async function waitBlocked(name: string, blocker?: string, settled?: () => boolean) {
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        if (settled?.()) return;
        const result = await observer.query(`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity a WHERE a.application_name = '${name}'
          AND ${blocker ? `EXISTS (SELECT 1 FROM pg_stat_activity b WHERE b.application_name = '${blocker}' AND b.pid = ANY(pg_blocking_pids(a.pid)))`
            : 'cardinality(pg_blocking_pids(a.pid)) > 0'});`);
        if (result === 't') return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Expected ${name} to reach its controlled lock wait`);
    }

    try {
      await observer.query(`SET statement_timeout = '15s'; SET request.jwt.claim.role = 'service_role';
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
          VALUES ('${techId}', '${techId}@test.local', '{}', '{}', 'authenticated', 'authenticated');
        INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
          VALUES ('${techId}', '${techId}@test.local', 'Lock', 'Test', 'technician', 'sound')
          ON CONFLICT (id) DO UPDATE SET department = 'sound';
        ${mode === 'creator' ? `INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
          VALUES ('${creatorId}', '${creatorId}@test.local', '{}', '{}', 'authenticated', 'authenticated');
        INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
          VALUES ('${creatorId}', '${creatorId}@test.local', 'Creator', 'Test', 'management', 'sound')
          ON CONFLICT (id) DO UPDATE SET role = 'management';` : ''}
        INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
          VALUES ('${jobId}', 'Disposable staffing lock review', '2026-10-20 08:00+02', '2026-10-21 18:00+02', 'single', 'Confirmado');
        INSERT INTO public.staffing_requests (id, job_id, profile_id, phase, status, token_hash, token_expires_at)
          VALUES ('${requestId}', '${jobId}', '${techId}', 'offer', 'confirmed', 'hash', now() + interval '48 hours');
        ${mode === 'recreated' ? '' : `INSERT INTO public.job_assignments (job_id, technician_id, status, single_day, assignment_date)
          VALUES ('${jobId}', '${techId}', 'confirmed', true, '2026-10-21');
        `}
        ${mode === 'creator' ? `INSERT INTO public.timesheets (job_id, technician_id, date, is_active, category, created_by, start_time, end_time, amount_eur)
          VALUES ('${jobId}', '${techId}', '2026-10-20', false, 'tecnico', '${creatorId}', '09:00', '17:00', 321);
        INSERT INTO public.job_date_types (job_id, date, type) VALUES ('${jobId}', '2026-10-20', 'prep_day');` : mode === 'job' || mode === 'profile' ? '' : `INSERT INTO public.timesheets (job_id, technician_id, date, is_active, category)
          VALUES ('${jobId}', '${techId}', '2026-10-20', false, 'tecnico');
        `}
        INSERT INTO public.staffing_test_faults (job_id, pause_assignment_delete, pause_timesheet_delete, pause_job_delete, pause_profile_delete_id)
          VALUES ('${jobId}', ${mode === 'lifecycle'}, ${mode === 'timesheets' || mode === 'recreated'}, ${mode === 'job'}, ${profileDeletion ? `'${mode === 'creator' ? creatorId : techId}'` : 'NULL'});
        SELECT pg_advisory_lock(198990, 1);`);
      gateHeld = true;
      await removal.query(`SET application_name = '${removalName}'; SET statement_timeout = '15s';
        SET request.jwt.claim.role = 'service_role'; SET ROLE service_role;`);
      await acceptance.query(`SET application_name = '${acceptanceName}'; SET statement_timeout = '15s';
        SET request.jwt.claim.role = 'service_role'; SET ROLE service_role;`);
      const removed = removal.query(mode === 'lifecycle'
        ? `SELECT public.manage_assignment_lifecycle('${jobId}', '${techId}', 'cancel', 'hard');`
        : mode === 'job' ? `DELETE FROM public.jobs WHERE id = '${jobId}'; SELECT 'removed';`
          : profileDeletion ? `DELETE FROM public.profiles WHERE id = '${mode === 'creator' ? creatorId : techId}'; SELECT 'removed';`
          : `SELECT * FROM public.remove_assignment_with_timesheets('${jobId}', '${techId}');`);
      // Attach rejection handlers immediately; a negative control may deadlock.
      const removalResult = Promise.allSettled([removed]);
      await waitBlocked(removalName);
      const profileMembershipBefore = profileDeletion
        ? await observer.query(`SELECT to_jsonb(a)::text FROM public.job_assignments a WHERE job_id = '${jobId}';`)
        : undefined;
      if (mode === 'recreated') {
        await observer.query(`INSERT INTO public.job_assignments (job_id, technician_id, status, single_day, assignment_date)
          VALUES ('${jobId}', '${techId}', 'confirmed', true, '2026-10-21');`);
      }
      const accepted = acceptance.query(`SELECT public.assign_staffing_offer('${requestId}', ARRAY['2026-10-20']::date[], true, '${profileDeletion ? 'SND-FOH-T' : 'SND-FOH-R'}');`);
      operations = Promise.allSettled([removed, accepted]);
      let acceptanceSettled = false;
      if (profileDeletion) void accepted.then(() => { acceptanceSettled = true; }, () => { acceptanceSettled = true; });
      await waitBlocked(acceptanceName, removalName, profileDeletion ? () => acceptanceSettled : undefined);
      if (profileDeletion && acceptanceSettled) {
        expect(await observer.query(`SELECT to_jsonb(a)::text FROM public.job_assignments a WHERE job_id = '${jobId}';`)).toBe(profileMembershipBefore);
        expect(await observer.query(`SELECT status FROM public.staffing_requests WHERE id = '${requestId}';`)).toBe('confirmed');
      }
      await observer.query('SELECT pg_advisory_unlock(198990, 1);');
      gateHeld = false;
      const results = await operations;
      if (mode === 'job' || profileDeletion) {
        expect(await removed).toBe('removed');
        expect(results[1].status).toBe('rejected');
        if (results[1].status === 'rejected') {
          expect(String(results[1].reason)).toContain(profileDeletion ? '55P03' : 'P0002');
          expect(String(results[1].reason)).not.toContain('40P01');
        }
        expect(await observer.query(`SELECT count(*) FROM public.jobs WHERE id = '${jobId}';`)).toBe(mode === 'job' ? '0' : '1');
        if (mode === 'profile') expect(await observer.query(`SELECT count(*) FROM public.profiles WHERE id = '${techId}';`)).toBe('0');
        if (mode === 'creator') {
          expect(await observer.query(`SELECT count(*) FROM public.profiles WHERE id = '${creatorId}';`)).toBe('0');
          expect(await observer.query(`SELECT count(*) FROM public.job_assignments WHERE job_id = '${jobId}';`)).toBe('1');
          expect(JSON.parse(await observer.query(`SELECT jsonb_build_object('active', is_active, 'amount', amount_eur, 'creator', created_by)
            FROM public.timesheets WHERE job_id = '${jobId}';`))).toEqual({ active: false, amount: 321, creator: null });
          return;
        }
        expect(await observer.query(`SELECT count(*) FROM public.job_assignments WHERE job_id = '${jobId}';`)).toBe('0');
        expect(await observer.query(`SELECT count(*) FROM public.timesheets WHERE job_id = '${jobId}';`)).toBe('0');
        return;
      }
      expect(results, 'both transactions must commit without 40P01 or timeouts').toEqual([
        expect.objectContaining({ status: 'fulfilled' }), expect.objectContaining({ status: 'fulfilled' }),
      ]);
      const removalOutput = await removed;
      if (mode === 'lifecycle') expect(JSON.parse(removalOutput)).toMatchObject({ success: true, action: 'hard_deleted', deleted_timesheets: 1 });
      else expect(removalOutput).toBe('1|t');
      await removalResult;
      expect(await observer.query(`SELECT status FROM public.staffing_requests WHERE id = '${requestId}';`)).toBe('confirmed');
      expect(await observer.query(`SELECT count(*) FROM public.job_assignments WHERE job_id = '${jobId}' AND status = 'confirmed';`)).toBe('1');
      expect(await observer.query(`SELECT assignment_date FROM public.job_assignments WHERE job_id = '${jobId}';`)).toBe('2026-10-20');
      expect(await observer.query(`SELECT string_agg(date::text, ',') FROM public.timesheets WHERE job_id = '${jobId}' AND is_active;`)).toBe('2026-10-20');
    } finally {
      if (gateHeld) await observer.query('SELECT pg_advisory_unlock(198990, 1);');
      await operations;
      await Promise.all([removal.close(), acceptance.close()]);
      await observer.query(`DELETE FROM public.staffing_test_faults WHERE job_id = '${jobId}';
        DELETE FROM public.jobs WHERE id = '${jobId}'; DELETE FROM auth.users WHERE id IN ('${techId}', '${creatorId}');`);
      await observer.close();
    }
  }, 30_000);
});
