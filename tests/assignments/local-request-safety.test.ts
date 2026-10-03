import { describe, expect, it, vi } from 'vitest';
import { localRequestSafety } from './helpers/localRequestSafety';

describe('local campaign request cleanup safety', () => {
  it('blocks teardown and new fixtures while concurrent requests remain pending', async () => {
    const safety = localRequestSafety();
    let finish!: () => void;
    const pending = safety.run(() => new Promise<void>(resolve => { finish = resolve; }));
    expect(safety.cleanupSafe).toBe(false);
    expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
    await safety.run(async () => ({ status: 429 }));
    expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
    finish(); await pending;
    expect(() => safety.assertSafe()).not.toThrow();
  });

  it.each(['TimeoutError', 'TypeError'])('retains fixtures after %s even if another request completes', async name => {
    const safety = localRequestSafety();
    let finish!: () => void;
    const other = safety.run(() => new Promise<void>(resolve => { finish = resolve; }));
    const error = Object.assign(new Error('local transport failed'), { name });
    await expect(safety.run(async () => { throw error; })).rejects.toBe(error);
    finish(); await other;
    expect(safety.cleanupSafe).toBe(false);
    expect(() => safety.assertSafe()).toThrow('Owned fixtures retained');
    const next = vi.fn();
    await expect(safety.run(next)).rejects.toThrow('runtime quiescence');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows cleanup after a fully consumed HTTP denial', async () => {
    const safety = localRequestSafety();
    expect(await safety.run(async () => ({ status: 403, body: { error: 'Forbidden' } }))).toMatchObject({ status: 403 });
    expect(safety.cleanupSafe).toBe(true);
    expect(() => safety.assertSafe()).not.toThrow();
  });
});
