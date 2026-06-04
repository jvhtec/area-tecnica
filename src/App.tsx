import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { ViewportProvider } from "@/hooks/use-mobile";
import { OptimizedAuthProvider } from "@/hooks/useOptimizedAuth";
import { MultiTabCoordinator } from "@/lib/multitab-coordinator";
import { queryClient } from "@/lib/react-query";
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

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

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
          <ThemeProvider defaultTheme="system" storageKey="sector-pro-theme" attribute="class">
            <AppBadgeProvider>
              <Router>
                <OptimizedAuthProvider>
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
