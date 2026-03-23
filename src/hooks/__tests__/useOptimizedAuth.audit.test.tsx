// @vitest-environment jsdom
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const { toastMock, refreshSubscriptionsMock, invalidateQueriesMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  refreshSubscriptionsMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

const { tokenManagerMock, logAuthEventMock, logSecurityEventMock } = vi.hoisted(() => ({
  tokenManagerMock: {
    getCachedSession: vi.fn(),
    refreshToken: vi.fn(),
    signOut: vi.fn(),
    clearCache: vi.fn(),
    getCacheStatus: vi.fn(() => ({ hasCache: false, cacheAge: 0, isValid: false })),
    calculateRefreshTime: vi.fn(() => 60_000),
    checkTokenExpiration: vi.fn(() => false),
  },
  logAuthEventMock: vi.fn().mockResolvedValue(undefined),
  logSecurityEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/providers/SubscriptionProvider", () => ({
  useSubscriptionContext: () => ({
    refreshSubscriptions: refreshSubscriptionsMock,
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/utils/roleBasedRouting", () => ({
  getDashboardPath: () => "/dashboard",
}));

vi.mock("@/lib/token-manager", () => ({
  TokenManager: {
    getInstance: () => tokenManagerMock,
  },
}));

vi.mock("@/lib/security-audit", () => ({
  logAuthEvent: logAuthEventMock,
  logSecurityEvent: logSecurityEventMock,
}));

import { OptimizedAuthProvider, useOptimizedAuth } from "../useOptimizedAuth";

function TestHarness() {
  const { login, logout } = useOptimizedAuth();

  return (
    <div>
      <button onClick={() => void login("User@Example.com", "password-1")}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function renderAuthProvider(children: ReactNode) {
  return render(
    <MemoryRouter>
      <OptimizedAuthProvider>{children}</OptimizedAuthProvider>
    </MemoryRouter>,
  );
}

describe("useOptimizedAuth audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();

    tokenManagerMock.getCachedSession.mockResolvedValue(null);
    tokenManagerMock.refreshToken.mockResolvedValue({ session: null, error: null });
    tokenManagerMock.signOut.mockResolvedValue(undefined);

    const profileBuilder = createMockQueryBuilder({
      data: [
        {
          role: "management",
          department: "sound",
          soundvision_access: false,
          assignable_as_tech: false,
        },
      ],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profileBuilder;
      }

      return createMockQueryBuilder();
    });

    (mockSupabase.auth as unknown as { signInWithPassword: ReturnType<typeof vi.fn> }).signInWithPassword = vi.fn();
    (mockSupabase.auth as unknown as { updateUser: ReturnType<typeof vi.fn> }).updateUser = vi.fn();
  });

  it("logs successful logins with the session access token", async () => {
    (mockSupabase.auth as unknown as { signInWithPassword: ReturnType<typeof vi.fn> }).signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
        session: {
          access_token: "access-token-1",
          user: {
            id: "user-1",
            email: "user@example.com",
          },
        },
      },
      error: null,
    });

    renderAuthProvider(<TestHarness />);
    fireEvent.click(screen.getByText("login"));

    await waitFor(() => {
      expect(logAuthEventMock).toHaveBeenCalledWith(
        "user-1",
        "login",
        true,
        { email: "user@example.com" },
        { accessToken: "access-token-1" },
      );
    });
  });

  it("logs failed logins without breaking the flow", async () => {
    (mockSupabase.auth as unknown as { signInWithPassword: ReturnType<typeof vi.fn> }).signInWithPassword.mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: new Error("Invalid login credentials"),
    });

    renderAuthProvider(<TestHarness />);
    fireEvent.click(screen.getByText("login"));

    await waitFor(() => {
      expect(logAuthEventMock).toHaveBeenCalledWith(
        null,
        "login",
        false,
        {
          email: "user@example.com",
          error: "Invalid login credentials",
        },
      );
    });
  });

  it("logs successful logout events", async () => {
    tokenManagerMock.getCachedSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });

    renderAuthProvider(<TestHarness />);

    await waitFor(() => {
      expect(tokenManagerMock.getCachedSession).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() => {
      expect(logAuthEventMock).toHaveBeenCalledWith("user-1", "logout", true);
    });
  });
});
