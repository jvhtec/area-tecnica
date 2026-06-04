// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const manager = {
    subscribeToTable: vi.fn((table: string) => ({
      key: `${table}-subscription`,
      unsubscribe: vi.fn(),
      options: { table, queryKey: [table], priority: "medium" as const },
    })),
    registerRouteSubscription: vi.fn(),
    cleanupRouteDependentSubscriptions: vi.fn(),
    getSubscriptionsByTable: vi.fn(() => ({
      profiles: ["profiles-subscription"],
      jobs: ["jobs-subscription"],
      job_assignments: ["job-assignments-subscription"],
      job_date_types: ["job-date-types-subscription"],
    })),
    forceRefreshSubscriptions: vi.fn(),
  };

  return {
    manager,
    requestSubscriptions: vi.fn(),
    invalidateQueries: vi.fn(),
    lastRefreshTime: Date.now(),
    coordinator: {
      getIsLeader: vi.fn(() => true),
      requestSubscriptions: vi.fn(),
      releaseSubscriptions: vi.fn(),
      invalidateQueries: vi.fn(),
    },
  };
});

vi.mock("@/lib/unified-subscription-manager", () => ({
  UnifiedSubscriptionManager: {
    getInstance: () => mocks.manager,
  },
}));

vi.mock("@/providers/SubscriptionProvider", () => ({
  useSubscriptionContext: () => ({
    lastRefreshTime: mocks.lastRefreshTime,
    connectionStatus: "connected",
  }),
}));

vi.mock("@/lib/multitab-coordinator", () => ({
  MultiTabCoordinator: {
    getInstance: () => mocks.coordinator,
  },
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => ({ userRole: "management" }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";

function Harness(): React.JSX.Element {
  useEnhancedRouteSubscriptions();
  return null;
}

const renderHookHarness = (route: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("useEnhancedRouteSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.coordinator.getIsLeader.mockReturnValue(true);
    mocks.manager.getSubscriptionsByTable.mockReturnValue({
      profiles: ["profiles-subscription"],
      jobs: ["jobs-subscription"],
      job_assignments: ["job-assignments-subscription"],
      job_date_types: ["job-date-types-subscription"],
    });
  });

  it("cleans up the current route subscriptions when the route owner unmounts", async () => {
    const rendered = renderHookHarness("/dashboard");

    await waitFor(() => {
      expect(mocks.manager.registerRouteSubscription).toHaveBeenCalledWith(
        "/dashboard",
        "jobs-subscription",
      );
    });

    rendered.unmount();

    expect(mocks.manager.cleanupRouteDependentSubscriptions).toHaveBeenCalledWith("/dashboard");
  });

  it("requests route-owned subscriptions from the leader when running as a follower", async () => {
    mocks.coordinator.getIsLeader.mockReturnValue(false);
    mocks.manager.getSubscriptionsByTable.mockReturnValue({
      profiles: [],
      jobs: [],
      job_assignments: [],
      job_date_types: [],
    });

    renderHookHarness("/dashboard");

    await waitFor(() => {
      expect(mocks.coordinator.requestSubscriptions).toHaveBeenCalledWith({
        routeKey: "/dashboard",
        subscriptions: expect.arrayContaining([
          expect.objectContaining({
            table: "profiles",
            queryKey: ["profiles"],
            priority: "medium",
          }),
          expect.objectContaining({
            table: "jobs",
            queryKey: ["optimized-jobs"],
            priority: "high",
          }),
        ]),
      });
    });

    expect(mocks.manager.subscribeToTable).not.toHaveBeenCalled();
  });

  it("releases delegated subscriptions from the leader when a follower unmounts", async () => {
    mocks.coordinator.getIsLeader.mockReturnValue(false);
    mocks.manager.getSubscriptionsByTable.mockReturnValue({
      profiles: [],
      jobs: [],
      job_assignments: [],
      job_date_types: [],
    });

    const rendered = renderHookHarness("/dashboard");

    await waitFor(() => {
      expect(mocks.coordinator.requestSubscriptions).toHaveBeenCalled();
    });

    rendered.unmount();

    expect(mocks.coordinator.releaseSubscriptions).toHaveBeenCalledWith("/dashboard");
    expect(mocks.manager.cleanupRouteDependentSubscriptions).not.toHaveBeenCalled();
  });
});
