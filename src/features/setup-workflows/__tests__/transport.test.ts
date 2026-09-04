import { expect, it, vi } from 'vitest';
import { workflowFixture } from './fixtures';

const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return { supabase: createClient('https://setup.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport.fetch },
  }) };
});
import { createWorkflow } from '../service';

it('requests a singular RPC resource and returns a workflow object through the real Supabase transport', async () => {
  transport.fetch.mockImplementation(async (_url: string, init: RequestInit) => {
    const singular = new Headers(init.headers).get('accept') === 'application/vnd.pgrst.object+json';
    return new Response(JSON.stringify(singular ? workflowFixture : [workflowFixture]), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const result = await createWorkflow({ workflowType: 'job', entityId: 'job-1', departments: ['sound'] });
  expect(result).toEqual(workflowFixture);
  expect(transport.fetch).toHaveBeenCalledOnce();
  const [url, init] = transport.fetch.mock.calls[0];
  expect(url).toContain('/rest/v1/rpc/mutate_setup_workflow');
  expect(JSON.parse(init.body)).toMatchObject({
    p_action: 'create', p_payload: { type: 'job', entity_id: 'job-1' },
  });
});
