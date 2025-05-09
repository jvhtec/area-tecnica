
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout/Layout";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { connectionManager } from "@/lib/connection-manager";
import { ConnectionIndicatorCompact } from "@/components/ui/connection-indicator-compact";
import { connectionConfig } from "@/lib/connection-config";
import { Toaster as Sonner } from "sonner";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      networkMode: "always",
    },
  },
});

// Initialize connection manager with query client
connectionManager.initialize(queryClient);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <div className="app-container">
            <Layout>
              <Outlet />
              <Toaster />
              <Sonner position="bottom-right" />
              <ConnectionIndicatorCompact />
            </Layout>
          </div>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log the error
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  // Determine what to render based on the error
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-2">
          <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
          <p>Sorry, the page you are looking for does not exist.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Go Home
          </button>
        </div>
      );
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-2">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <button
        onClick={() => navigate("/")}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Go Home
      </button>
    </div>
  );
}
