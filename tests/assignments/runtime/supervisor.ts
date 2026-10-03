import { runtime, type Worker } from './types.ts';

// A separate main-worker process for tests; never deployed as a production function.
const env = runtime.Deno.env.toObject();
if (!/^staffing-ci-[a-f0-9]{10}$/.test(env.CI_STACK_ID) || !env.CI_CONTROL_TOKEN) throw new Error('CI runtime identity missing');
const manifest: Record<string, { verify_jwt: boolean }> = JSON.parse(await runtime.Deno.readTextFile('/local/manifest.json'));
type RecordState = { worker: Worker; boot?: string; calls: Set<string> };
const records = new Map<string, RecordState>();
const probes = new Set(['_ci-probe-modern', '_ci-probe-legacy']);
let foreground = 0;
let generation = 0;
let lease: string | null = null;
let unsafe = false;
let gatewayBoot: string | undefined;
let releasing = false;
const bytes = (part: string) => Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(part.length / 4) * 4, '=')), c => c.charCodeAt(0));
async function validJWT(token: string) {
  try {
    const [header, body, signature, extra] = token.split('.');
    if (extra || JSON.parse(new TextDecoder().decode(bytes(header))).alg !== 'HS256') return false;
    const claims = JSON.parse(new TextDecoder().decode(bytes(body)));
    if (typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, bytes(signature), new TextEncoder().encode(`${header}.${body}`));
  } catch { return false; }
}
async function getWorker(slug: string) {
  const worker = await runtime.EdgeRuntime.userWorkers.create({
    servicePath: probes.has(slug) ? `/local/${slug}` : `/local/functions/${slug}`,
    // Pinned per_worker retires idle workers halfway through their wall budget.
    // This gives 40 minutes of retention for a 35-minute CI job, with margin.
    // Retirement still fails closed instead of discarding invocation evidence.
    forceCreate: false, memoryLimitMb: 256, workerTimeoutMs: 4_800_000, noModuleCache: false,
    context: { useReadSyncFileAPI: true }, envVars: Object.entries({ ...env, SUPABASE_FUNCTION_SLUG: slug }),
  });
  let record = records.get(worker.key);
  if (!record) { record = { worker, calls: new Set() }; records.set(worker.key, record); generation++; }
  return record;
}
async function quiet(request: Request) {
  async function gatewayState() {
    const response = await fetch(`http://${env.CI_STACK_ID}-gateway:8000/_ci-gateway-state`, {
      redirect: 'error', headers: { 'x-ci-child': env.CI_CONTROL_TOKEN },
    });
    const state = await response.json();
    if (response.status !== 200 || state.protocol !== 1 || typeof state.boot !== 'string' ||
        (gatewayBoot && gatewayBoot !== state.boot) ||
        !Number.isSafeInteger(state.generation) || !Number.isSafeInteger(state.active) || state.uncertainty !== 0) {
      throw new Error('CI gateway completion is uncertain');
    }
    gatewayBoot = state.boot;
    return state;
  }
  for (;;) {
    if (unsafe) throw new Error('CI completion is ambiguous');
    const before = generation;
    const gatewayBefore = await gatewayState();
    let incompleteAcknowledgment = false;
    for (const record of [...records.values()]) {
      const probe = new Request('http://ci/_ci-worker-drain', { method: 'POST', headers: { 'x-ci-control': env.CI_CONTROL_TOKEN } });
      runtime.EdgeRuntime.applySupabaseTag(request, probe);
      const response = await record.worker.fetch(probe);
      const state = await response.json();
      if (response.status !== 200 || state.protocol !== 1 || state.active !== 0 || state.pending !== 0 ||
          state.outbound !== 0 || state.deferredFailures !== 0 || state.transportUncertainty !== 0 ||
          (record.boot && state.boot !== record.boot) || !Array.isArray(state.calls)) {
        throw new Error('CI worker did not prove invocation/deferred-task completion');
      }
      if (![...record.calls].every(id => state.calls.includes(id))) {
        if (foreground === 0 && before === generation) throw new Error('CI worker lost a completed invocation acknowledgment');
        incompleteAcknowledgment = true;
      }
    }
    const gatewayAfter = await gatewayState();
    if (!unsafe && !incompleteAcknowledgment && foreground === 0 && before === generation &&
        gatewayBefore.active === 0 && gatewayAfter.active === 0 &&
        gatewayBefore.boot === gatewayAfter.boot && gatewayBefore.generation === gatewayAfter.generation) {
      for (const record of records.values()) record.calls.clear();
      return { runtime: 'isolated-local', drain_protocol: 1, active: 0, pending: 0, lease };
    }
    // Recheck state changes caused by nested dispatch, rather than treating delay as proof.
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
runtime.Deno.serve(async request => {
  const slug = new URL(request.url).pathname.split('/')[1];
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (slug === '_local-health') return Response.json({ runtime: 'isolated-local', target: 'synthetic-ci', drain_protocol: 1, unsafe, leased: !!lease, foreground, generation, workers: records.size });
  if (slug === '_local-drain' || slug === '_local-release' || slug === '_local-bootstrap') {
    if (token !== env.SUPABASE_SERVICE_ROLE_KEY || !await validJWT(token)) return new Response(null, { status: 401 });
    if (request.method !== 'POST') return new Response(null, { status: 409 });
    if (slug === '_local-bootstrap') {
      if (lease || unsafe) return new Response(null, { status: 409 });
      foreground++; generation++;
      try {
        for (const name of Object.keys(manifest)) {
          const record = await getWorker(name);
          const probe = new Request('http://ci/_ci-worker-drain', { method: 'POST', headers: { 'x-ci-control': env.CI_CONTROL_TOKEN } });
          runtime.EdgeRuntime.applySupabaseTag(request, probe);
          const response = await record.worker.fetch(probe); const state = await response.json();
          if (response.status !== 200 || state.protocol !== 1 || state.active || state.pending || state.outbound ||
              state.deferredFailures || state.transportUncertainty || typeof state.boot !== 'string') throw new Error('CI bootstrap acknowledgment failed');
          record.boot = state.boot;
        }
        return Response.json({ bootstrapped: Object.keys(manifest).length });
      } catch { unsafe = true; return new Response(null, { status: 503 }); }
      finally { foreground--; }
    }
    if (slug === '_local-drain') {
      if (lease) return new Response(null, { status: 409 });
      lease = crypto.randomUUID();
      try { return Response.json(await quiet(request)); }
      catch { unsafe = true; return Response.json({ error: 'CI completion unknown; admission remains closed' }, { status: 503 }); }
    }
    const body = await request.json();
    if (unsafe || releasing || !lease || body.lease !== lease) return new Response(null, { status: 409 });
    const ownedLease = lease;
    releasing = true;
    // Cleanup can create its own gateway requests while the Edge lease is held.
    // Certify those requests too; the earlier drain cannot certify later work.
    try {
      await quiet(request);
      if (lease !== ownedLease) throw new Error('CI release lease identity changed');
      lease = null;
      return Response.json({ released: true });
    }
    catch { unsafe = true; return new Response(null, { status: 503 }); }
    finally { releasing = false; }
  }
  if (!Object.hasOwn(manifest, slug) && !probes.has(slug)) return new Response(null, { status: 404 });
  if (lease && request.headers.get('x-ci-child') !== env.CI_CONTROL_TOKEN) return new Response(null, { status: 503 });
  foreground++; generation++;
  try {
    if ((manifest[slug]?.verify_jwt || probes.has(slug)) &&
        ((probes.has(slug) && token !== env.SUPABASE_SERVICE_ROLE_KEY) || !await validJWT(token))) return new Response(null, { status: 401 });
    const record = await getWorker(slug);
    const call = crypto.randomUUID(); record.calls.add(call); generation++;
    const forwarded = new Request(request);
    forwarded.headers.delete('x-ci-child'); forwarded.headers.set('x-ci-call', call);
    runtime.EdgeRuntime.applySupabaseTag(request, forwarded);
    const response = await record.worker.fetch(forwarded);
    const boot = response.headers.get('x-ci-worker-boot');
    if (!boot || (record.boot && record.boot !== boot)) throw new Error('CI invocation worker affinity changed');
    record.boot = boot;
    const headers = new Headers(response.headers); headers.delete('x-ci-worker-boot');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch { unsafe = true; return Response.json({ error: 'CI invocation completion unknown' }, { status: 503 }); }
  finally { foreground--; }
});
