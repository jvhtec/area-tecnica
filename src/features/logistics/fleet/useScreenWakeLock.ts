import { useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener?: (type: "release", listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };

const wakeLockOf = (): WakeLockNavigator["wakeLock"] | undefined =>
  typeof navigator === "undefined" ? undefined : (navigator as WakeLockNavigator).wakeLock;

/**
 * Keeps the screen on while `active` (Screen Wake Lock API), re-acquiring it
 * whenever the page comes back to the foreground — the browser drops the lock
 * on every hide. On browsers without the API this is a no-op and `supported`
 * is false so the UI can ask the driver to keep the screen on themselves.
 */
export function useScreenWakeLock(active: boolean) {
  const supported = Boolean(wakeLockOf());
  const [held, setHeld] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const wakeLock = wakeLockOf();
    if (!active || !wakeLock) {
      setHeld(false);
      return;
    }
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== "visible" || sentinelRef.current) return;
      try {
        const sentinel = await wakeLock.request("screen");
        if (disposed) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        setHeld(true);
        sentinel.addEventListener?.("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
          setHeld(false);
        });
      } catch {
        // Low battery mode or a denied request: the driver keeps the screen on by hand.
        setHeld(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      setHeld(false);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [active]);

  return { supported, held };
}
