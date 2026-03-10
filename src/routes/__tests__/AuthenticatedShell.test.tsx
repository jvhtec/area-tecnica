// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";

import {
  mockOptimizedAuthRole,
  resetOptimizedAuthMock,
  useOptimizedAuthMock,
} from "@/test/mockOptimizedAuth";
import { renderWithProviders } from "@/test/renderWithProviders";

const { activityPushFallbackMock } = vi.hoisted(() => ({
  activityPushFallbackMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/providers/SubscriptionProvider", () => ({
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="subscription-provider">{children}</div>
  ),
}));

vi.mock("@/components/AppInit", () => ({
  AppInit: () => <div data-testid="app-init">App Init</div>,
}));

vi.mock("@/hooks/useActivityPushFallback", () => ({
  useActivityPushFallback: activityPushFallbackMock,
}));

vi.mock("@/components/achievements/AchievementBanner", () => ({
  AchievementBanner: () => <div data-testid="achievement-banner">Achievement Banner</div>,
}));

import AuthenticatedShell from "../AuthenticatedShell";

const renderShell = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route element={<AuthenticatedShell />}>
        <Route path="/dashboard" element={<div>Dashboard Shell Route</div>} />
        <Route path="/syscalc" element={<div>SysCalc Route</div>} />
        <Route path="/settings" element={<div>Settings Shell Route</div>} />
        <Route path="/tasks" element={<div>Tasks Shell Route</div>} />
        <Route path="/profile" element={<div>Profile Shell Route</div>} />
      </Route>
      <Route path="/auth" element={<div>Auth Screen</div>} />
      <Route path="/tech-app" element={<div>Tech App Screen</div>} />
    </Routes>,
    { route },
  );

describe("AuthenticatedShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOptimizedAuthMock();
    activityPushFallbackMock.mockReset();
  });

  it("renders shared authenticated shell wrappers for allowed roles", async () => {
    mockOptimizedAuthRole("management");

    renderShell("/dashboard");

    expect(await screen.findByText("Dashboard Shell Route")).toBeInTheDocument();
    expect(screen.getByTestId("subscription-provider")).toBeInTheDocument();
    expect(screen.getByTestId("app-init")).toBeInTheDocument();
    expect(screen.getByTestId("achievement-banner")).toBeInTheDocument();
    expect(activityPushFallbackMock).toHaveBeenCalledTimes(1);
  });

  it("redirects guests to /auth through RequireAuth", async () => {
    mockOptimizedAuthRole("guest");

    renderShell("/dashboard");

    expect(await screen.findByText("Auth Screen")).toBeInTheDocument();
  });

  it("redirects technicians away from layout routes to /tech-app", async () => {
    mockOptimizedAuthRole("technician");

    renderShell("/settings");

    expect(await screen.findByText("Tech App Screen")).toBeInTheDocument();
  });

  it("allows technicians to stay on /syscalc", async () => {
    mockOptimizedAuthRole("technician");

    renderShell("/syscalc");

    expect(await screen.findByText("SysCalc Route")).toBeInTheDocument();
  });

  it("keeps oscar on allowed routes", async () => {
    mockOptimizedAuthRole("oscar");

    renderShell("/tasks");

    expect(await screen.findByText("Tasks Shell Route")).toBeInTheDocument();
  });

  it("redirects oscar from disallowed routes to /dashboard", async () => {
    mockOptimizedAuthRole("oscar");

    renderShell("/settings");

    expect(await screen.findByText("Dashboard Shell Route")).toBeInTheDocument();
  });
});
