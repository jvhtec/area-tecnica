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

type AuthCallback = (event: string, session: unknown) => void;

const storedSession = {
  access_token: "expired-access-token",
  refresh_token: "refresh-token",
  expires_at: Math.floor(Date.now() / 1000) - 3600,
  user: { id: "tech-1", email: "tech@example.com" },
};

function Identity() {
  const { user, userRole, userDepartment } = useOptimizedAuth();
  return <output data-testid="identity">{user?.id ?? "none"}:{userRole ?? "none"}:{userDepartment ?? "none"}</output>;
}

function renderAuthProvider(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>
      <OptimizedAuthProvider>{children}</OptimizedAuthProvider>
    </MemoryRouter></QueryClientProvider>,
  );
}

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
};

describe("useOptimizedAuth without a connection", () => {
  let emitAuth: AuthCallback = () => {};

  afterEach(() => {
    setOnline(true);
    act(() => setPrivateDataIdentity(null));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    localStorage.clear();
    setOnline(false);

    // What supabase-js does offline with an expired token: the session stays in
    // storage, but getSession / INITIAL_SESSION report none.
    localStorage.setItem("supabase.auth.token", JSON.stringify(storedSession));
    // Profile cached the day before: long past the 30-minute freshness window.
    localStorage.setItem("supabase_user_profile", JSON.stringify({
      userId: "tech-1",
      role: "technician",
      department: "sound",
      soundVisionAccess: false,
      assignableAsTech: false,
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
    }));

    tokenManagerMock.getCachedSession.mockResolvedValue(null);
    tokenManagerMock.refreshToken.mockResolvedValue({ session: null, error: null });
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback: AuthCallback) => {
      emitAuth = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSupabase.from.mockImplementation(() => createMockQueryBuilder({
      data: null,
      error: { message: "TypeError: Failed to fetch", code: "" },
    }));
  });

  it("keeps the technician signed in with their last known role", async () => {
    renderAuthProvider(<Identity />);
    act(() => emitAuth("INITIAL_SESSION", null));

    await waitFor(() => {
      expect(screen.getByTestId("identity").textContent).toBe("tech-1:technician:sound");
    });
    // The profile cache must survive so the next offline launch works too.
    expect(localStorage.getItem("supabase_user_profile")).not.toBeNull();
  });

  it("still signs out when the session is really gone", async () => {
    localStorage.removeItem("supabase.auth.token");
    renderAuthProvider(<Identity />);
    act(() => emitAuth("INITIAL_SESSION", null));

    await waitFor(() => {
      expect(screen.getByTestId("identity").textContent).toBe("none:none:none");
    });
  });

  it("does not use a stale profile when the server answers with an error", async () => {
    setOnline(true);
    mockSupabase.from.mockImplementation(() => createMockQueryBuilder({
      data: null,
      error: { message: "permission denied", code: "42501" },
    }));
    renderAuthProvider(<Identity />);
    act(() => emitAuth("SIGNED_IN", storedSession));

    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledWith("profiles"));
    expect(screen.getByTestId("identity").textContent).toBe("tech-1:none:none");
  });
});
