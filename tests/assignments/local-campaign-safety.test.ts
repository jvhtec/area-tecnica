import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';
import * as requestSafety from './helpers/localRequestSafety';
import * as runtimeFence from './helpers/withLocalRuntimeFence';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
// Unit tests exercise ownership/order gates; real runtime fencing is tested
// separately and is mandatory in every opt-in integration run.
vi.mock('./helpers/withLocalRuntimeFence', () => ({ withLocalRuntimeFence: (_runtime: unknown, action: (check: () => void) => Promise<unknown>) => action(() => undefined) }));
const command = vi.mocked(execFileSync);
const jwt = (role: string, iss = 'supabase-demo') => `header.${Buffer.from(JSON.stringify({ role, iss })).toString('base64url')}.signature`;

function snapshotResponse(parts: string[], staleFile?: string, adapter = false) {
  if (parts[0] === 'network') return JSON.stringify([{ Internal: true }]);
  if (parts[0] === 'inspect') return JSON.stringify([{ NetworkSettings: { Networks: { 'area-tecnica-history': {} } } }]);
  return parts.filter(part => part.startsWith('/local/functions/')).map(path => {
    const file = path.slice('/local/functions/'.length);
    const prefix = adapter && file.endsWith('/index.ts') ? "import '../../outbound.ts';\n" : '';
    const source = file === staleFile ? 'stale source' : prefix + readFileSync(new URL(`../../supabase/functions/${file}`, import.meta.url), 'utf8');
    return `${path}\0${source}\0`;
  }).join('');
}

describe('local campaign fixture safety gates', () => {
  beforeEach(() => {
    vi.stubEnv('STAFFING_EDGE_TEST_URL', 'http://127.0.0.1:54441');
    vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY', jwt('anon'));
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role'));
    command.mockReset();
    vi.mocked(createClient).mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('rejects a hosted project URL before reading Docker or creating clients', () => {
    vi.stubEnv('STAFFING_EDGE_TEST_URL', 'https://syldobdcdsgfgjtbuwxm.supabase.co');
    expect(() => localCampaignHarness()).toThrow('Only the isolated historical localhost gateway');
    expect(command).not.toHaveBeenCalled();
  });
  it('rejects a hosted-project credential even with the localhost URL', () => {
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role', 'supabase'));
    expect(() => localCampaignHarness()).toThrow('not local demo keys');
    expect(command).not.toHaveBeenCalled();
  });
  it('rejects missing credentials before any Docker/database action', () => {
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', '');
    expect(() => localCampaignHarness()).toThrow('Local keys are required');
    expect(command).not.toHaveBeenCalled();
  });
  it('rejects a historical network with outbound routing', () => {
    command.mockReturnValue(JSON.stringify([{ Internal: false }]));
    expect(() => localCampaignHarness()).toThrow('no external route');
    expect(command).toHaveBeenCalledTimes(1);
  });
  it('rejects a runtime/database/capture attached to an additional network', () => {
    command.mockReturnValueOnce(JSON.stringify([{ Internal: true }]))
      .mockReturnValue(JSON.stringify([{ NetworkSettings: { Networks: { 'area-tecnica-history': {}, bridge: {} } } }]));
    expect(() => localCampaignHarness()).toThrow('only the isolated network');
    expect(command).toHaveBeenCalledTimes(2);
  });

  it.each(['send-staffing-email/index.ts', 'send-staffing-email/persistRequests.ts', '_shared/cors.ts',
    'notify-staffing-cancellation/index.ts', 'push/inbox.ts'])(
    'rejects a stale sender dependency: %s', staleFile => {
      command.mockImplementation((...args) => snapshotResponse(args[1] as string[], staleFile));
      expect(() => localCampaignHarness()).toThrow(`Local runtime source is stale: ${staleFile}`);
    });

  it('accepts matching source snapshots with only the local entry-point adapter added', () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[], undefined, true));
    expect(localCampaignHarness().localUrl).toBe('http://127.0.0.1:54441');
    expect(command).toHaveBeenCalledWith('docker', expect.arrayContaining(['/local/functions/send-staffing-email/index.ts']), expect.anything());
  });

  it('rejects a truncated source batch before creating a database client', () => {
    command.mockImplementation((...args) => {
      const parts = args[1] as string[];
      const response = snapshotResponse(parts);
      return parts[0] === 'exec' ? response.slice(0, -1) : response;
    });
    expect(() => localCampaignHarness()).toThrow('Invalid local source snapshot framing');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects substituted source paths even with the expected frame count', () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[])
      .replace('/local/functions/staffing-orchestrator/index.ts', '/local/functions/other.ts'));
    expect(() => localCampaignHarness()).toThrow('Invalid local source snapshot path');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('cleans owned activity even when a successful job delete leaves a fixture row behind', async () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[]));
    const activityDelete = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const client = { from: vi.fn((table: string) => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: table === 'activity_log' ? activityDelete : table === 'notification_inbox'
        ? vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }) : vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null, data: [{ id: 'surviving-fixture' }] }) }),
    })) };
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    const h = localCampaignHarness();
    await h.job();
    await expect(h.cleanJobs()).rejects.toThrow();
    expect(activityDelete).toHaveBeenCalledOnce();
  });

  it('refuses fixture creation and all cleanup after a campaign transport timeout', async () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[]));
    const guard = requestSafety.localRequestSafety();
    const observer = vi.spyOn(requestSafety, 'localRequestSafety').mockReturnValue(guard);
    const client = { from: vi.fn(), auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } } };
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    try {
      const h = localCampaignHarness();
      await expect(guard.run(async () => { throw new Error('campaign timeout'); })).rejects.toThrow('campaign timeout');
      expect(() => h.assertCleanupSafe()).toThrow('Owned fixtures retained');
      for (const action of [h.job, h.user, h.cleanJobs, h.cleanUsers]) {
        await expect(action()).rejects.toThrow('Owned fixtures retained');
      }
      expect(client.from).not.toHaveBeenCalled();
      expect(client.auth.admin.createUser).not.toHaveBeenCalled();
      expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();
    } finally { observer.mockRestore(); }
  });

  it('retries a completed cleanup failure and still removes owned Auth users', async () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[]));
    const remaining = vi.fn().mockResolvedValueOnce({ error: null, data: [{ id: 'survivor' }] })
      .mockResolvedValue({ error: null, data: [] });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: { admin: { createUser: vi.fn().mockResolvedValue({ error: null, data: { user: { id: 'owned-user' } } }), deleteUser },
        signInWithPassword: vi.fn().mockResolvedValue({ error: null, data: { session: { access_token: 'local-token' } } }) },
      from: vi.fn((table: string) => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        delete: table === 'jobs' ? vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })
          : vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        select: vi.fn().mockReturnValue({ in: remaining }),
      })),
    };
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    const h = localCampaignHarness();
    await h.user(); await h.job();
    await expect(h.cleanJobs()).rejects.toThrow();
    expect(h.cleanupSafe).toBe(true);
    expect(() => h.assertCleanupSafe()).not.toThrow();
    expect(() => h.assertFixtureSafe()).toThrow('require successful cleanup');
    for (const action of [h.job, h.user, () => h.request('job', 'user', 'offer', 'pending'),
      () => h.assignment('job', 'user', 'invited'), () => h.api('start', {})]) {
      await expect(action()).rejects.toThrow('require successful cleanup');
    }
    await h.cleanUsers();
    expect(deleteUser).toHaveBeenCalledWith('owned-user');
    expect(() => h.assertFixtureSafe()).toThrow('require successful cleanup');
    await h.cleanJobs();
    expect(remaining).toHaveBeenCalledTimes(2);
    expect(() => h.assertFixtureSafe()).not.toThrow();
    await h.job();
  });

  it('retains both callback and release errors while poisoning safety only on failed release', async () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[]));
    const sql = new Error('owned SQL failure'); const release = new Error('release transport failed');
    const fence = vi.spyOn(runtimeFence, 'withLocalRuntimeFence').mockImplementationOnce(async (_runtime, action) => {
      await action(() => undefined); throw release;
    });
    try {
      const h = localCampaignHarness();
      await expect(h.withCleanupFence(async () => { throw sql; })).rejects.toMatchObject({ errors: [sql, release] });
      expect(h.cleanupSafe).toBe(false);
      await expect(h.cleanUsers()).rejects.toThrow('Owned fixtures retained');
    } finally { fence.mockRestore(); }
  });

  it('does not clear a retained-user guard when job cleanup succeeds', async () => {
    command.mockImplementation((...args) => snapshotResponse(args[1] as string[]));
    const deleteUser = vi.fn().mockResolvedValueOnce({ error: { message: 'completed deletion denial' } })
      .mockResolvedValue({ error: null });
    const client = {
      auth: { admin: { createUser: vi.fn().mockResolvedValue({ error: null, data: { user: { id: 'owned-user' } } }), deleteUser },
        signInWithPassword: vi.fn().mockResolvedValue({ error: null, data: { session: { access_token: 'local-token' } } }) },
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })),
    };
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    const h = localCampaignHarness();
    await h.user();
    await expect(h.cleanUsers()).rejects.toThrow('remaining IDs: owned-user');
    expect(h.cleanupSafe).toBe(true);
    await h.cleanJobs();
    await expect(h.job()).rejects.toThrow('require successful cleanup');
    await expect(h.user()).rejects.toThrow('require successful cleanup');
    await h.cleanUsers();
    expect(() => h.assertFixtureSafe()).not.toThrow();
    await h.job();
  });
});
