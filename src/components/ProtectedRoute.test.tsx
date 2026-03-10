import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";

import { createAuthState } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useOptimizedAuthMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

import { ProtectedRoute } from "./ProtectedRoute";

const renderProtectedRoute = () =>
  renderWithProviders(
    <Routes>
      <Route
        path="/secure"
        element={
          <ProtectedRoute allowedRoles={["admin", "management"]}>
            <div>Protected Content</div>
          </ProtectedRoute>
        }
      />
      <Route path="/profile" element={<div>Profile Page</div>} />
      <Route path="/tech-app" element={<div>Tech App</div>} />
      <Route path="/dashboard" element={<div>Dashboard</div>} />
    </Routes>,
    { route: "/secure" },
  );

beforeEach(() => {
  vi.clearAllMocks();
  useOptimizedAuthMock.mockReturnValue(createAuthState());
});

describe("ProtectedRoute", () => {
  it("shows a loading spinner while auth or profile loading is unresolved", () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ isLoading: true, isProfileLoading: true }),
    );

    const { container } = renderProtectedRoute();

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to profile completion", async () => {
    useOptimizedAuthMock.mockReturnValue(createAuthState({ userRole: null }));

    renderProtectedRoute();

    expect(await screen.findByText("Profile Page")).toBeInTheDocument();
  });

  it("redirects blocked technicians to the technician app route", async () => {
    useOptimizedAuthMock.mockReturnValue(createAuthState({ userRole: "technician" }));

    renderProtectedRoute();

    expect(await screen.findByText("Tech App")).toBeInTheDocument();
  });

  it("renders the protected content for allowed roles", () => {
    useOptimizedAuthMock.mockReturnValue(createAuthState({ userRole: "management" }));

    renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
