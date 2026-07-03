// @vitest-environment jsdom
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";
import FestivalArtistManagement from "../FestivalArtistManagement";

const { useOptimizedAuthMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => useOptimizedAuthMock(),
}));

vi.mock("@/lib/enhanced-supabase-client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: mockSupabase,
}));

vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useRealtimeSubscription: vi.fn(),
}));

vi.mock("@/hooks/useArtistsQuery", () => ({
  useArtistsQuery: () => ({
    artists: [] as unknown[],
    isLoading: false,
    deleteArtist: vi.fn(),
    invalidateArtists: vi.fn(),
    isOfflineData: false,
  }),
}));

vi.mock("@/hooks/festival/useFestivalArtistJobDetails", () => ({
  useFestivalArtistJobDetails: () => ({
    jobTitle: "Festival Uno",
    jobDates: [new Date("2026-07-03T00:00:00Z")],
    selectedDate: "2026-07-03",
    setSelectedDate: vi.fn(),
    maxStages: 4,
  }),
}));

vi.mock("@/components/festival/FestivalDateNavigation", () => ({
  FestivalDateNavigation: ({
    selectedStage,
    onStageChange,
  }: {
    selectedStage: string;
    onStageChange: (stage: string) => void;
  }) => (
    <div>
      <div data-testid="selected-stage">{selectedStage}</div>
      <button type="button" onClick={() => onStageChange("3")}>
        Cambiar a stage 3
      </button>
    </div>
  ),
}));

vi.mock("@/components/festival/FestivalOfflineControls", () => ({
  FestivalOfflineControls: (): null => null,
}));

vi.mock("@/components/festival/FestivalPushFeedButton", () => ({
  FestivalPushFeedButton: (): null => null,
}));

vi.mock("@/components/ui/connection-indicator", () => ({
  ConnectionIndicator: (): null => null,
}));

vi.mock("@/components/festival/ArtistPageActions", () => ({
  ArtistPageActions: (): null => null,
}));

vi.mock("@/components/festival/ArtistTable", () => ({
  ArtistTable: (): null => null,
}));

vi.mock("@/components/festival/ArtistTableFilters", () => ({
  ArtistTableFilters: (): null => null,
}));

vi.mock("@/components/festival/FestivalOfflineBanner", () => ({
  FestivalOfflineBanner: (): null => null,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>;
};

describe("FestivalArtistManagement stage query sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useOptimizedAuthMock.mockReturnValue({ userRole: "management" });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "festival_settings") {
        return createMockQueryBuilder({ data: { day_start_time: "07:00" }, error: null });
      }
      if (table === "job_date_types") {
        return createMockQueryBuilder({ data: [{ date: "2026-07-03", type: "show" }], error: null });
      }
      if (table === "festival_stages") {
        return createMockQueryBuilder({ data: [{ number: 2, name: "Escenario Norte" }], error: null });
      }
      if (table === "festival_logos") {
        return createMockQueryBuilder({ data: null, error: null });
      }
      return createMockQueryBuilder();
    });
  });

  it("initializes from stage query param and writes stage changes back to the URL", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <>
        <Routes>
          <Route path="/festival-management/:jobId/artists" element={<FestivalArtistManagement />} />
        </Routes>
        <LocationProbe />
      </>,
      { route: "/festival-management/job-1/artists?date=2026-07-03&stage=2" },
    );

    expect(await screen.findByTestId("selected-stage")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: /cambiar a stage 3/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent("stage=3");
      expect(screen.getByTestId("location-probe")).toHaveTextContent("date=2026-07-03");
    });
  });
});
