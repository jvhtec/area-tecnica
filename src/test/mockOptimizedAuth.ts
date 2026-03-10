import { vi } from "vitest";

import {
  createAuthState,
  createRouteShellAuthState,
  type RouteShellRole,
  type TestAuthState,
} from "./fixtures";

export const useOptimizedAuthMock = vi.fn();

export function resetOptimizedAuthMock() {
  useOptimizedAuthMock.mockReset();
  useOptimizedAuthMock.mockReturnValue(createRouteShellAuthState("management"));
}

export function mockOptimizedAuthState(overrides: Partial<TestAuthState> = {}) {
  useOptimizedAuthMock.mockReturnValue(createAuthState(overrides));
}

export function mockOptimizedAuthRole(
  role: RouteShellRole,
  overrides: Partial<TestAuthState> = {},
) {
  useOptimizedAuthMock.mockReturnValue(createRouteShellAuthState(role, overrides));
}
