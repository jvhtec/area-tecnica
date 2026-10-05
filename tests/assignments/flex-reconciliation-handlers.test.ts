import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const job = 'fc210000-0000-0000-0000-000000000001';
function loadHandler(kind: 'manage-flex-crew-assignments' | 'sync-flex-crew-for-job', role: string | null = 'management',
  calls = [{ department: 'sound', flex_element_id: job as string | null }, { department: 'lights', flex_element_id: job as string | null }],
  callError: { message: string } | null = null) {
  let handler!: (req: Request) => Promise<Response>;
  const summary = { added: 0, removed: 0, kept: 1, rolesSet: 0, diagnostics: [] };
  const reconcile = vi.fn(async () => summary);
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'manager' } }, error: null })) },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn((table: string) => {
      const query = {
        select: () => query, eq: () => query, limit: () => query,
        maybeSingle: async () => ({ data: role === null ? null : { role }, error: null }),
        then: (done: (v: unknown) => unknown) => Promise.resolve({ data: table === 'flex_crew_calls' ? calls : [], error: table === 'flex_crew_calls' ? callError : null }).then(done),
      };
      return query;
    }),
  };
  const modules = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    if (modules.has(path)) return modules.get(path)!;
    const exports: Record<string, unknown> = {};
    modules.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path,
    }).outputText;
    runInNewContext(code, {
      exports, require: (specifier: string) => {
        if (specifier.startsWith('https://deno.land/')) return { serve: (fn: typeof handler) => { handler = fn; } };
        if (specifier === 'npm:@supabase/supabase-js@2') return { createClient: () => client };
        if (specifier.endsWith('/flexCrewReconciliation.ts')) return { reconcileFlexCrew: reconcile };
        if (specifier.endsWith('/structuredLogger.ts')) return { logEvent: () => undefined };
        if (!specifier.startsWith('.')) throw new Error(`Unexpected dependency ${specifier}`);
        return load(resolve(dirname(path), specifier));
      },
      Deno: { env: { get: (key: string) => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-key', X_AUTH_TOKEN: 'test-flex' })[key] } },
      Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, crypto, console,
    });
    return exports;
  }
  load(resolve('supabase/functions', kind, 'index.ts'));
  const send = (body: unknown, authorized = true) => handler(new Request('https://edge.test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer manager-token' } : {}) }, body: JSON.stringify(body),
  }));
  return { send, reconcile, client, summary };
}

describe('Flex reconciliation HTTP adapters', () => {
  it.each([{ calls: [] }, { calls: [{ department: 'sound', flex_element_id: null }] },
    { calls: [{ department: 'sound', flex_element_id: '' }] },
    { calls: [{ department: 'sound', flex_element_id: '   ' }] }])('an unmapped department succeeds without provider access: %j', async ({ calls }) => {
    const { send, reconcile } = loadHandler('manage-flex-crew-assignments', 'management', calls);
    const response = await send({ job_id: job, department: 'sound', action: 'add' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, added: 0, removed: 0, kept: 0, rolesSet: 0 });
    expect(reconcile).not.toHaveBeenCalled();
  });
  it('bulk ignores unmapped calls but reconciles the mapped department', async () => {
    const { send, reconcile, summary } = loadHandler('sync-flex-crew-for-job', 'management',
      [{ department: 'sound', flex_element_id: job }, { department: 'lights', flex_element_id: null }]);
    expect(await (await send({ job_id: job })).json()).toEqual({ ok: true, job_id: job, summary: { sound: summary } });
    expect(reconcile.mock.calls.map(call => call[2])).toEqual(['sound']);
  });
  it.each(['manage-flex-crew-assignments', 'sync-flex-crew-for-job'] as const)('%s refuses crew-call lookup errors', async kind => {
    const { send, reconcile } = loadHandler(kind, 'management', [], { message: 'lookup unavailable' });
    expect((await send({ job_id: job, department: 'sound', action: 'add' })).status).toBe(503);
    expect(reconcile).not.toHaveBeenCalled();
  });
  it.each(['add', 'remove'])('legacy %s body requests current reconciliation without forwarding historical intent', async action => {
    const { send, reconcile, summary } = loadHandler('manage-flex-crew-assignments');
    const response = await send({ job_id: job, technician_id: 'old-technician', action, department: 'sound' });
    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledExactlyOnceWith(expect.anything(), job, 'sound', 'test-flex');
    expect(await response.json()).toMatchObject({ success: true, ...summary });
  });
  it('bulk uses the same coordinator and preserves the frontend ok contract', async () => {
    const { send, reconcile, summary } = loadHandler('sync-flex-crew-for-job');
    const response = await send({ job_id: job });
    expect(await response.json()).toEqual({ ok: true, job_id: job, summary: { sound: summary, lights: summary } });
    expect(reconcile.mock.calls.map(call => call[2])).toEqual(['sound', 'lights']);
  });
  it.each(['manage-flex-crew-assignments', 'sync-flex-crew-for-job'] as const)('%s denies missing profiles before claiming ownership', async kind => {
    const { send, reconcile } = loadHandler(kind, null);
    expect((await send({ job_id: job, department: 'sound', action: 'add' })).status).toBe(403);
    expect(reconcile).not.toHaveBeenCalled();
  });
  it('denies missing bearer, unsupported departments and malformed job identities', async () => {
    const { send, reconcile } = loadHandler('manage-flex-crew-assignments');
    expect((await send({ job_id: job, department: 'sound', action: 'add' }, false)).status).toBe(401);
    for (const body of [{ job_id: job, department: 'video', action: 'add' }, { job_id: '-'.repeat(36), department: 'sound', action: 'add' }]) {
      expect((await send(body)).status).toBe(400);
    }
    expect(reconcile).not.toHaveBeenCalled();
  });
});
