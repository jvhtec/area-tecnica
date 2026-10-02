// @vitest-environment jsdom
import type { ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { capturePrivateDataScope, getPrivateDataScope, setPrivateDataIdentity } from "@/lib/private-data-scope";
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

function Authorization() {
  const { userRole, userDepartment, hasSoundVisionAccess, assignableAsTech, isProfileLoading } = useOptimizedAuth();
  return <>
    <output data-testid="authorization">{JSON.stringify([userRole, userDepartment, hasSoundVisionAccess, assignableAsTech, isProfileLoading])}</output>
    {userRole === "admin" && <div>Admin access</div>}
  </>;
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

  async function signInAdmin() {
    setOnline(true);
    localStorage.removeItem("supabase_user_profile");
    mockSupabase.from.mockImplementation(() => createMockQueryBuilder({
      data: [{ role: "admin", department: "sound", soundvision_access: true, assignable_as_tech: true }],
      error: null,
    }));
    renderAuthProvider(<Authorization />);
    await act(async () => emitAuth("SIGNED_IN", storedSession));
    await waitFor(() => expect(screen.getByTestId("authorization").textContent).toBe('["admin","sound",true,true,false]'));
    expect(screen.getByText("Admin access")).toBeInTheDocument();
    return capturePrivateDataScope();
  }

  function expectAuthorizationCleared() {
    expect(screen.getByTestId("authorization").textContent).toBe('[null,null,false,false,false]');
    expect(screen.queryByText("Admin access")).not.toBeInTheDocument();
    expect(getPrivateDataScope()?.authorizationKey).toBe('[null,null,false,false]');
    expect(localStorage.getItem("supabase_user_profile")).toBeNull();
  }

  it("removes admin access and cached authorization after TOKEN_REFRESHED confirms no profile", async () => {
    const oldScope = await signInAdmin();
    const empty = createMockQueryBuilder({ data: [], error: null });
    mockSupabase.from.mockImplementation(() => empty);

    await act(async () => emitAuth("TOKEN_REFRESHED", storedSession));

    expectAuthorizationCleared();
    expect(oldScope.signal.aborted).toBe(true);
    expect(empty.insert).not.toHaveBeenCalled();
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("does not recreate a revoked profile from metadata, including subsequent refreshes", async () => {
    await signInAdmin();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { ...storedSession.user, user_metadata: { role: "admin", department: "sound" } } },
      error: null,
    });
    const empty = createMockQueryBuilder({ data: [], error: null });
    mockSupabase.from.mockImplementation(() => empty);

    await act(async () => emitAuth("TOKEN_REFRESHED", storedSession));
    await act(async () => emitAuth("TOKEN_REFRESHED", storedSession));

    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(empty.insert).not.toHaveBeenCalled();
    expectAuthorizationCleared();
  });

  it("preserves applied authorization without a loading interruption on transient network failure", async () => {
    const oldScope = await signInAdmin();
    const cached = localStorage.getItem("supabase_user_profile");
    let finishQuery!: (result: { data: null; error: { message: string; code: string } }) => void;
    const pending = new Promise<{ data: null; error: { message: string; code: string } }>((resolve) => { finishQuery = resolve; });
    const builder = createMockQueryBuilder();
    builder.limit.mockReturnValue(pending);
    mockSupabase.from.mockImplementation(() => builder);

    await act(async () => emitAuth("TOKEN_REFRESHED", storedSession));
    expect(screen.getByTestId("authorization").textContent).toBe('["admin","sound",true,true,false]');
    await act(async () => finishQuery({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } }));

    expect(screen.getByText("Admin access")).toBeInTheDocument();
    expect(screen.getByTestId("authorization").textContent).toBe('["admin","sound",true,true,false]');
    expect(capturePrivateDataScope()).toBe(oldScope);
    expect(oldScope.signal.aborted).toBe(false);
    expect(localStorage.getItem("supabase_user_profile")).toBe(cached);
  });

  it.each([true, false])("fails closed on 42501 authorization denial with navigator.onLine=%s", async (online) => {
    const oldScope = await signInAdmin();
    // An explicit server denial must win even if the browser just went offline.
    setOnline(online);
    mockSupabase.from.mockImplementation(() => createMockQueryBuilder({ data: null, error: { code: "42501", message: "permission denied" } }));

    await act(async () => emitAuth("TOKEN_REFRESHED", storedSession));

    expectAuthorizationCleared();
    expect(oldScope.signal.aborted).toBe(true);
  });

  it("preserves initial missing-profile bootstrap", async () => {
    setOnline(true);
    localStorage.removeItem("supabase_user_profile");
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { ...storedSession.user, user_metadata: { role: "technician", department: "sound" } } },
      error: null,
    });
    const empty = createMockQueryBuilder({ data: [], error: null });
    const profile = createMockQueryBuilder({ data: [{ role: "technician", department: "sound" }], error: null });
    mockSupabase.from.mockImplementationOnce(() => empty).mockImplementationOnce(() => empty).mockImplementation(() => profile);
    renderAuthProvider(<Identity />);

    await act(async () => emitAuth("SIGNED_IN", storedSession));

    expect(empty.insert).toHaveBeenCalledWith(expect.objectContaining({ id: "tech-1", role: "technician" }));
    expect(screen.getByTestId("identity").textContent).toBe("tech-1:technician:sound");
  });
});
