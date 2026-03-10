// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/test/renderWithProviders";

const { useQueryMock, useOptimizedAuthMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  return {
    ...actual,
    useQuery: (...args: any[]) => useQueryMock(...args),
  };
});

vi.mock("@/pages/TourManagement", () => ({
  default: ({ tour, tourJobId }: { tour: any; tourJobId: string | null }) => (
    <div>
      Tour page: {tour.name} :: {tourJobId ?? "no-job"}
    </div>
  ),
}));

import { TourManagementWrapper } from "../TourManagementWrapper";

const renderWrapper = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/tour-management/:tourId" element={<TourManagementWrapper />} />
      <Route path="/tour-management" element={<TourManagementWrapper />} />
    </Routes>,
    { route },
  );

describe("TourManagementWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOptimizedAuthMock.mockReturnValue({ user: { id: "manager-1" } });
  });

  it("renders the loading state while the query is pending", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWrapper("/tour-management/tour-1");

    expect(screen.getByText(/loading tour management/i)).toBeInTheDocument();
  });

  it("shows a clear missing-tour state when no route param is provided", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderWrapper("/tour-management");

    expect(screen.getByText(/tour not found/i)).toBeInTheDocument();
    expect(screen.getByText(/requested tour could not be found/i)).toBeInTheDocument();
  });

  it("renders a query error message when the tour is missing", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Tour not found"),
    });

    renderWrapper("/tour-management/tour-1");

    expect(screen.getByRole("heading", { name: /tour not found/i })).toBeInTheDocument();
    expect(screen.getByText("Tour not found")).toBeInTheDocument();
  });

  it("passes the loaded tour and linked job id into the page", () => {
    useQueryMock.mockReturnValue({
      data: {
        tour: { id: "tour-1", name: "World Tour" },
        tourJobId: "job-tour-1",
      },
      isLoading: false,
      error: null,
    });

    renderWrapper("/tour-management/tour-1");

    expect(screen.getByText("Tour page: World Tour :: job-tour-1")).toBeInTheDocument();
  });
});
