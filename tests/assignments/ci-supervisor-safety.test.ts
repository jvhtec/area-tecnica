import { createHmac, randomUUID, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it } from 'vitest';

// Actual supervisor logic, mocked native transport. These controls do not prove
// Edge Runtime scheduling, gateway framing, or SQL transaction completion.
const source = readFileSync(new URL('./runtime/supervisor.ts', import.meta.url), 'utf8');
type Handler = (request: Request) => Promise<Response>;
type Health = { unsafe: boolean; leased: boolean; workers: number };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

// Fail outside the regression assertion if a source change invalidates a variant.
function replaceRequired(input: string, before: string, after: string) {
  if (!input.includes(before)) throw new Error('Supervisor regression variant anchor missing');
  return input.replace(before, after);
}

async function harness(input = source, options: { queued?: boolean; omitCalls?: boolean } = {}) {
  let handler!: Handler;
  const calls = new Set<string>();
  const origins = new WeakMap<Request, string>();
  const invocationStarted = deferred<void>();
  const invocationGate = deferred<void>();
  const earlyAcknowledgment = deferred<void>();
  let probes = 0;
  let heldRelease: { entered: ReturnType<typeof deferred<void>>; gate: ReturnType<typeof deferred<void>> } | undefined;
  const gateway = { protocol: 1, boot: 'gateway-A', generation: 0, active: 0, uncertainty: 0 };
  const signingSecret = 'mock-only-signing-secret';
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({ alg: 'HS256' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  const serviceKey = `${payload}.${createHmac('sha256', signingSecret).update(payload).digest('base64url')}`;
  const env = {
    CI_STACK_ID: 'staffing-ci-0123456789', CI_CONTROL_TOKEN: 'mock-only-control-token',
    JWT_SECRET: signingSecret, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };
  const worker = {
    key: 'worker-A',
    async fetch(request: Request) {
      if (new URL(request.url).pathname === '/_ci-worker-drain') {
        probes++;
        if (origins.get(request) === '/_local-release' && heldRelease) {
          const held = heldRelease;
          heldRelease = undefined;
          held.entered.resolve();
          await held.gate.promise;
        }
        if (options.queued && calls.size === 0) earlyAcknowledgment.resolve();
        return Response.json({ protocol: 1, boot: 'worker-boot-A', calls: options.omitCalls ? [] : [...calls],
          active: 0, pending: 0, outbound: 0, deferredFailures: 0, transportUncertainty: 0 });
      }
      const call = request.headers.get('x-ci-call');
      if (!call) throw new Error('Supervisor did not stamp invocation');
      invocationStarted.resolve();
      if (options.queued) await invocationGate.promise;
      calls.add(call);
      return new Response('handled', { headers: { 'x-ci-worker-boot': 'worker-boot-A' } });
    },
  };
  const runtime = {
    Deno: {
      env: { toObject: () => env },
      readTextFile: async () => JSON.stringify({ example: { verify_jwt: false } }),
      serve: (callback: Handler) => { handler = callback; },
    },
    EdgeRuntime: {
      userWorkers: { create: async () => worker },
      applySupabaseTag: (original: Request, forwarded: Request) => {
        origins.set(forwarded, new URL(original.url).pathname);
      },
    },
  };
  const withoutImport = replaceRequired(input,
    "import { runtime, type Worker } from './types.ts';", '');
  const javascript = transpileModule(withoutImport, {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 },
  }).outputText;
  await runInNewContext(`(async () => { ${javascript}\n })()`, {
    runtime, Request, Response, Headers, URL, TextDecoder, TextEncoder, atob, setTimeout,
    crypto: { randomUUID, subtle: webcrypto.subtle },
    fetch: async (url: string) => {
      if (new URL(url).pathname !== '/_ci-gateway-state') throw new Error('Unexpected mocked gateway request');
      return Response.json(gateway);
    },
  });
  return {
    gateway, invocationStarted, invocationGate, earlyAcknowledgment,
    get probes() { return probes; },
    invoke: () => handler(new Request('http://ci/example')),
    health: async (): Promise<Health> => (await handler(new Request('http://ci/_local-health'))).json(),
    control: (name: string, body?: unknown) => handler(new Request(`http://ci/${name}`, {
      method: 'POST', headers: { authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })),
    holdNextRelease() {
      const held = { entered: deferred<void>(), gate: deferred<void>() };
      heldRelease = held;
      return held;
    },
  };
}

async function drain(h: Awaited<ReturnType<typeof harness>>) {
  const response = await h.control('_local-drain');
  expect(response.status).toBe(200);
  const state = await response.json() as { lease: string };
  expect(state.lease).toEqual(expect.any(String));
  return state.lease;
}

async function releaseScenario(input: string) {
  const h = await harness(input);
  expect((await h.invoke()).status).toBe(200);
  const leaseA = await drain(h);
  const held = h.holdNextRelease();
  const first = h.control('_local-release', { lease: leaseA });
  await held.entered.promise;
  try {
    const concurrent = await h.control('_local-release', { lease: leaseA });
    // The unfixed variant releases A here: establish B while the old first
    // release is still held, so its eventual completion can expose the bug.
    let leaseB: string;
    if (concurrent.status === 200) leaseB = await drain(h);
    else {
      expect((await h.health()).leased).toBe(true);
      held.gate.resolve();
      await first;
      leaseB = await drain(h);
    }
    held.gate.resolve();
    const firstResponse = await first;
    expect(leaseB).not.toBe(leaseA);
    const stale = await h.control('_local-release', { lease: leaseA });
    const retained = (await h.health()).leased;
    const valid = await h.control('_local-release', { lease: leaseB });
    return { concurrent: concurrent.status, first: firstResponse.status, stale: stale.status,
      retained, valid: valid.status, finallyReleased: !(await h.health()).leased };
  } finally { held.gate.resolve(); await first; }
}

async function checkReleaseSafety(input: string) {
  expect(await releaseScenario(input)).toEqual({ concurrent: 409, first: 200, stale: 409,
    retained: true, valid: 200, finallyReleased: true });
}

async function queuedScenario(input: string) {
  const h = await harness(input, { queued: true });
  const invocation = h.invoke();
  await h.invocationStarted.promise;
  let settled = false;
  const draining = h.control('_local-drain').then(response => { settled = true; return response; });
  await h.earlyAcknowledgment.promise;
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    const earlySettled = settled;
    const earlyUnsafe = (await h.health()).unsafe;
    h.invocationGate.resolve();
    expect((await invocation).status).toBe(200);
    const result = await draining;
    return { earlySettled, earlyUnsafe, status: result.status, health: await h.health(), probes: h.probes };
  } finally { h.invocationGate.resolve(); await invocation; await draining; }
}

async function checkQueuedSafety(input: string) {
  const result = await queuedScenario(input);
  expect(result).toMatchObject({ earlySettled: false, earlyUnsafe: false, status: 200,
    health: { unsafe: false, leased: true, workers: 1 } });
  expect(result.probes).toBeGreaterThanOrEqual(2);
}

async function cleanupRelease(input: string, failure: 'boot' | 'uncertainty') {
  const h = await harness(input);
  expect((await h.invoke()).status).toBe(200);
  const lease = await drain(h);
  // Cleanup's traffic occurs after the initial proof; a restart also destroys
  // the prior gateway's accounting even if its new G0/G1 are internally stable.
  h.gateway.generation++;
  if (failure === 'boot') h.gateway.boot = 'gateway-B';
  else h.gateway.uncertainty = 1;
  const released = await h.control('_local-release', { lease });
  return { status: released.status, health: await h.health(), external: (await h.invoke()).status };
}

async function checkCleanupSafety(input: string, failure: 'boot' | 'uncertainty') {
  expect(await cleanupRelease(input, failure)).toMatchObject({ status: 503,
    health: { unsafe: true, leased: true, workers: 1 }, external: 503 });
}

describe('CI supervisor fence controls with isolated native mocks', () => {
  it('rejects concurrent releases of A and stale A replay without clearing new lease B', async () => {
    await checkReleaseSafety(source);
  });

  it('detects the unfixed concurrent-release variant without changing any file', async () => {
    const variant = replaceRequired(replaceRequired(source, 'unsafe || releasing || !lease', 'unsafe || !lease'),
      "if (lease !== ownedLease) throw new Error('CI release lease identity changed');", '');
    await expect(checkReleaseSafety(variant)).rejects.toThrow();
    expect(await releaseScenario(variant)).toMatchObject({ concurrent: 200, retained: false, valid: 409 });
  });

  it('retries early acknowledgment of a queued call and retains worker affinity after drain', async () => {
    await checkQueuedSafety(source);
  });

  it('detects the unfixed immediate missing-call rejection', async () => {
    const variant = replaceRequired(source,
      "if (foreground === 0 && before === generation) throw new Error('CI worker lost a completed invocation acknowledgment');",
      "throw new Error('CI worker lost a completed invocation acknowledgment');");
    await expect(checkQueuedSafety(variant)).rejects.toThrow();
    expect(await queuedScenario(variant)).toMatchObject({ status: 503, health: { unsafe: true, leased: true } });
  });

  it('refuses stable missing call IDs after the invocation has settled', async () => {
    const h = await harness(source, { omitCalls: true });
    expect((await h.invoke()).status).toBe(200);
    expect((await h.control('_local-drain')).status).toBe(503);
    expect(await h.health()).toMatchObject({ unsafe: true, leased: true });
    expect((await h.invoke()).status).toBe(503);
  });

  it('allows completed cleanup traffic to advance generation before a new release proof', async () => {
    const h = await harness();
    expect((await h.invoke()).status).toBe(200);
    const lease = await drain(h);
    h.gateway.generation++;
    expect((await h.control('_local-release', { lease })).status).toBe(200);
    expect(await h.health()).toMatchObject({ unsafe: false, leased: false, workers: 1 });
  });

  it.each(['boot', 'uncertainty'] as const)('retains the fence when cleanup changes gateway %s', async failure => {
    await checkCleanupSafety(source, failure);
  });

  it.each(['boot', 'uncertainty'] as const)('detects omitted release reproof for gateway %s', async failure => {
    const variant = replaceRequired(source, 'await quiet(request);', '');
    await expect(checkCleanupSafety(variant, failure)).rejects.toThrow();
    expect(await cleanupRelease(variant, failure)).toMatchObject({ status: 200,
      health: { unsafe: false, leased: false }, external: 200 });
  });
});
