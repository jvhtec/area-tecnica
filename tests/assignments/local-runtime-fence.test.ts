import { describe, expect, it, vi } from 'vitest';
import { withLocalRuntimeFence } from './helpers/withLocalRuntimeFence';
import { localRequestSafety } from './helpers/localRequestSafety';

const lease = 'bb966bfc-478f-4c87-b7b7-389e1c48b76b';
const drained = { runtime: 'isolated-local', drain_protocol: 1, pending: 0, active: 0, lease };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const runtime = (fetch: typeof globalThis.fetch) => ({ url: 'http://127.0.0.1:54441', anon: 'local-anon', service: 'local-service', fetch });

describe('local deferred-work cleanup fence', () => {
  it('waits for drain acknowledgment and holds the lease through SQL cleanup', async () => {
    let ack!: (response: Response) => void;
    let finish!: () => void;
    const cleanup = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { ack = resolve; }))
      .mockResolvedValueOnce(response({ released: true }));
    const promise = withLocalRuntimeFence(runtime(fetch), cleanup);
    expect(cleanup).not.toHaveBeenCalled();
    ack(response(drained));
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(); await promise;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('_local-release');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ lease });
  });

  it.each([409, 503])('never starts cleanup after a %s drain response', async status => {
    const cleanup = vi.fn(); const fetch = vi.fn().mockResolvedValue(response({}, status));
    await expect(withLocalRuntimeFence(runtime(fetch), cleanup)).rejects.toThrow('retain fixtures');
    expect(cleanup).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([{ ...drained, pending: 1 }, { ...drained, active: 1 }, { ...drained, lease: 'invalid' }])(
    'rejects an incomplete or unauthenticated drain acknowledgment: %s', async body => {
      const cleanup = vi.fn(); const fetch = vi.fn().mockResolvedValue(response(body));
      await expect(withLocalRuntimeFence(runtime(fetch), cleanup)).rejects.toThrow('retain fixtures');
      expect(cleanup).not.toHaveBeenCalled();
    });

  it('releases the proven fence if owned SQL cleanup fails', async () => {
    const error = new Error('owned SQL cleanup failed');
    const fetch = vi.fn().mockResolvedValueOnce(response(drained)).mockResolvedValueOnce(response({ released: true }));
    await expect(withLocalRuntimeFence(runtime(fetch), async () => { throw error; })).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('latches release transport failure and stops subsequent fixture creation', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined); const safety = localRequestSafety();
    const fetch = vi.fn().mockResolvedValueOnce(response(drained)).mockRejectedValueOnce(new Error('release transport failed'));
    await expect(safety.run(() => withLocalRuntimeFence(runtime(fetch), cleanup))).rejects.toThrow('release transport failed');
    expect(cleanup).toHaveBeenCalledOnce(); expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
  });

  it('reports both owned SQL failure and release failure without masking either', async () => {
    const sql = new Error('owned SQL failed'); const release = new Error('release failed');
    const fetch = vi.fn().mockResolvedValueOnce(response(drained)).mockRejectedValueOnce(release);
    await expect(withLocalRuntimeFence(runtime(fetch), async () => { throw sql; })).rejects.toMatchObject({ errors: [sql, release] });
  });

  it('refuses a late acknowledgment even if transport ignores its abort signal', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(41_000);
    const cleanup = vi.fn(); const fetch = vi.fn().mockResolvedValue(response(drained));
    try {
      await expect(withLocalRuntimeFence(runtime(fetch), cleanup)).rejects.toThrow('deadline exceeded');
      expect(cleanup).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });

  it('prevents the next owned mutation when an earlier read exhausts the cleanup budget', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const nextDelete = vi.fn();
    const fetch = vi.fn().mockResolvedValueOnce(response(drained)).mockResolvedValueOnce(response({ released: true }));
    try {
      await expect(withLocalRuntimeFence(runtime(fetch), async assertFresh => {
        clock.mockReturnValue(46_000);
        assertFresh(); nextDelete();
      })).rejects.toThrow('Owned cleanup deadline exceeded');
      expect(nextDelete).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally { clock.mockRestore(); }
  });
});
