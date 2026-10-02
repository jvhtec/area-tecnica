import { describe, expect, it, vi } from 'vitest';
import { checkStaffingDeployment } from '../../scripts/ci/check-staffing-deployment.mjs';

const options = { projectRef: 'syldobdcdsgfgjtbuwxm', slugs: 'push staffing-click',
  source: "await supabase.rpc('assign_staffing_offer', parameters)", accessToken: 'test-token' };

describe('staffing deployment prerequisite gate', () => {
  it('checks both migrations through the read-only endpoint before permitting deployment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json([{ ready: true }]));
    await checkStaffingDeployment({ ...options, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.supabase.com/v1/projects/syldobdcdsgfgjtbuwxm/database/query/read-only');
    const { query } = JSON.parse(init.body);
    expect(query).toContain('20261002082653');
    expect(query).toContain('20261002105500');
    expect(query).toContain('public.assign_staffing_offer(uuid,date[],boolean,text)');
    expect(query).toContain('public.remove_assignment_with_timesheets(uuid,uuid)');
  });
  it.each([[{ ready: false }], [], [{ ready: 'true' }], { ready: true }])('blocks missing or unverified prerequisites: %j', async rows => {
    await expect(checkStaffingDeployment({ ...options,
      fetchImpl: vi.fn().mockResolvedValue(Response.json(rows)) })).rejects.toThrow('Refusing staffing-click deployment');
  });
  it('blocks API denial without printing its response body or credentials', async () => {
    await expect(checkStaffingDeployment({ ...options,
      fetchImpl: vi.fn().mockResolvedValue(new Response('private details', { status: 403 })) }))
      .rejects.toThrow('Staffing database preflight failed (HTTP 403)');
  });
  it('blocks a network failure', async () => {
    await expect(checkStaffingDeployment({ ...options,
      fetchImpl: vi.fn().mockRejectedValue(new Error('connection unavailable')) })).rejects.toThrow('connection unavailable');
  });
  it('requires a token before querying production', async () => {
    const fetchImpl = vi.fn();
    await expect(checkStaffingDeployment({ ...options, accessToken: '', fetchImpl })).rejects.toThrow('SUPABASE_ACCESS_TOKEN');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([{ slugs: 'push' }, { source: 'old handler without the atomic RPC' }])('allows unrelated deployments and deliberate older-handler rollback: %j', async override => {
    const fetchImpl = vi.fn();
    await checkStaffingDeployment({ ...options, ...override, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
