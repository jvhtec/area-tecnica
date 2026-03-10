import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";

import { createRouteShellAuthState } from "@/test/fixtures";
import {
  mockOptimizedAuthRole,
  mockOptimizedAuthState,
  resetOptimizedAuthMock,
  useOptimizedAuthMock,
} from "@/test/mockOptimizedAuth";
import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

import { RequireAuth } from "../RequireAuth";

const renderRequireAuth = (route = "/secure") =>
  renderWithProviders(
    <Routes>
      <Route
        path="/secure"
        element={
          <RequireAuth>
            <div>Secret Area</div>
          </RequireAuth>
        }
      />
      <Route path="/auth" element={<div>Auth Screen</div>} />
    </Routes>,
    { route },
  );

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOptimizedAuthMock();
  });

  it("shows a loading spinner while auth is unresolved", () => {
    mockOptimizedAuthState(createRouteShellAuthState("management", { isLoading: true }));

    const { container } = renderRequireAuth();

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText("Secret Area")).not.toBeInTheDocument();
  });

  it("redirects guests to /auth", async () => {
    mockOptimizedAuthRole("guest");

    renderRequireAuth();

    expect(await screen.findByText("Auth Screen")).toBeInTheDocument();
  });

  it("renders children when a session exists", () => {
    mockOptimizedAuthRole("management");

    renderRequireAuth();

    expect(screen.getByText("Secret Area")).toBeInTheDocument();
  });
});
