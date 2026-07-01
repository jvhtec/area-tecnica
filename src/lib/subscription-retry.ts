const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
const MAX_ATTEMPTS = 6;

type RetryResult =
  | { state: "pending" }
  | { state: "exhausted" }
  | { state: "scheduled"; attempt: number; delayMs: number };

export class ChannelRetryManager {
  private timers = new Map<string, number>();
  private attempts = new Map<string, number>();

  clear(key: string) {
    const timer = this.timers.get(key);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(key);
    }
    this.attempts.delete(key);
  }

  schedule(key: string, retry: () => void, onExhausted: () => void): RetryResult {
    if (this.timers.has(key)) {
      return { state: "pending" };
    }

    const attempt = (this.attempts.get(key) ?? 0) + 1;
    this.attempts.set(key, attempt);

    if (attempt > MAX_ATTEMPTS) {
      onExhausted();
      return { state: "exhausted" };
    }

    const delayMs = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
    const timer = window.setTimeout(() => {
      this.timers.delete(key);
      retry();
    }, delayMs);
    this.timers.set(key, timer);

    return { state: "scheduled", attempt, delayMs };
  }
}
