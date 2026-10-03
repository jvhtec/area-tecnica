import { beginOutbound } from './worker.ts';
import { runtime } from './types.ts';

const identity = runtime.Deno.env.get('CI_STACK_ID');
const token = runtime.Deno.env.get('CI_CONTROL_TOKEN');
if (!identity || !/^staffing-ci-[a-f0-9]{10}$/.test(identity) || !token) throw new Error('Synthetic CI identity required');
const original = globalThis.fetch.bind(globalThis);
const gateway = `${identity}-gateway:8000`;
const capture = `http://${gateway}/_ci-capture/capture`;

async function observed(request: Request) {
  const tracking = beginOutbound();
  try {
    const response = await original(new Request(request, { redirect: 'error' }));
    if (response.headers.get('x-ci-upstream-complete') !== '1' || response.headers.has('x-ci-transport-uncertain')) {
      throw new Error('CI gateway could not certify upstream completion');
    }
    // The gateway certifies upstream completion. Also receive its entire bounded
    // reply here: a later body-read failure must not invalidate an earlier drain.
    if (!response.body) return response;
    const body = await response.arrayBuffer();
    if (body.byteLength > 16 * 1024 * 1024) throw new Error('CI gateway reply exceeds the certified bound');
    const wrapped = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    Object.defineProperties(wrapped, { url: { value: response.url }, redirected: { value: response.redirected }, type: { value: response.type } });
    return wrapped;
  } catch (error) { tracking.uncertain(); throw error; }
  finally { tracking.finish(); }
}
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (!url.username && !url.password && url.protocol === 'http:' && url.host === gateway) {
    request.headers.set('x-ci-child', token);
    return observed(request);
  }
  const email = url.origin === 'https://api.brevo.com' && url.pathname === '/v3/smtp/email' && request.method === 'POST';
  const whatsapp = url.origin === 'https://local-waha.invalid' && url.pathname === '/api/sendText' && request.method === 'POST';
  const kind = email ? 'email' : whatsapp ? 'whatsapp' : 'blocked';
  const body = kind === 'blocked' ? '' : await request.text();
  const result = await observed(new Request(capture, { method: 'POST', signal: request.signal,
    headers: { 'Content-Type': 'application/json', 'x-ci-child': token },
    body: JSON.stringify({ kind, hostname: url.hostname, method: request.method, body }) }));
  if (kind === 'blocked') { await result.body?.cancel(); throw new Error(`CI refused external destination: ${url.hostname}`); }
  return result;
};
