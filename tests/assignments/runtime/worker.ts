import { runtime, type Handler, type HttpConnection, type Serve } from './types.ts';

// Imported only into staged test copies, before the untouched production entrypoint.
const boot = crypto.randomUUID();
const secret = runtime.Deno.env.get('CI_CONTROL_TOKEN');
if (!secret) throw new Error('CI worker requires its local control token');
const pending = new Set<Promise<unknown>>();
const calls = new Set<string>();
const waiters = new Set<() => void>();
let active = 0;
let deferredFailures = 0;
let callbackFailures = 0;
let outbound = 0;
let transportUncertainty = 0;
const wake = () => { for (const resolve of waiters) resolve(); waiters.clear(); };
// Observe transport below application catch blocks. Only the gateway can certify
// upstream completion; neither a handled exception nor a quiet socket can do so.
export function beginOutbound() {
  outbound++;
  let finished = false;
  return {
    uncertain() { transportUncertainty++; wake(); },
    finish() { if (!finished) { finished = true; outbound--; wake(); } },
  };
}
const originalWait = runtime.EdgeRuntime.waitUntil.bind(runtime.EdgeRuntime);
runtime.EdgeRuntime.waitUntil = task => {
  const tracked = Promise.resolve(task);
  pending.add(tracked);
  tracked.then(() => { pending.delete(tracked); wake(); }, () => { deferredFailures++; pending.delete(tracked); wake(); });
  originalWait(tracked);
};
function control(request: Request) {
  return new URL(request.url).pathname === '/_ci-worker-drain' && request.headers.get('x-ci-control') === secret;
}
function begin(request: Request) {
  active++;
  const call = request.headers.get('x-ci-call');
  if (call) calls.add(call);
}
function stamp(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-ci-worker-boot', boot);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function quiet() {
  while (active || pending.size || outbound) await new Promise<void>(resolve => waiters.add(resolve));
  return Response.json({ protocol: 1, boot, calls: [...calls], active, pending: pending.size,
    outbound, deferredFailures, callbackFailures, transportUncertainty });
}
const originalServe = runtime.Deno.serve.bind(runtime.Deno);
const wrap = (handler: Handler): Handler => async (request, ...context) => {
  if (control(request)) return quiet();
  begin(request);
  try { return stamp(await handler(request, ...context)); }
  catch (error) { callbackFailures++; throw error; }
  finally { active--; wake(); }
};
runtime.Deno.serve = ((options: unknown, handler?: Handler) => {
  if (typeof options === 'function') return originalServe(wrap(options as Handler));
  if (!handler) throw new Error('Missing CI-wrapped serve handler');
  return originalServe(options, wrap(handler));
}) as Serve;

// std/http's legacy server obtains RequestEvents through nextRequest/iteration.
const originalHttp = runtime.Deno.serveHttp?.bind(runtime.Deno);
if (originalHttp) runtime.Deno.serveHttp = connection => {
  const original = originalHttp(connection);
  const proxy: HttpConnection = new Proxy(original, {
    get(target, key) {
      if (key === Symbol.asyncIterator) return async function* () {
        for (;;) { const event = await proxy.nextRequest(); if (!event) return; yield event; }
      };
      if (key === 'nextRequest') return async () => {
        for (;;) {
          const event = await target.nextRequest();
          if (!event) return null;
          if (control(event.request)) { await event.respondWith(await quiet()); continue; }
          begin(event.request);
          return { request: event.request, async respondWith(response: Response | Promise<Response>) {
            try { await event.respondWith(stamp(await response)); }
            catch (error) { transportUncertainty++; throw error; }
            finally { active--; wake(); }
          } };
        }
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return proxy;
};
