import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
const command = vi.mocked(execFileSync);
const readSource = vi.mocked(readFileSync);
const jwt = (role: string, iss = 'supabase-demo') => `header.${Buffer.from(JSON.stringify({ role, iss })).toString('base64url')}.signature`;

describe('local campaign fixture safety gates', () => {
  beforeEach(() => {
    vi.stubEnv('STAFFING_EDGE_TEST_URL', 'http://127.0.0.1:54441');
    vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY', jwt('anon'));
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role'));
    command.mockReset();
    readSource.mockReset();
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

  it.each(['send-staffing-email/index.ts', 'send-staffing-email/persistRequests.ts', '_shared/cors.ts'])(
    'rejects a stale sender dependency: %s', staleFile => {
      readSource.mockReturnValue('current source');
      command.mockImplementation((...args) => {
        const parts = args[1] as string[];
        if (parts[0] === 'network') return JSON.stringify([{ Internal: true }]);
        if (parts[0] === 'inspect') return JSON.stringify([{ NetworkSettings: { Networks: { 'area-tecnica-history': {} } } }]);
        return parts.at(-1) === `/local/functions/${staleFile}` ? 'stale source' : 'current source';
      });
      expect(() => localCampaignHarness()).toThrow(`Local runtime source is stale: ${staleFile}`);
    });

  it('accepts matching source snapshots with only the local entry-point adapter added', () => {
    readSource.mockReturnValue('current source\r\n');
    command.mockImplementation((...args) => {
      const parts = args[1] as string[];
      if (parts[0] === 'network') return JSON.stringify([{ Internal: true }]);
      if (parts[0] === 'inspect') return JSON.stringify([{ NetworkSettings: { Networks: { 'area-tecnica-history': {} } } }]);
      const prefix = parts.at(-1)?.endsWith('/index.ts') ? "import '../../outbound.ts';\n" : '';
      return `${prefix}current source\n`;
    });
    expect(localCampaignHarness().localUrl).toBe('http://127.0.0.1:54441');
    expect(command).toHaveBeenCalledWith('docker', expect.arrayContaining(['/local/functions/send-staffing-email/index.ts']), expect.anything());
  });

  it('cleans owned activity even when a successful job delete leaves a fixture row behind', async () => {
    readSource.mockReturnValue('current source');
    command.mockImplementation((...args) => {
      const parts = args[1] as string[];
      if (parts[0] === 'network') return JSON.stringify([{ Internal: true }]);
      if (parts[0] === 'inspect') return JSON.stringify([{ NetworkSettings: { Networks: { 'area-tecnica-history': {} } } }]);
      return 'current source';
    });
    const activityDelete = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const client = { from: vi.fn((table: string) => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: table === 'activity_log' ? activityDelete : vi.fn().mockReturnValue({
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
});
