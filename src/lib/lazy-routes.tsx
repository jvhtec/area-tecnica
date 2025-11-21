/**
 * Lazy Route Loading System
 *
 * Optimized route loading with:
 * - Code splitting per route
 * - Loading skeletons
 * - Error boundaries
 * - Preloading on hover/focus
 */

import React, { Suspense, lazy, ComponentType, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// ============================================
// LOADING SKELETON
// ============================================

export function PageSkeleton() {
  return (
    <div className="w-full h-full min-h-[50vh] flex flex-col gap-4 p-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 bg-muted rounded-md w-1/3" />

      {/* Content skeleton */}
      <div className="flex-1 grid gap-4">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
        </div>
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

export function MobilePageSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-3 animate-pulse">
      {/* Mobile header */}
      <div className="h-6 bg-muted rounded w-2/3" />

      {/* Cards */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Route error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
            <h2 className="text-xl font-semibold text-destructive mb-2">
              Error loading page
            </h2>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// ============================================
// LAZY COMPONENT FACTORY
// ============================================

interface LazyRouteOptions {
  /** Custom loading component */
  loading?: React.ReactNode;
  /** Custom error fallback */
  errorFallback?: React.ReactNode;
  /** Preload on render */
  preload?: boolean;
  /** Minimum loading time (prevents flash) */
  minLoadTime?: number;
}

/**
 * Creates a lazy-loaded route component with optimizations
 */
export function createLazyRoute<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyRouteOptions = {}
): React.FC {
  const {
    loading = <PageSkeleton />,
    errorFallback,
    preload = false,
    minLoadTime = 0,
  } = options;

  // Create lazy component with minimum load time
  const LazyComponent = lazy(async () => {
    const start = Date.now();
    const module = await importFn();

    // Ensure minimum load time to prevent flash
    if (minLoadTime > 0) {
      const elapsed = Date.now() - start;
      if (elapsed < minLoadTime) {
        await new Promise((resolve) => setTimeout(resolve, minLoadTime - elapsed));
      }
    }

    return module;
  });

  // Preload function
  const preloadComponent = () => {
    importFn().catch(() => {
      // Silently fail preload
    });
  };

  // Preload on module load if requested
  if (preload) {
    preloadComponent();
  }

  // Return wrapped component
  const WrappedComponent: React.FC = () => (
    <RouteErrorBoundary fallback={errorFallback}>
      <Suspense fallback={loading}>
        <LazyComponent />
      </Suspense>
    </RouteErrorBoundary>
  );

  // Attach preload function for manual triggering
  (WrappedComponent as unknown as { preload: () => void }).preload = preloadComponent;

  return WrappedComponent;
}

// ============================================
// PRELOAD ON HOVER/FOCUS
// ============================================

/**
 * Hook to preload a route on hover or focus
 */
export function useRoutePreload(
  importFn: () => Promise<unknown>,
  options: { delay?: number } = {}
) {
  const { delay = 100 } = options;
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const preload = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      importFn().catch(() => {
        // Silently fail preload
      });
    }, delay);
  }, [importFn, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    onMouseEnter: preload,
    onFocus: preload,
    onMouseLeave: cancel,
    onBlur: cancel,
  };
}

// ============================================
// LAZY ROUTE DEFINITIONS
// ============================================

// Core pages - preload for faster navigation
export const LazyDashboard = createLazyRoute(
  () => import('@/pages/Dashboard'),
  { preload: true }
);

export const LazyTechnicianDashboard = createLazyRoute(
  () => import('@/pages/TechnicianDashboard'),
  { preload: true }
);

// Heavy pages - load on demand
export const LazyJobAssignmentMatrix = createLazyRoute(
  () => import('@/pages/JobAssignmentMatrix'),
  { loading: <PageSkeleton /> }
);

export const LazyFestivalManagement = createLazyRoute(
  () => import('@/pages/FestivalManagement'),
  { loading: <PageSkeleton /> }
);

export const LazyWallboard = createLazyRoute(
  () => import('@/pages/Wallboard'),
  { loading: <PageSkeleton /> }
);

export const LazyTimesheets = createLazyRoute(
  () => import('@/pages/Timesheets'),
  { loading: <PageSkeleton /> }
);

export const LazyDisponibilidad = createLazyRoute(
  () => import('@/pages/Disponibilidad'),
  { loading: <PageSkeleton /> }
);

export const LazyTours = createLazyRoute(
  () => import('@/pages/Tours'),
  { loading: <PageSkeleton /> }
);

export const LazyProjectManagement = createLazyRoute(
  () => import('@/pages/ProjectManagement'),
  { loading: <PageSkeleton /> }
);

// Tools - heavy computation pages
export const LazyPesosTool = createLazyRoute(
  () => import('@/pages/PesosTool'),
  { loading: <PageSkeleton /> }
);

export const LazyConsumosTool = createLazyRoute(
  () => import('@/pages/ConsumosTool'),
  { loading: <PageSkeleton /> }
);

// ============================================
// ROUTE PREFETCHING ON NAVIGATION
// ============================================

const routeImportMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/technician': () => import('@/pages/TechnicianDashboard'),
  '/jobs/matrix': () => import('@/pages/JobAssignmentMatrix'),
  '/festivals': () => import('@/pages/FestivalManagement'),
  '/wallboard': () => import('@/pages/Wallboard'),
  '/timesheets': () => import('@/pages/Timesheets'),
  '/disponibilidad': () => import('@/pages/Disponibilidad'),
  '/tours': () => import('@/pages/Tours'),
  '/projects': () => import('@/pages/ProjectManagement'),
};

/**
 * Prefetch adjacent routes for faster navigation
 */
export function useAdjacentRoutePrefetch() {
  const location = useLocation();

  useEffect(() => {
    // Define adjacent routes for each page
    const adjacentRoutes: Record<string, string[]> = {
      '/dashboard': ['/jobs/matrix', '/disponibilidad'],
      '/technician': ['/timesheets', '/disponibilidad'],
      '/jobs/matrix': ['/dashboard', '/disponibilidad'],
      '/disponibilidad': ['/dashboard', '/timesheets'],
      '/timesheets': ['/technician', '/disponibilidad'],
    };

    const routesToPrefetch = adjacentRoutes[location.pathname] || [];

    // Prefetch after a delay to not block main thread
    const timeoutId = setTimeout(() => {
      routesToPrefetch.forEach((route) => {
        const importFn = routeImportMap[route];
        if (importFn) {
          importFn().catch(() => {
            // Silently fail
          });
        }
      });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);
}

// ============================================
// NETWORK-AWARE PREFETCHING
// ============================================

/**
 * Only prefetch on fast connections
 */
export function useNetworkAwarePrefetch() {
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;

    // Don't prefetch on slow connections or data saver mode
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType || '')) {
      return;
    }

    // Prefetch critical routes during idle time
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        // Prefetch dashboard components
        import('@/pages/Dashboard').catch(() => {});
      }, { timeout: 5000 });
    }
  }, []);
}
