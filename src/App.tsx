import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeColorMeta } from "@/components/ThemeColorMeta";
import { ThemePreferenceSync } from "@/components/ThemePreferenceSync";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { PageLoading } from "@/components/ui/loading";
import { ThemeProvider } from "@/components/theme-provider";
import { ViewportProvider } from "@/hooks/use-mobile";
import { OptimizedAuthProvider } from "@/hooks/useOptimizedAuth";
import { MultiTabCoordinator } from "@/lib/multitab-coordinator";
import { queryClient } from "@/lib/react-query";
import { APP_THEME_STORAGE_KEY } from "@/lib/theme";
import { AppBadgeProvider } from "@/providers/AppBadgeProvider";
import { AppRuntimeCoordinator } from "@/runtime/AppRuntimeCoordinator";
import {
  RouteAwareGlobalInitializers,
  RouteAwareGlobalOverlays,
} from "@/routes/RouteAwareAppEffects";
import {
  appShellRoutes,
  createRouteElement,
  fullscreenRoutes,
  publicRoutes,
  type AppRoute,
} from "@/routes/app-route-manifest";

const ReactQueryDevtoolsLazy = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

const Layout = lazy(() => import("@/components/layout/Layout"));
const AuthenticatedShell = lazy(() => import("@/routes/AuthenticatedShell"));

const PageLoader = () => <PageLoading />;

const renderRoute = (route: AppRoute) => (
  <Route key={route.id} path={route.path} element={createRouteElement(route)} />
);

export default function App() {
  React.useEffect(() => {
    const coordinator = MultiTabCoordinator.getInstance(queryClient);

    return () => {
      coordinator.destroy();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ViewportProvider>
          <ThemeProvider defaultTheme="system" storageKey={APP_THEME_STORAGE_KEY} attribute="class">
            <ThemeColorMeta />
            <AppBadgeProvider>
              <Router>
                <OptimizedAuthProvider>
                  <ThemePreferenceSync />
                  <ConfirmDialogProvider>
                    <AppRuntimeCoordinator />
                    <RouteAwareGlobalInitializers />
                    <div className="app">
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          {publicRoutes.map(renderRoute)}
                          <Route element={<AuthenticatedShell />}>
                            {fullscreenRoutes.map(renderRoute)}
                            <Route element={<Layout />}>
                              {appShellRoutes.map(renderRoute)}
                            </Route>
                          </Route>
                        </Routes>
                      </Suspense>
                      <RouteAwareGlobalOverlays />
                    </div>
                  </ConfirmDialogProvider>
                </OptimizedAuthProvider>
              </Router>
            </AppBadgeProvider>
          </ThemeProvider>
        </ViewportProvider>
        {ReactQueryDevtoolsLazy ? (
          <Suspense fallback={null}>
            <ReactQueryDevtoolsLazy initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
