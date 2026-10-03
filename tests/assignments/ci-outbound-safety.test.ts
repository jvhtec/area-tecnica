import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const identity = 'staffing-ci-0123456789', secret = 'a'.repeat(64);
const native = vi.fn<typeof fetch>();
let wrapped: typeof fetch;
let serve: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules(); native.mockReset(); serve = vi.fn();
  const env: Record<string, string> = { CI_STACK_ID: identity, CI_CONTROL_TOKEN: secret };
  vi.stubGlobal('Deno', { env: { get: (key: string) => env[key] }, serve });
  vi.stubGlobal('EdgeRuntime', { waitUntil: vi.fn() });
  vi.stubGlobal('fetch', native);
  await import('./runtime/outbound.ts'); wrapped = globalThis.fetch;
});
afterEach(() => { vi.unstubAllGlobals(); });
async function state() {
  const deno = (globalThis as unknown as { Deno: { serve(handler: (request: Request) => Response): void } }).Deno;
  deno.serve(() => Response.json({ handled: true }));
  const handler = serve.mock.calls.at(-1)![0] as (request: Request) => Promise<Response>;
  return (await handler(new Request('http://ci/_ci-worker-drain', { headers: { 'x-ci-control': secret } }))).json();
}
const completed = (body = '{}', status = 200) => new Response(body, { status, headers: { 'x-ci-upstream-complete': '1' } });

describe('CI outbound completion observation beneath application catches', () => {
  it('requires gateway provenance rather than treating received HTTP status as completion', async () => {
    native.mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(wrapped(`http://${identity}-gateway:8000/rest/v1/jobs`)).rejects.toThrow('certify');
    expect(await state()).toMatchObject({ outbound: 0, transportUncertainty: 1 });
  });
  it('retains transport uncertainty when the application catches an abort', async () => {
    native.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    try { await wrapped(`http://${identity}-gateway:8000/rest/v1/jobs`); } catch { /* Handled by application. */ }
    expect(await state()).toMatchObject({ outbound: 0, transportUncertainty: 1 });
  });
  it('observes a response stream failure before an application body-read catch', async () => {
    const failure = new Error('Truncated wire body');
    native.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.error(failure); } }),
      { headers: { 'x-ci-upstream-complete': '1' } }));
    await expect(wrapped(`http://${identity}-gateway:8000/rest/v1/jobs`)).rejects.toBe(failure);
    expect((await state()).transportUncertainty).toBeGreaterThan(0);
  });
  it.each([500, 503])('allows a fully received application %i and certified cancellation', async status => {
    native.mockResolvedValue(completed('{}', status));
    const response = await wrapped(`http://${identity}-gateway:8000/rest/v1/jobs`);
    expect(response.status).toBe(status); await response.body?.cancel();
    expect(await state()).toMatchObject({ outbound: 0, transportUncertainty: 0 });
  });
  it('distinguishes JSON syntax failure after full receipt from transport failure', async () => {
    native.mockResolvedValue(completed('plain'));
    const response = await wrapped(`http://${identity}-gateway:8000/rest/v1/jobs`);
    await expect(response.json()).rejects.toBeInstanceOf(SyntaxError);
    expect((await state()).transportUncertainty).toBe(0);
  });
  it('forces redirect refusal and routes provider capture through the accounted gateway', async () => {
    native.mockResolvedValue(completed('{}', 201));
    await wrapped('https://api.brevo.com/v3/smtp/email', { method: 'POST', body: '{}' });
    const request = native.mock.calls[0][0] as Request;
    expect(request.url).toBe(`http://${identity}-gateway:8000/_ci-capture/capture`);
    expect(request.redirect).toBe('error'); expect(request.headers.get('x-ci-child')).toBe(secret);
  });
  it('refuses an external destination after local capture without issuing its request', async () => {
    native.mockResolvedValue(completed('{}', 400));
    await expect(wrapped('https://unexpected.invalid/deliver')).rejects.toThrow('refused');
    expect(native).toHaveBeenCalledTimes(1);
    expect((native.mock.calls[0][0] as Request).url).toBe(`http://${identity}-gateway:8000/_ci-capture/capture`);
  });
});
