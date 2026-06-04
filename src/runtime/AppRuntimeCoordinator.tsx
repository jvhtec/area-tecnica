import { useEffect, useRef } from "react";

import { APP_RUNTIME_EVENTS, emitAppRuntimeEvent } from "@/runtime/app-runtime-events";

type RuntimeState = {
  isOnline: boolean;
  hiddenAt: number | null;
};

const getInitialOnlineState = (): boolean => {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }

  return navigator.onLine;
};

const getInitialHiddenState = (): number | null => {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") {
    return null;
  }

  return Date.now();
};

export function AppRuntimeCoordinator(): null {
  const state = useRef<RuntimeState>({
    isOnline: getInitialOnlineState(),
    hiddenAt: getInitialHiddenState(),
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const handleOnline = () => {
      const previousOnline = state.current.isOnline;
      state.current.isOnline = true;

      emitAppRuntimeEvent(APP_RUNTIME_EVENTS.ONLINE, {
        at: Date.now(),
        previousOnline,
      });
    };

    const handleOffline = () => {
      const previousOnline = state.current.isOnline;
      state.current.isOnline = false;

      emitAppRuntimeEvent(APP_RUNTIME_EVENTS.OFFLINE, {
        at: Date.now(),
        previousOnline,
      });
    };

    const handleVisibilityChange = () => {
      const now = Date.now();

      if (document.visibilityState === "hidden") {
        state.current.hiddenAt = now;
        emitAppRuntimeEvent(APP_RUNTIME_EVENTS.HIDDEN, { at: now });
        return;
      }

      const hiddenDurationMs = state.current.hiddenAt
        ? now - state.current.hiddenAt
        : 0;

      state.current.hiddenAt = null;

      emitAppRuntimeEvent(APP_RUNTIME_EVENTS.VISIBLE, {
        at: now,
        hiddenDurationMs,
      });

      emitAppRuntimeEvent(APP_RUNTIME_EVENTS.RESUME, {
        at: now,
        hiddenDurationMs,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
