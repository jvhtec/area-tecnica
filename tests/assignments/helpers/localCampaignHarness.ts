import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect } from 'vitest';

const database = 'supabase_db_dev-history';
const localUrl = 'http://127.0.0.1:54441';
const coreTables = ['jobs', 'staffing_requests', 'job_assignments', 'timesheets', 'profiles', 'activity_log'];
// setup.ts replaces global fetch before each unit test. Keep the original
// transport explicitly for this opt-in integration suite and every SDK client.
const realFetch = globalThis.fetch;

function docker(...args: string[]) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 15_000 });
}

export function localCampaignHarness() {
  if (process.env.STAFFING_EDGE_TEST_URL !== localUrl) throw new Error('Only the isolated historical localhost gateway is permitted');
  const anon = process.env.STAFFING_EDGE_TEST_ANON_KEY!;
  const service = process.env.STAFFING_EDGE_TEST_SERVICE_KEY!;
  for (const [key, role] of [[anon, 'anon'], [service, 'service_role']]) {
    if (!key) throw new Error('Local keys are required');
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.iss !== 'supabase-demo' || claims.role !== role) throw new Error('Refusing credentials that are not local demo keys');
  }
  const network = JSON.parse(docker('network', 'inspect', 'area-tecnica-history'))[0];
  if (!network.Internal) throw new Error('Historical network must have no external route');
  for (const container of [database, 'supabase_edge_runtime_dev-history', 'history-delivery-capture']) {
    const inspected = JSON.parse(docker('inspect', '--type', 'container', container))[0];
    if (Object.keys(inspected.NetworkSettings.Networks).join() !== 'area-tecnica-history') {
      throw new Error('Database, runtime and capture must use only the isolated network');
    }
  }
  // The local runtime serves a copied snapshot. Refuse stale code instead of
  // claiming tests covered the checkout when only the private copy was run.
  for (const file of ['staffing-orchestrator/index.ts', 'staffing-orchestrator/policyUtils.ts',
    'staffing-orchestrator/orchestrationUtils.ts', 'staffing-orchestrator/campaignFinalization.ts',
    '_shared/pushBroadcast.ts', '_shared/structuredLogger.ts']) {
    const normalize = (text: string) => text.replace(/\r\n/g, '\n').trimEnd();
    const source = docker('exec', 'supabase_edge_runtime_dev-history', 'cat', `/local/functions/${file}`)
      .replace(/^import '\.\.\/\.\.\/outbound.ts';\r?\n/, '');
    const expected = readFileSync(new URL(`../../../supabase/functions/${file}`, import.meta.url), 'utf8');
    if (normalize(source) !== normalize(expected)) throw new Error(`Local runtime source is stale: ${file}. Sync its public source before testing.`);
  }
  const client = createClient(localUrl, service, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: realFetch } });
  const jobs = new Set<string>();
  const users = new Set<string>();
  const marker = `[LOCAL CAMPAIGN TEST ${randomUUID()}]`;

  function fingerprint() {
    return coreTables.map(table => docker('exec', database, 'psql', '-XqAt', '-U', 'postgres', '-d', 'postgres', '-c',
      `SELECT count(*) || ':' || md5(coalesce(string_agg(to_jsonb(t)::text, '|' ORDER BY t.id), '')) FROM public.${table} t;`).trim());
  }

  async function api(action: string, body: Record<string, unknown>, token: string = service) {
    const response = await realFetch(`${localUrl}/functions/v1/staffing-orchestrator?action=${action}`, {
      method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(40_000),
    });
    return { status: response.status, body: await response.json() };
  }

  async function user(role = 'technician', department = 'sound') {
    const email = `campaign-${randomUUID()}@example.invalid`;
    const password = randomUUID() + randomUUID();
    const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    users.add(id);
    expect((await client.from('profiles').update({ role, department, first_name: 'Local', last_name: 'Campaign',
      phone: '+34999000001', default_timesheet_category: 'tecnico',
      waha_endpoint: role === 'management' ? 'https://local-waha.invalid' : null }).eq('id', id)).error).toBeNull();
    const auth = createClient(localUrl, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: realFetch } });
    const signedIn = await auth.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    return { id, token: signedIn.data.session!.access_token };
  }

  async function job(quantity = 1) {
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
    const id = randomUUID();
    expect((await client.from('staffing_requests').insert({ id, job_id: jobId, profile_id: profileId,
      phase, status, role_code: phase === 'offer' ? role : null, target_date: date, single_day: true,
      token_hash: randomUUID(), token_expires_at: '2028-01-01T00:00:00Z', updated_at: updatedAt })).error).toBeNull();
    if (role) expect((await client.from('staffing_events').insert({ staffing_request_id: id,
      event: 'email_sent', meta: { role }, created_at: '2026-10-01T08:00:00Z' })).error).toBeNull();
    return id;
  }

  async function assignment(jobId: string, profileId: string, status: string, role = 'SND-FOH-T') {
    expect((await client.from('job_assignments').insert({ job_id: jobId, technician_id: profileId, status, sound_role: role })).error).toBeNull();
  }

  async function cleanJobs() {
    if (jobs.size) {
      // Both the random IDs and this run's title must match before removal.
      const result = await client.from('jobs').delete().in('id', [...jobs]).eq('title', marker);
      expect(result.error).toBeNull();
      const remaining = await client.from('jobs').select('id').in('id', [...jobs]);
      expect(remaining.error).toBeNull();
      expect(remaining.data).toEqual([]);
      // Activity deliberately has no cascading job FK. Include rows created by
      // sender success and by assignment deletion before forgetting owned IDs.
      expect((await client.from('activity_log').delete().in('job_id', [...jobs])).error).toBeNull();
      jobs.clear();
    }
  }

  async function cleanUsers() {
    const failures: string[] = [];
    for (const id of users) {
      const result = await client.auth.admin.deleteUser(id);
      if (result.error) failures.push(id);
      else users.delete(id);
    }
    if (failures.length) throw new Error(`Could not remove ${failures.length} owned local test users; remaining IDs: ${failures.join(',')}`);
  }

  return { client, api, user, job, start, campaign, roles, request, assignment, cleanJobs, cleanUsers, fingerprint, localUrl };
}
