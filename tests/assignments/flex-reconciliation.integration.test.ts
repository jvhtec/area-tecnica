import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PsqlSession, waitUntilBlocked } from './helpers/psqlSession';
import { reconcileFlexCrew } from '../../supabase/functions/_shared/flexCrewReconciliation';

const ledger = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: ledger.rpc, from: ledger.from, functions: { invoke: ledger.invoke } } }));
import { retryAssignmentSideEffects } from '@/features/assignments/commands/reconciliation';

const endpoint = process.env.STAFFING_TEST_REST_URL;
const container = process.env.STAFFING_TEST_DB_CONTAINER;
const localEndpoint = endpoint?.match(/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):([1-9]\d{0,4})\/?$/);
const permitted = Boolean(localEndpoint && Number(localEndpoint[1]) <= 65535 && container) && (
  (process.env.GITHUB_ACTIONS === 'true' && container === 'supabase_db_syldobdcdsgfgjtbuwxm')
  || process.env.ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL === container
);
const networkFetch = globalThis.fetch;
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

// Real Supabase/PostgREST/RPCs and concurrent PostgreSQL backends. Only the
// provider is simulated; no real Flex credential, network or delivery is used.
describe.skipIf(!permitted)('current-state Flex reconciliation on the disposable database', () => {
  let db: PsqlSession;
  let client: SupabaseClient;
  const technician = randomUUID();
  const jobs: string[] = [];
  const elements: string[] = [];
  beforeAll(async () => {
    db = new PsqlSession(container!);
    await db.query(`SET request.jwt.claim.role='service_role';
      INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data,aud,role)
      VALUES (${quote(technician)},'${technician}@test.local','{}','{}','authenticated','authenticated');
      UPDATE public.profiles SET role='technician',department='sound',flex_resource_id=${quote(technician)} WHERE id=${quote(technician)};`);
    client = createClient(endpoint!, 'local-review-placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input)); url.pathname = url.pathname.replace(/^\/rest\/v1/, '');
        const headers = new Headers(init?.headers); headers.delete('Authorization');
        return networkFetch(url, { ...init, headers });
      } },
    });
  });
  afterAll(async () => {
    if (!db) return;
    for (const job of jobs) await db.query(`DELETE FROM public.jobs WHERE id=${quote(job)};`);
    for (const element of elements) await db.query(`DELETE FROM public.flex_crew_reconciliation_gates WHERE flex_element_id=${quote(element)};`);
    await db.query(`DELETE FROM auth.users WHERE id=${quote(technician)};`);
    await db.close();
  });
  async function fixture(member: boolean, element = randomUUID()) {
    const job = randomUUID(), call = randomUUID(), line = randomUUID();
    jobs.push(job); elements.push(element);
    await db.query(`INSERT INTO public.jobs(id,title,start_time,end_time,job_type,status)
      VALUES (${quote(job)},'Flex reconciliation regression',now(),now()+interval '1 day','single','Confirmado');
      INSERT INTO public.flex_crew_calls(id,job_id,department,flex_element_id)
      VALUES (${quote(call)},${quote(job)},'sound',${quote(element)});
      ${member ? `INSERT INTO public.job_assignments(job_id,technician_id,status,sound_role)
      VALUES (${quote(job)},${quote(technician)},'confirmed','SND-FOH-R');` : ''}`);
    return { job, call, element, line };
  }
  function provider(initial: boolean, line: string) {
    let rows = initial ? [{ id: line, resourceId: technician, managedResourceLineItemType: 'contact' }] : [];
    const mutations: string[] = [];
    let beforeMutation: (() => Promise<void>) | undefined;
    const fetch: typeof globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input)), method = init.method ?? 'GET';
      if (method === 'GET') return new Response(JSON.stringify(rows));
      mutations.push(`${method} ${url.pathname}`);
      await beforeMutation?.();
      if (method === 'DELETE') rows = rows.filter(row => !url.pathname.endsWith(row.id));
      else if (url.pathname.includes('/add-resource/')) rows.push({ id: line, resourceId: technician, managedResourceLineItemType: 'contact' });
      return new Response('{}');
    };
    return { fetch, mutations, count: () => rows.length, pause: (fn: () => Promise<void>) => { beforeMutation = fn; } };
  }
  it.each([['add', false], ['remove', true], ['add', true], ['remove', false]] as const)(
    'real historical %s retry preserves current membership %s', async (action, member) => {
      const f = await fixture(member);
      const sink = provider(member, f.line);
      if (member) await db.query(`INSERT INTO public.flex_crew_assignments(crew_call_id,technician_id,flex_line_item_id)
        VALUES (${quote(f.call)},${quote(technician)},${quote(f.line)});`);
      const effect = { kind: 'flex', action, job_id: f.job, department: 'sound', status: 'failed', effect_id: 'historical:0' };
      const assignment = { id: 'old-assignment', status: 'confirmed', sound_role: 'SND-FOH-R', lights_role: null, video_role: null,
        production_role: null, single_day: true, assignment_date: '2026-12-01', assignment_source: 'direct' };
      const oldResult = { ok: true, outcome: 'committed', command_id: 'historical', job_id: f.job, technician_id: technician,
        state_token: 'old-token', replayed: false, assignment: action === 'add' ? assignment : null,
        removed: action === 'remove' ? { job_id: f.job, assignment, dates: ['2026-12-01'], deleted_timesheets: 1, deleted_assignment: true } : null,
        dates: action === 'add' ? ['2026-12-01'] : [], side_effects: [effect], warnings: [] };
      const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: { result: oldResult, side_effects: [effect] }, error: null })) };
      ledger.from.mockReturnValue(read);
      ledger.rpc.mockImplementation(async name => ({ data: name === 'claim_assignment_side_effects'
        ? { claim_token: 'old-claim', effects: [{ ...effect, index: 0 }] } : {}, error: null }));
      ledger.invoke.mockImplementation(async (_name, { body }) => {
        await reconcileFlexCrew(client, body.job_id, body.department, 'synthetic-token', { fetch: sink.fetch });
        return { error: null };
      });
      expect(await retryAssignmentSideEffects('historical')).toEqual({ attempted: 1, failed: 0, recorded: true });
      expect(sink.count()).toBe(Number(member));
      expect(sink.mutations.some(path => path.includes('/add-resource/') || path.startsWith('DELETE'))).toBe(false);
    });
  it('paused external add excludes an independent alias worker, then reconciles the newer removal', async () => {
    const f = await fixture(true), alias = await fixture(false, f.element);
    const sink = provider(false, f.line), entered = deferred(), proceed = deferred();
    let paused = false;
    sink.pause(async () => { if (!paused) { paused = true; entered.resolve(); await proceed.promise; } });
    const first = reconcileFlexCrew(client, f.job, 'sound', 'synthetic-token', { fetch: sink.fetch });
    await entered.promise;
    try {
      await db.query(`DELETE FROM public.job_assignments WHERE job_id=${quote(f.job)};`);
      await expect(reconcileFlexCrew(client, alias.job, 'sound', 'synthetic-token', { fetch: sink.fetch })).rejects.toThrow('flex_crew_reconciliation_busy');
      expect(sink.mutations).toHaveLength(1);
    } finally { proceed.resolve(); }
    expect((await first).removed).toBe(1);
    expect(sink.count()).toBe(0);
    expect(await db.query(`SELECT state FROM public.flex_crew_reconciliation_gates WHERE flex_element_id=${quote(f.element)};`)).toBe('idle');
    await reconcileFlexCrew(client, alias.job, 'sound', 'synthetic-token', { fetch: sink.fetch });
    expect(sink.count()).toBe(0);
  });
  it('independent SQL backends serialize simultaneous claims of physical aliases', async () => {
    const f = await fixture(false), alias = await fixture(false, f.element);
    const a = new PsqlSession(container!), b = new PsqlSession(container!);
    const name = randomUUID().slice(0, 8);
    try {
      await a.query(`SET request.jwt.claim.role='service_role'; SET application_name='flex-a-${name}'; BEGIN;
        SELECT public.claim_flex_crew_reconciliation(${quote(f.job)},'sound');`);
      await b.query(`SET request.jwt.claim.role='service_role'; SET application_name='flex-b-${name}'; SET statement_timeout='10s';`);
      const attempted = b.query(`SELECT public.claim_flex_crew_reconciliation(${quote(alias.job)},'sound');`);
      const outcome = Promise.allSettled([attempted]);
      await waitUntilBlocked(db, `flex-b-${name}`, `flex-a-${name}`);
      await a.query('COMMIT;');
      const [second] = await outcome;
      expect(second.status).toBe('rejected');
      if (second.status === 'rejected') expect(String(second.reason)).toContain('55P03');
    } finally { await a.query('ROLLBACK;').catch(() => undefined); await Promise.all([a.close(), b.close()]); }
  });
  it('concurrent physical retargeting cannot commit an old-element line mapping', async () => {
    const f = await fixture(true);
    const claim = await client.rpc('claim_flex_crew_reconciliation', { p_job_id: f.job, p_department: 'sound' });
    expect(claim.error).toBeNull();
    const a = new PsqlSession(container!), b = new PsqlSession(container!);
    const name = randomUUID().slice(0, 8), replacement = randomUUID();
    try {
      await a.query(`SET request.jwt.claim.role='service_role'; SET application_name='retarget-a-${name}'; BEGIN;
        UPDATE public.flex_crew_calls SET flex_element_id=${quote(replacement)} WHERE id=${quote(f.call)};`);
      await b.query(`SET request.jwt.claim.role='service_role'; SET application_name='retarget-b-${name}'; SET statement_timeout='10s';`);
      const attempted = b.query(`SELECT public.write_flex_crew_mapping(${quote(f.element)},${quote(claim.data.owner_token)},
        ${quote(f.call)},${quote(technician)},${quote(f.line)});`);
      const outcome = Promise.allSettled([attempted]);
      await waitUntilBlocked(db, `retarget-b-${name}`, `retarget-a-${name}`);
      await a.query('COMMIT;');
      const [result] = await outcome;
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(String(result.reason)).toContain('P0409');
      expect(await db.query(`SELECT count(*) FROM public.flex_crew_assignments WHERE crew_call_id=${quote(f.call)};`)).toBe('0');
    } finally { await a.query('ROLLBACK;').catch(() => undefined); await Promise.all([a.close(), b.close()]); }
  });
});
