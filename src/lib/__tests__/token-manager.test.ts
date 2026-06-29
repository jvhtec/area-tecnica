// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

import { TokenManager, type TokenRefreshResult } from "@/lib/token-manager";

const mocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  subscribeAppRuntimeEvent: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
      signOut: mocks.signOut,
    },
  },
}));

vi.mock("@/runtime/app-runtime-events", () => ({
  APP_RUNTIME_EVENTS: {
    RESUME: "resume",
  },
  subscribeAppRuntimeEvent: mocks.subscribeAppRuntimeEvent,
}));

function resetTokenManagerSingleton(): void {
  (TokenManager as unknown as { instance?: TokenManager }).instance = undefined;
}

describe("TokenManager typing and expiry helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
    resetTokenManagerSingleton();
    mocks.onAuthStateChange.mockReset();
    mocks.getSession.mockReset();
    mocks.refreshSession.mockReset();
    mocks.signOut.mockReset();
    mocks.subscribeAppRuntimeEvent.mockReset();
  });

  afterEach(() => {
    resetTokenManagerSingleton();
    vi.useRealTimers();
  });

  it("calculates refresh timing from typed session expiry data", () => {
    const manager = TokenManager.getInstance();
    const expiresAt = Math.floor((Date.now() + 20 * 60 * 1000) / 1000);

    expect(manager.calculateRefreshTime({ expires_at: expiresAt })).toBe(15 * 60 * 1000);
    expect(manager.calculateRefreshTime(null)).toBe(30 * 60 * 1000);
  });

  it("detects sessions that are close to expiry", () => {
    const manager = TokenManager.getInstance();
    const expiresAt = Math.floor((Date.now() + 4 * 60 * 1000) / 1000);

    expect(manager.checkTokenExpiration({ expires_at: expiresAt })).toBe(true);
    expect(manager.checkTokenExpiration({ expires_at: expiresAt }, 60 * 1000)).toBe(false);
    expect(manager.checkTokenExpiration(undefined)).toBe(false);
  });

  it("exposes typed session and refresh result contracts", () => {
    expectTypeOf<ReturnType<TokenManager["getSession"]>>().toEqualTypeOf<Promise<Session | null>>();
    expectTypeOf<ReturnType<TokenManager["refreshToken"]>>().toEqualTypeOf<Promise<TokenRefreshResult>>();
    expectTypeOf<ReturnType<TokenManager["refreshTokenWithBackoff"]>>().toEqualTypeOf<Promise<TokenRefreshResult>>();
  });
});
