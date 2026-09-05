// @vitest-environment jsdom
import type { ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setPrivateDataIdentity } from "@/lib/private-data-scope";
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
  const { login, logout, requestPasswordReset, user, userRole } = useOptimizedAuth();

  return (
    <div>
      <output data-testid="identity">{user?.id ?? "none"}:{userRole ?? "none"}</output>
      <button onClick={() => void login("User@Example.com", "password-1")}>login</button>
      <button onClick={() => void logout()}>logout</button>
      <button onClick={() => { void requestPasswordReset("User@Example.com").catch((): void => {}); }}>password-reset</button>
    </div>
  );
}

function renderAuthProvider(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>
      <OptimizedAuthProvider>{children}</OptimizedAuthProvider>
    </MemoryRouter></QueryClientProvider>,
  );
}

describe("useOptimizedAuth audit logging", () => {
  afterEach(() => act(() => setPrivateDataIdentity(null)));
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    localStorage.clear();

    tokenManagerMock.getCachedSession.mockResolvedValue(null);
    tokenManagerMock.refreshToken.mockResolvedValue({ session: null, error: null });
    tokenManagerMock.signOut.mockResolvedValue({ error: null });

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
        {},
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
          error_code: "invalid_credentials",
        },
      );
    });
  });

  it("logs login exceptions", async () => {
    (mockSupabase.auth as unknown as { signInWithPassword: ReturnType<typeof vi.fn> }).signInWithPassword.mockRejectedValue(
      new Error("Network failure"),
    );

    renderAuthProvider(<TestHarness />);
    fireEvent.click(screen.getByText("login"));

    await waitFor(() => {
      expect(logAuthEventMock).toHaveBeenCalledWith(
        null,
        "login",
        false,
        { error_code: "login_exception" },
      );
    });
  });

  it("logs successful password-reset requests without exposing the email", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { success: true }, error: null });

    renderAuthProvider(<TestHarness />);
    fireEvent.click(screen.getByText("password-reset"));

    await waitFor(() => {
      expect(logSecurityEventMock).toHaveBeenCalledWith({
        action: "password_reset_request",
        resource: "authentication",
        severity: "low",
        metadata: { success: true },
      });
    });
  });

  it("logs rejected password-reset requests", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: new Error("Function unavailable") });

    renderAuthProvider(<TestHarness />);
    fireEvent.click(screen.getByText("password-reset"));

    await waitFor(() => {
      expect(logSecurityEventMock).toHaveBeenCalledWith({
        action: "password_reset_request",
        resource: "authentication",
        severity: "high",
        metadata: { success: false, error_code: "password_reset_request_failed" },
      });
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

  it("reports a returned sign-out error as failure instead of announcing success", async () => {
    tokenManagerMock.signOut.mockResolvedValue({ error: new Error("Sign-out unavailable") });
    renderAuthProvider(<TestHarness />);
    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(logAuthEventMock).toHaveBeenCalledWith(null, "logout", false, { error: "Sign-out unavailable" }));
    expect(logAuthEventMock).not.toHaveBeenCalledWith(null, "logout", true);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("does not let an old profile response give the next account the previous role", async () => {
    let finishOldProfile!: (value: unknown) => void;
    const oldProfile = new Promise((resolve) => { finishOldProfile = resolve; });
    const oldBuilder = createMockQueryBuilder();
    oldBuilder.limit.mockReturnValue(oldProfile);
    const newBuilder = createMockQueryBuilder({ data: [{ role: "technician", department: "sound" }], error: null });
    mockSupabase.from.mockReturnValueOnce(oldBuilder).mockReturnValue(newBuilder);
    tokenManagerMock.getCachedSession.mockResolvedValue({ user: { id: "account-a" } });
    renderAuthProvider(<TestHarness />);
    await waitFor(() => expect(oldBuilder.limit).toHaveBeenCalled());
    const authChanged = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];
    await act(async () => { authChanged("SIGNED_IN", { user: { id: "account-b" } }); });
    await waitFor(() => expect(screen.getByTestId("identity").textContent).toBe("account-b:technician"));
    await act(async () => { finishOldProfile({ data: [{ role: "admin", department: "sound" }], error: null }); });
    expect(screen.getByTestId("identity").textContent).toBe("account-b:technician");
  });

  it("ignores a session bootstrap that resolves after a newer auth event", async () => {
    let finishBootstrap!: (value: unknown) => void;
    tokenManagerMock.getCachedSession.mockReturnValue(new Promise((resolve) => { finishBootstrap = resolve; }));
    renderAuthProvider(<TestHarness />);
    const authChanged = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];
    await act(async () => { authChanged("SIGNED_IN", { user: { id: "account-b" } }); });
    await waitFor(() => expect(screen.getByTestId("identity").textContent).toBe("account-b:management"));
    await act(async () => { finishBootstrap({ user: { id: "account-a" } }); });
    expect(screen.getByTestId("identity").textContent).toBe("account-b:management");
  });
});
