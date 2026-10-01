import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "@/utils/throttle";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses a burst into one trailing call with the latest arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1);
    debounced(2);
    debounced(3);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("flushes a steady stream at least every maxWait", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100, { maxWait: 250 });
    // A call every 50ms would postpone a plain debounce forever.
    for (let i = 0; i < 6; i += 1) {
      debounced();
      vi.advanceTimersByTime(50);
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel drops the pending call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});
