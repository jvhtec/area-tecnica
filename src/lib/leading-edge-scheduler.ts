/**
 * Per-key "now, then at most once per window" scheduling.
 *
 * The first call for a key runs immediately. Further calls inside the window
 * are folded into a single trailing run when it closes, and the window then
 * restarts so a continuing burst runs at most once per window. Unlike a
 * trailing debounce, nothing waits for quiet: a realtime change from a
 * colleague is applied the moment it arrives, while a burst (one row per date
 * of a tour assignment) still costs one extra run instead of one per row.
 */
export class LeadingEdgeScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pending = new Set<string>();

  run(key: string, windowMs: number, task: () => void) {
    if (this.timers.has(key)) {
      this.pending.add(key);
      return;
    }

    task();
    const closeWindow = () => {
      if (this.pending.delete(key)) {
        task();
        this.timers.set(key, setTimeout(closeWindow, windowMs));
        return;
      }
      this.timers.delete(key);
    };
    this.timers.set(key, setTimeout(closeWindow, windowMs));
  }
}
