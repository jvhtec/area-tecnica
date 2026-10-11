// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushDeferredEffects,
  resetDeferredEffectsForTests,
  scheduleDeferredEffects,
} from '@/features/matrix-v2/deferredEffects';

describe('scheduleDeferredEffects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDeferredEffectsForTests();
  });
  afterEach(() => {
    resetDeferredEffectsForTests();
    vi.useRealTimers();
  });

  it('runs the effects when the window closes, once', () => {
    const run = vi.fn();
    const deferred = scheduleDeferredEffects('c1', run, 8_000);
    expect(deferred.isPending()).toBe(true);
    vi.advanceTimersByTime(7_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(deferred.isPending()).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('cancel stops them, and reports false once they ran', () => {
    const run = vi.fn();
    const held = scheduleDeferredEffects('c1', run, 8_000);
    expect(held.cancel()).toBe(true);
    vi.advanceTimersByTime(20_000);
    expect(run).not.toHaveBeenCalled();

    const ran = scheduleDeferredEffects('c2', run, 10);
    vi.advanceTimersByTime(10);
    expect(ran.cancel()).toBe(false);
  });

  it('release runs them now and is idempotent', () => {
    const run = vi.fn();
    const deferred = scheduleDeferredEffects('c1', run, 8_000);
    deferred.release();
    deferred.release();
    vi.advanceTimersByTime(20_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('releaseSoon moves the deadline up, also after a cancel (a failed undo)', () => {
    const run = vi.fn();
    const deferred = scheduleDeferredEffects('c1', run, 8_000);
    deferred.cancel();
    deferred.releaseSoon(500);
    vi.advanceTimersByTime(499);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('flush releases everything pending (page hide, route change)', () => {
    const first = vi.fn();
    const second = vi.fn();
    scheduleDeferredEffects('c1', first, 8_000);
    scheduleDeferredEffects('c2', second, 8_000);
    flushDeferredEffects();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('flushes on pagehide', () => {
    const run = vi.fn();
    scheduleDeferredEffects('c1', run, 8_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a failing effect neither throws nor leaves an unhandled rejection', async () => {
    const deferred = scheduleDeferredEffects('c1', () => Promise.reject(new Error('flex down')), 10);
    vi.advanceTimersByTime(10);
    await Promise.resolve();
    expect(deferred.isPending()).toBe(false);
    const sync = scheduleDeferredEffects('c2', () => { throw new Error('boom'); }, 10);
    expect(() => vi.advanceTimersByTime(10)).not.toThrow();
    expect(sync.isPending()).toBe(false);
  });
});
