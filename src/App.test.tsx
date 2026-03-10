// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";

import {
  mockOptimizedAuthRole,
  mockOptimizedAuthState,
  resetOptimizedAuthMock,
  useOptimizedAuthMock,
} from "@/test/mockOptimizedAuth";

const {
  serviceWorkerUpdateMock,
  pushSubscriptionRecoveryMock,
  shortcutInitializationMock,
  destroyCoordinatorMock,
} = vi.hoisted(() => ({
  serviceWorkerUpdateMock: vi.fn(),
  pushSubscriptionRecoveryMock: vi.fn(),
  shortcutInitializationMock: vi.fn(),
  destroyCoordinatorMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  OptimizedAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/lib/multitab-coordinator", () => ({
  MultiTabCoordinator: {
    getInstance: () => ({
      destroy: destroyCoordinatorMock,
    }),
  },
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  ViewportProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/providers/AppBadgeProvider", () => ({
  AppBadgeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/jobs/GlobalCreateJobDialog", () => ({
  GlobalCreateJobDialog: () => <div data-testid="global-create-job-dialog">Global Create Job</div>,
}));

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => <div data-testid="app-toaster">Toast Container</div>,
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="sonner-toaster">Sonner</div>,
}));

vi.mock("@/hooks/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: serviceWorkerUpdateMock,
}));

vi.mock("@/hooks/usePushSubscriptionRecovery", () => ({
  usePushSubscriptionRecovery: pushSubscriptionRecoveryMock,
}));

vi.mock("@/hooks/useShortcutInitialization", () => ({
  useShortcutInitialization: shortcutInitializationMock,
}));

vi.mock("@/components/AppInit", () => ({
  AppInit: () => null,
}));

vi.mock("@/providers/SubscriptionProvider", () => ({
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useActivityPushFallback", () => ({
  useActivityPushFallback: vi.fn(),
}));

vi.mock("@/components/achievements/AchievementBanner", () => ({
  AchievementBanner: () => null,
}));

vi.mock("@/pages/Auth", () => ({
  default: () => <div>Auth Route</div>,
}));

vi.mock("@/pages/Dashboard", () => ({
  default: () => <div>Dashboard Route</div>,
}));

vi.mock("@/pages/TechnicianDashboard", () => ({
  default: () => <div>Technician Dashboard Route</div>,
}));

vi.mock("@/pages/TechnicianSuperApp", () => ({
  default: () => <div>Tech App Route</div>,
}));

vi.mock("@/pages/ProjectManagement", () => ({
  default: () => <div>Project Management Route</div>,
}));

vi.mock("@/pages/Settings", () => ({
  default: () => <div>Settings Route</div>,
}));

vi.mock("@/pages/RatesCenterPage", () => ({
  default: () => <div>Rates Route</div>,
}));

vi.mock("@/pages/PayoutsDueFortnights", () => ({
  default: () => <div>Payouts Due Route</div>,
}));

vi.mock("@/pages/TechnicianUnavailability", () => ({
  default: () => <div>Unavailability Route</div>,
}));

vi.mock("@/pages/Disponibilidad", () => ({
  default: () => <div>Disponibilidad Route</div>,
}));

vi.mock("@/components/festival/ArtistRequirementsForm", () => ({
  ArtistRequirementsForm: () => <div>Artist Form Route</div>,
}));

vi.mock("@/components/festival/FormSubmitted", () => ({
  FormSubmitted: () => <div>Form Submitted Route</div>,
}));

vi.mock("@/components/layout/Layout", () => ({
  default: () => <Outlet />,
}));

import App from "./App";

const renderAppAt = (route: string) => {
  window.history.pushState({}, "", route);
  return render(<App />);
};

describe("App route guards and global overlays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOptimizedAuthMock();
    serviceWorkerUpdateMock.mockReset();
    pushSubscriptionRecoveryMock.mockReset();
    shortcutInitializationMock.mockReset();
  });

  it("suppresses global initializers and private overlays on public artist form routes", async () => {
    mockOptimizedAuthRole("guest");

    renderAppAt("/festival/artist-form/blank");

    expect(await screen.findByText("Artist Form Route")).toBeInTheDocument();
    expect(screen.queryByTestId("global-create-job-dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sonner-toaster")).not.toBeInTheDocument();
    expect(serviceWorkerUpdateMock).not.toHaveBeenCalled();
    expect(pushSubscriptionRecoveryMock).not.toHaveBeenCalled();
    expect(shortcutInitializationMock).not.toHaveBeenCalled();
  });

  it("allows house techs into /technician-dashboard", async () => {
    mockOptimizedAuthRole("house_tech");

    renderAppAt("/technician-dashboard");

    expect(await screen.findByText("Technician Dashboard Route")).toBeInTheDocument();
  });

  it("allows management users into /settings", async () => {
    mockOptimizedAuthRole("management");

    renderAppAt("/settings");
    expect(await screen.findByText("Settings Route")).toBeInTheDocument();
  });

  it("allows management users into /management/rates", async () => {
    mockOptimizedAuthRole("management");

    renderAppAt("/management/rates");

    expect(await screen.findByText("Rates Route")).toBeInTheDocument();
  });

  it("redirects payout-restricted management users back to /dashboard", async () => {
    mockOptimizedAuthState({
      session: { user: { id: "manager-1", email: "manager@example.com" } },
      user: { id: "manager-1", email: "manager@example.com" },
      userRole: "management",
      userDepartment: "video",
      isLoading: false,
      isInitialized: true,
      isProfileLoading: false,
      error: null,
      hasSoundVisionAccess: false,
      assignableAsTech: false,
    });

    renderAppAt("/management/payouts-due");

    expect(await screen.findByText("Dashboard Route")).toBeInTheDocument();
  });
});
