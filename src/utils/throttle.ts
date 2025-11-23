export type ThrottledFunction<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

/**
 * Lightweight throttle implementation to avoid extra dependencies on critical paths.
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, wait: number): ThrottledFunction<T> {
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
