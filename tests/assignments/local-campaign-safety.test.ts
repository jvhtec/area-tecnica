import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
const command = vi.mocked(execFileSync);
const jwt = (role: string, iss = 'supabase-demo') => `header.${Buffer.from(JSON.stringify({ role, iss })).toString('base64url')}.signature`;

describe('local campaign fixture safety gates', () => {
  beforeEach(() => {
    vi.stubEnv('STAFFING_EDGE_TEST_URL', 'http://127.0.0.1:54441');
    vi.stubEnv('STAFFING_EDGE_TEST_ANON_KEY', jwt('anon'));
    vi.stubEnv('STAFFING_EDGE_TEST_SERVICE_KEY', jwt('service_role'));
    command.mockReset();
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
});
