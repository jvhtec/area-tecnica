/**
 * Holds a command's post-commit effects (Flex crew sync, notifications) for the
 * undo window. Undoing inside the window cancels the timer, so nobody hears
 * about a change that was taken back; otherwise the effects run when it closes.
 *
 * Effects are never lost silently: a page hide or route change releases them at
 * once, and anything that still does not run stays `pending` in the ledger,
 * where the reconciliation backlog lists it with a retry.
 */

export interface DeferredEffects {
  commandId: string;
  /** Epoch ms at which the effects are released. */
  expiresAt: number;
  /** True until the effects were released or cancelled. */
  isPending: () => boolean;
  /** Stops the timer. Returns false when the effects were already released. */
  cancel: () => boolean;
  /** Runs the effects now; a no-op once released or cancelled. */
  release: () => void;
  /** After a failed undo: run the effects soon instead of at the original deadline. */
  releaseSoon: (delayMs?: number) => void;
}

type Entry = {
  state: 'pending' | 'released' | 'cancelled';
  timer: ReturnType<typeof setTimeout> | null;
  run: () => unknown;
};

const entries = new Map<string, Entry>();
let listening = false;

const ensurePageHideFlush = () => {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // pagehide also fires when a mobile browser discards the tab.
  window.addEventListener('pagehide', () => flushDeferredEffects());
};

/** Releases every held effect now (page hide, route change). */
export function flushDeferredEffects() {
  for (const [commandId, entry] of [...entries]) {
    if (entry.state !== 'pending') continue;
    releaseEntry(commandId, entry);
  }
}

function releaseEntry(commandId: string, entry: Entry) {
  if (entry.state !== 'pending') return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  entry.state = 'released';
  entries.delete(commandId);
  try {
    const outcome = entry.run();
    // The runner reports its own failures; this only keeps a rejection from
    // surfacing as an unhandled promise.
    if (outcome instanceof Promise) outcome.catch(() => undefined);
  } catch {
    // Same: reported by the runner.
  }
}

export function scheduleDeferredEffects(
  commandId: string,
  run: () => unknown,
  delayMs: number,
  now: () => number = Date.now,
): DeferredEffects {
  ensurePageHideFlush();
  const entry: Entry = { state: 'pending', timer: null, run };
  entries.set(commandId, entry);
  const arm = (ms: number) => {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => releaseEntry(commandId, entry), Math.max(ms, 0));
  };
  arm(delayMs);
  return {
    commandId,
    expiresAt: now() + delayMs,
    isPending: () => entry.state === 'pending',
    cancel: () => {
      if (entry.state !== 'pending') return false;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      entry.state = 'cancelled';
      entries.delete(commandId);
      return true;
    },
    release: () => releaseEntry(commandId, entry),
    releaseSoon: (ms = 1_000) => {
      if (entry.state === 'cancelled') {
        // An undo that failed after cancelling: put the effects back on a short timer.
        entry.state = 'pending';
        entries.set(commandId, entry);
      }
      if (entry.state === 'pending') arm(ms);
    },
  };
}

/** Test helper: forget everything without running it. */
export function resetDeferredEffectsForTests() {
  for (const entry of entries.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  entries.clear();
}
