import React, { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";

import {
  isPrivateAppPath,
  isPublicArtistFormPath,
} from "@/routes/app-route-manifest";

const ServiceWorkerUpdateInitializer = lazy(() =>
  import("@/hooks/useServiceWorkerUpdate").then((module) => ({
    default: function ServiceWorkerUpdateInitializer(): null {
      module.useServiceWorkerUpdate();
      return null;
    },
  })),
);

const PushSubscriptionRecoveryInitializer = lazy(() =>
  import("@/hooks/usePushSubscriptionRecovery").then((module) => ({
    default: function PushSubscriptionRecoveryInitializer(): null {
      module.usePushSubscriptionRecovery();
      return null;
    },
  })),
);

const ShortcutSystemInitializer = lazy(() =>
  import("@/hooks/useShortcutInitialization").then((module) => ({
    default: function ShortcutSystemInitializer(): null {
      module.useShortcutInitialization();
      return null;
    },
  })),
);

const GlobalCreateJobDialogLazy = lazy(() =>
  import("@/components/jobs/GlobalCreateJobDialog").then((module) => ({
    default: module.GlobalCreateJobDialog,
  })),
);

const AppToaster = lazy(() =>
  import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })),
);

const AppSonnerToaster = lazy(() =>
  import("@/components/ui/sonner").then((module) => ({ default: module.Toaster })),
);

function useDeferredNonCriticalMount(timeoutMs = 1500) {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (
      typeof idleWindow.requestIdleCallback === "function" &&
      typeof idleWindow.cancelIdleCallback === "function"
    ) {
      const idleId = idleWindow.requestIdleCallback(() => setIsReady(true), {
        timeout: timeoutMs,
      });

      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => setIsReady(true), Math.min(timeoutMs, 500));
    return () => globalThis.clearTimeout(timeoutId);
  }, [timeoutMs]);

  return isReady;
}

export function RouteAwareGlobalInitializers() {
  const { pathname } = useLocation();
  const canMountNonCritical = useDeferredNonCriticalMount();
  const isPrivateRoute = isPrivateAppPath(pathname);

  if (isPublicArtistFormPath(pathname) || !canMountNonCritical) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ServiceWorkerUpdateInitializer />
      {isPrivateRoute && <PushSubscriptionRecoveryInitializer />}
      {isPrivateRoute && <ShortcutSystemInitializer />}
    </Suspense>
  );
}

export function RouteAwareGlobalOverlays() {
  const { pathname } = useLocation();
  const isPrivateRoute = isPrivateAppPath(pathname);
  const canMountNonCritical = useDeferredNonCriticalMount();

  return (
    <Suspense fallback={null}>
      {canMountNonCritical && isPrivateRoute && <GlobalCreateJobDialogLazy />}
      {canMountNonCritical && <AppToaster />}
      {canMountNonCritical && isPrivateRoute && <AppSonnerToaster position="top-right" />}
    </Suspense>
  );
}
