export type ThrottledFunction<T extends (...args: never[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

/**
 * Lightweight throttle implementation to avoid extra dependencies on critical paths.
 */
export function throttle<T extends (...args: never[]) => void>(fn: T, wait: number): ThrottledFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCall = 0;

  const invoke = (args: Parameters<T>) => {
    lastCall = Date.now();
    fn(...args);
  };

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke(args);
    } else {
      lastArgs = args;
      if (!timeout) {
        timeout = setTimeout(() => {
          timeout = null;
          if (lastArgs) {
            invoke(lastArgs);
            lastArgs = null;
          }
        }, remaining);
      }
    }
  }) as ThrottledFunction<T>;

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
  };

  return throttled;
}

/**
 * Trailing-edge debounce with an optional ceiling. Collapses a burst of calls
 * into one, while `maxWait` guarantees a steady stream still flushes at least
 * that often instead of being postponed indefinitely.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait: number,
  { maxWait }: { maxWait?: number } = {},
): ThrottledFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let firstPendingCall: number | null = null;

  const flush = () => {
    timeout = null;
    firstPendingCall = null;
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  const debounced = ((...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;
    if (firstPendingCall === null) firstPendingCall = now;
    if (timeout) clearTimeout(timeout);
    const delay = maxWait === undefined ? wait : Math.max(0, Math.min(wait, firstPendingCall + maxWait - now));
    timeout = setTimeout(flush, delay);
  }) as ThrottledFunction<T>;

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    lastArgs = null;
    firstPendingCall = null;
  };

  return debounced;
}
