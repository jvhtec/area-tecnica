import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect } from 'vitest';
import { edgeSnapshot } from './edgeSnapshot';
import { localRequestSafety } from './localRequestSafety';
import { withLocalRuntimeFence } from './withLocalRuntimeFence';
import { observeLocalTransport } from './observeLocalTransport';
import { readDisposableCampaignTarget, verifyDisposableCampaignTarget } from './disposableCampaignTarget';

const coreTables = ['jobs', 'staffing_requests', 'job_assignments', 'timesheets', 'profiles', 'activity_log', 'notification_inbox', 'push_delivery_attempts'];
// setup.ts replaces global fetch before each unit test. Keep the original
// transport explicitly for this opt-in integration suite and every SDK client.
const realFetch = globalThis.fetch;

function docker(...args: string[]) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 * 1024 });
}

export function campaignHarnessCore(extraHandlers: string[], options: { mode: 'historical' | 'disposable';
  beforeJobDelete?: (marker: string, assertFresh: () => void) => Promise<void>; wrapFetch?: (fetch: typeof globalThis.fetch) => typeof globalThis.fetch }) {
  if (!['historical','disposable'].includes(options.mode)) throw new Error('Unknown local campaign target mode');
  const target = options.mode === 'historical' ? { database: 'supabase_db_dev-history', url: 'http://127.0.0.1:54441',
    edge: 'supabase_edge_runtime_dev-history', capture: 'history-delivery-capture', network: 'area-tecnica-history' } : readDisposableCampaignTarget();
  const { database, url: localUrl } = target;
  if (process.env.STAFFING_EDGE_TEST_URL !== localUrl) throw new Error(options.mode === 'historical'
    ? 'Only the isolated historical localhost gateway is permitted' : 'Only the owned disposable localhost gateway is permitted');
  const anon = process.env.STAFFING_EDGE_TEST_ANON_KEY!;
  const service = process.env.STAFFING_EDGE_TEST_SERVICE_KEY!;
  for (const [key, role] of [[anon, 'anon'], [service, 'service_role']]) {
    if (!key) throw new Error('Local keys are required');
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.iss !== 'supabase-demo' || claims.role !== role) throw new Error('Refusing credentials that are not local demo keys');
  }
  if (options.mode === 'disposable') verifyDisposableCampaignTarget(target as ReturnType<typeof readDisposableCampaignTarget>, docker);
  else {
    const network = JSON.parse(docker('network', 'inspect', target.network))[0];
    if (!network.Internal) throw new Error('Historical network must have no external route');
    for (const container of [database, target.edge, target.capture]) {
      const inspected = JSON.parse(docker('inspect', '--type', 'container', container))[0];
      if (Object.keys(inspected.NetworkSettings.Networks).join() !== target.network) {
        throw new Error('Database, runtime and capture must use only the isolated network');
      }
    }
  }
  // The local runtime serves a copied snapshot. Refuse stale code instead of
  // claiming tests covered the checkout when only the private copy was run.
  // Include separately invoked handlers and recursively follow their imports.
  const sources = edgeSnapshot(['staffing-orchestrator/index.ts',
    'send-staffing-email/index.ts', 'notify-staffing-cancellation/index.ts', 'push/index.ts', ...extraHandlers]);
  // One Docker invocation avoids 87+ separate Windows process launches. Paths
  // are arguments, never interpolated shell code; NUL frames are checked.
  const paths = [...sources.keys()].map(file => `/local/functions/${file}`);
  const frames = docker('exec', target.edge, 'sh', '-c',
    'for file do printf "%s\\000" "$file"; cat "$file" || exit 1; printf "\\000"; done', 'sh', ...paths).split('\0');
  if (frames.length !== paths.length * 2 + 1 || frames.at(-1) !== '') throw new Error('Invalid local source snapshot framing');
  for (const [index, [file, expected]] of [...sources].entries()) {
    if (expected.includes('\0') || frames[index * 2] !== paths[index]) throw new Error('Invalid local source snapshot path');
    const normalize = (text: string) => text.replace(/\r\n/g, '\n').trimEnd();
    const source = frames[index * 2 + 1]
      .replace(/^import '\.\.\/\.\.\/outbound.ts';\r?\n/, '');
    if (normalize(source) !== normalize(expected)) throw new Error(`Local runtime source is stale: ${file}. Sync its public source before testing.`);
  }
  const requests = localRequestSafety();
  const observed = observeLocalTransport(realFetch, requests);
  const observedFetch = options.wrapFetch?.(observed) ?? observed;
  const client = createClient(localUrl, service, { auth: { persistSession: false, autoRefreshToken: false,
    detectSessionInUrl: false, storageKey: `local-service-${randomUUID()}` }, global: { fetch: observedFetch } });
  const jobs = new Set<string>();
  const users = new Set<string>();
  const marker = `[LOCAL CAMPAIGN TEST ${randomUUID()}]`;
  let jobsNeedCleanup = false;
  let usersNeedCleanup = false;
  function assertRetainedClear() {
    if (jobsNeedCleanup || usersNeedCleanup) throw new Error('Retained owned fixtures require successful cleanup before further fixture creation');
  }
  function assertFixtureSafe() {
    requests.assertSafe();
    assertRetainedClear();
  }
  async function fenced<T>(cleanup: (assertFresh: () => void) => Promise<T>) {
    requests.assertSafe();
    let cleanupFailure: { error: unknown } | undefined;
    let result: { ok: true; value: T } | { ok: false; error: unknown };
    try {
      result = await requests.run(() => withLocalRuntimeFence({ url: localUrl, anon, service, fetch: realFetch }, async assertFresh => {
        // A completed SQL denial/assertion is retryable after a proven release.
        // SDK network/body failures latch independently in observedFetch.
        try { return { ok: true as const, value: await cleanup(assertFresh) }; }
        catch (error) { cleanupFailure = { error }; return { ok: false as const, error }; }
      }));
    } catch (error) {
      if (cleanupFailure) throw new AggregateError([cleanupFailure.error, error], 'Owned cleanup and runtime release failed; retain fixture IDs');
      throw error;
    }
    if (!result.ok) throw result.error;
    return result.value;
  }

  function fingerprint() {
    return coreTables.map(table => docker('exec', database, 'psql', '-XqAt', '-U', 'postgres', '-d', 'postgres', '-c',
      `SELECT count(*) || ':' || md5(coalesce(string_agg(to_jsonb(t)::text, '|' ORDER BY t.id), '')) FROM public.${table} t;`).trim());
  }

  async function api(action: string, body: Record<string, unknown>, token: string = service) {
    // Concurrent tick requests are intentional; only retained cleanup blocks
    // an API action. requests.run separately rejects transport uncertainty.
    assertRetainedClear();
    return requests.run(async () => {
      const response = await realFetch(`${localUrl}/functions/v1/staffing-orchestrator?action=${action}`, {
        method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(40_000),
      });
      return { status: response.status, body: await response.json() };
    });
  }

  async function user(role = 'technician', department = 'sound') {
    assertFixtureSafe();
    const email = `campaign-${randomUUID()}@example.invalid`;
    const password = randomUUID() + randomUUID();
    const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    users.add(id);
    expect((await client.from('profiles').update({ role, department, first_name: 'Local', last_name: 'Campaign',
      phone: '+34999000001', default_timesheet_category: 'tecnico',
      waha_endpoint: role === 'management' ? 'https://local-waha.invalid' : null }).eq('id', id)).error).toBeNull();
    const auth = createClient(localUrl, anon, { auth: { persistSession: false, autoRefreshToken: false,
      detectSessionInUrl: false, storageKey: `local-user-${id}` }, global: { fetch: observedFetch } });
    const signedIn = await auth.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    return { id, token: signedIn.data.session!.access_token, client: auth };
  }

  async function job(quantity = 1) {
    assertFixtureSafe();
    const id = randomUUID();
    jobs.add(id);
    expect((await client.from('jobs').insert({ id, title: marker, job_type: 'single', status: 'Confirmado',
      start_time: '2027-10-20T08:00:00Z', end_time: '2027-10-21T18:00:00Z' })).error).toBeNull();
    expect((await client.from('job_departments').insert({ job_id: id, department: 'sound' })).error).toBeNull();
    expect((await client.from('job_required_roles').insert({ job_id: id, department: 'sound', role_code: 'SND-FOH-T', quantity })).error).toBeNull();
    return id;
  }

  async function start(jobId: string, managerToken: string, mode = 'assisted', waves = false) {
    const result = await api('start', { job_id: jobId, department: 'sound', mode, scope: 'all',
      offer_message: 'Oferta de prueba local', policy: { channel: 'email',
        waves: { auto_send_next_wave: waves, buffer: 0, wait_minutes: 0 } } }, managerToken);
    expect(result.status).toBe(200);
    return result.body;
  }

  async function campaign(id: string) {
    const result = await client.from('staffing_campaigns').select('*').eq('id', id).single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function roles(id: string) {
    const result = await client.from('staffing_campaign_roles').select('*').eq('campaign_id', id).order('role_code');
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function request(jobId: string, profileId: string, phase: string, status: string, role: string | null = 'SND-FOH-T', date = '2027-10-20', updatedAt = new Date().toISOString()) {
    assertFixtureSafe();
    const id = randomUUID();
    expect((await client.from('staffing_requests').insert({ id, job_id: jobId, profile_id: profileId,
      phase, status, role_code: phase === 'offer' ? role : null, target_date: date, single_day: true,
      token_hash: randomUUID(), token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), updated_at: updatedAt })).error).toBeNull();
    if (role) expect((await client.from('staffing_events').insert({ staffing_request_id: id,
      event: 'email_sent', meta: { role }, created_at: '2026-10-01T08:00:00Z' })).error).toBeNull();
    return id;
  }

  async function assignment(jobId: string, profileId: string, status: string, role = 'SND-FOH-T') {
    assertFixtureSafe();
    expect((await client.from('job_assignments').insert({ job_id: jobId, technician_id: profileId, status, sound_role: role })).error).toBeNull();
  }

  async function cleanJobs() {
    jobsNeedCleanup = true;
    await fenced(async assertFresh => {
      if (jobs.size) {
        await options.beforeJobDelete?.(marker, assertFresh);
        // Push inbox rows can target historical managers, so user deletion alone
        // is insufficient. Their attempt rows cascade with the owned inbox items.
        assertFresh();
        expect((await client.from('notification_inbox').delete().in('meta->>jobId', [...jobs])).error).toBeNull();
        // Both the random IDs and this run's title must match before removal.
        assertFresh();
        const result = await client.from('jobs').delete().in('id', [...jobs]).eq('title', marker);
        expect(result.error).toBeNull();
        // Activity deliberately has no cascading job FK. Include rows created by
        // sender success and by assignment deletion before any assertion about
        // surviving fixture jobs can prevent cleanup. Retain IDs for retries.
        assertFresh();
        expect((await client.from('activity_log').delete().in('job_id', [...jobs])).error).toBeNull();
        const remaining = await client.from('jobs').select('id').in('id', [...jobs]);
        expect(remaining.error).toBeNull();
        expect(remaining.data).toEqual([]);
        jobs.clear();
      }
    });
    jobsNeedCleanup = false;
  }

  async function cleanUsers() {
    usersNeedCleanup = true;
    await fenced(async assertFresh => {
      const failures: string[] = [];
      for (const id of users) {
        assertFresh();
        const result = await client.auth.admin.deleteUser(id);
        if (result.error) failures.push(id);
        else users.delete(id);
      }
      if (failures.length) throw new Error(`Could not remove ${failures.length} owned local test users; remaining IDs: ${failures.join(',')}`);
    });
    usersNeedCleanup = false;
  }

  return { target, client, api, user, job, start, campaign, roles, request, assignment, cleanJobs, cleanUsers, fingerprint, localUrl,
    get cleanupSafe() { return requests.cleanupSafe; }, ownsJob: (id: string) => jobs.has(id), ownsUser: (id: string) => users.has(id),
    marker, runGuardedMutation: requests.run,
    assertCleanupSafe: requests.assertSafe, assertFixtureSafe, prepare: () => fenced(async () => undefined), withCleanupFence: fenced };
}
