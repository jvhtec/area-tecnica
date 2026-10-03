import { describe, expect, it, vi } from 'vitest';
import { localRequestSafety } from './helpers/localRequestSafety';
import { observeLocalTransport } from './helpers/observeLocalTransport';

describe('full local SDK transport observation', () => {
  it('leaves a completed SQL denial retryable and preserves the SDK response body', async () => {
    const safety = localRequestSafety();
    const source = new Response('{"code":"42501"}', { status: 403 });
    const fetch = observeLocalTransport(vi.fn().mockResolvedValue(source), safety);
    const response = await fetch('http://127.0.0.1:54441/rest/v1/jobs');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: '42501' });
    expect(() => safety.assertSafe()).not.toThrow();
  });

  it('latches a network rejection before the SDK can turn it into a result.error', async () => {
    const safety = localRequestSafety();
    const fetch = observeLocalTransport(vi.fn().mockRejectedValue(new Error('connection lost')), safety);
    await expect(fetch('http://127.0.0.1:54441/rest/v1/jobs')).rejects.toThrow('connection lost');
    expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
  });

  it('latches a truncated body even when HTTP headers were received', async () => {
    const safety = localRequestSafety();
    const body = new ReadableStream({ start(controller) { controller.error(new Error('body interrupted')); } });
    const fetch = observeLocalTransport(vi.fn().mockResolvedValue(new Response(body)), safety);
    await expect(fetch('http://127.0.0.1:54441/rest/v1/jobs')).rejects.toThrow('body interrupted');
    expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
  });

  it('blocks fixture mutation while the response body is still arriving', async () => {
    const safety = localRequestSafety();
    let finish!: () => void;
    const body = new ReadableStream({ start(controller) { finish = () => controller.close(); } });
    const fetch = observeLocalTransport(vi.fn().mockResolvedValue(new Response(body)), safety);
    const pending = fetch('http://127.0.0.1:54441/rest/v1/jobs');
    expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
    finish(); await pending;
    expect(() => safety.assertSafe()).not.toThrow();
  });
});
