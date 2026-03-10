// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { createAssignment, createJob, createRouteShellAuthState, createTechnicianProfile } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  useOptimizedAuthMock,
  useThemeMock,
  setThemeMock,
  useMyToursMock,
  useTableSubscriptionMock,
} = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  useThemeMock: vi.fn(),
  setThemeMock: vi.fn(),
  useMyToursMock: vi.fn(),
  useTableSubscriptionMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("next-themes", () => ({
  useTheme: (...args: any[]) => useThemeMock(...args),
}));

vi.mock("@/hooks/useMyTours", () => ({
  useMyTours: (...args: any[]) => useMyToursMock(...args),
}));

vi.mock("@/hooks/useTableSubscription", () => ({
  useTableSubscription: (...args: any[]) => useTableSubscriptionMock(...args),
}));

vi.mock("@/hooks/useMobileRealtimeSubscriptions", () => ({
  useTechnicianDashboardSubscriptions: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/components/technician/DashboardScreen", () => ({
  DashboardScreen: ({ assignments }: { assignments: any[] }) => (
    <div data-testid="dashboard-screen">Dashboard assignments: {assignments.length}</div>
  ),
}));

vi.mock("@/components/technician/JobsView", () => ({
  JobsView: ({ assignments }: { assignments: any[] }) => <div>Jobs assignments: {assignments.length}</div>,
}));

vi.mock("@/components/technician/AvailabilityView", () => ({
  AvailabilityView: () => <div>Availability View</div>,
}));

vi.mock("@/components/technician/ProfileView", () => ({
  ProfileView: ({ toggleTheme }: { toggleTheme: () => void }) => (
    <button type="button" onClick={toggleTheme}>
      Toggle Theme
    </button>
  ),
}));

vi.mock("@/components/technician/AboutModal", () => ({
  AboutModal: () => <div>About Modal</div>,
}));

vi.mock("@/components/technician/TourDetailView", () => ({
  TourDetailView: () => null,
}));

vi.mock("@/components/technician/MessagesModal", () => ({
  MessagesModal: () => null,
}));

vi.mock("@/components/technician/SoundVisionModal", () => ({
  SoundVisionModal: () => null,
}));

vi.mock("@/components/technician/ObliqueStrategyModal", () => ({
  ObliqueStrategyModal: () => null,
}));

vi.mock("@/components/technician/TimesheetView", () => ({
  TimesheetView: () => null,
}));

vi.mock("@/components/technician/DetailsModal", () => ({
  DetailsModal: () => null,
}));

vi.mock("@/components/technician/TechnicianArtistReadOnlyModal", () => ({
  TechnicianArtistReadOnlyModal: () => null,
}));

vi.mock("@/components/technician/TechnicianRfTableModal", () => ({
  TechnicianRfTableModal: () => null,
}));

vi.mock("@/components/incident-reports/TechnicianIncidentReportDialog", () => ({
  TechnicianIncidentReportDialog: () => null,
}));

vi.mock("@/components/jobs/JobDetailsDialog", () => ({
  JobDetailsDialog: () => null,
}));

vi.mock("@/components/dashboard/TechnicianTourRates", () => ({
  TechnicianTourRates: () => null,
}));

vi.mock("@/components/messages/SendMessage", () => ({
  SendMessage: () => null,
}));

vi.mock("@/components/messages/MessagesList", () => ({
  MessagesList: () => null,
}));

vi.mock("@/components/messages/DirectMessagesList", () => ({
  DirectMessagesList: () => null,
}));

import TechnicianSuperApp from "../TechnicianSuperApp";

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>;
};

describe("TechnicianSuperApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.setSystemTime(new Date("2026-03-10T09:00:00Z"));
    useOptimizedAuthMock.mockReturnValue(
      createRouteShellAuthState("technician", {
        hasSoundVisionAccess: true,
      }),
    );
    useThemeMock.mockReturnValue({
      theme: "light",
      setTheme: setThemeMock,
    });
    useMyToursMock.mockReturnValue({ activeTours: [] });
    useTableSubscriptionMock.mockReturnValue({ isSubscribed: true, isStale: false });
  });

  const configureSupabase = () => {
    const profileBuilder = createMockQueryBuilder({
      data: createTechnicianProfile({ id: "technician-user", role: "technician", department: "sound" }),
      error: null,
    });
    const assignmentBuilder = createMockQueryBuilder({
      data: [
        {
          job_id: "job-1",
          sound_role: "chief",
          lights_role: null,
          video_role: null,
          status: "confirmed",
          assigned_at: "2026-03-10T08:00:00Z",
        },
        {
          job_id: "job-2",
          sound_role: "tech",
          lights_role: null,
          video_role: null,
          status: "confirmed",
          assigned_at: "2026-03-10T09:00:00Z",
        },
      ],
      error: null,
    });
    const timesheetsBuilder = createMockQueryBuilder({
      data: [
        {
          job_id: "job-1",
          technician_id: "technician-user",
          date: "2026-03-10",
          jobs: createJob({ id: "job-1", title: "Job One" }),
        },
        {
          job_id: "job-1",
          technician_id: "technician-user",
          date: "2026-03-11",
          jobs: createJob({ id: "job-1", title: "Job One" }),
        },
        {
          job_id: "job-2",
          technician_id: "technician-user",
          date: "2026-03-12",
          jobs: createJob({ id: "job-2", title: "Job Two" }),
        },
      ],
      error: null,
    });
    const artistsBuilder = createMockQueryBuilder({
      data: [{ job_id: "job-1" }, { job_id: "job-1" }, { job_id: "job-2" }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profileBuilder;
      }
      if (table === "job_assignments") {
        return assignmentBuilder;
      }
      if (table === "timesheets") {
        return timesheetsBuilder;
      }
      if (table === "festival_artists") {
        return artistsBuilder;
      }

      return createMockQueryBuilder();
    });

    return { assignmentBuilder };
  };

  it("defaults to the dashboard tab and deduplicates assignments by job_id", async () => {
    const { assignmentBuilder } = configureSupabase();

    renderWithProviders(<TechnicianSuperApp />, { route: "/tech-app" });

    expect(await screen.findByText("Dashboard assignments: 2")).toBeInTheDocument();
    expect(assignmentBuilder.eq).toHaveBeenCalledWith("status", "confirmed");
  });

  it("opens the about modal from the URL parameter and clears the search param", async () => {
    configureSupabase();

    renderWithProviders(
      <>
        <TechnicianSuperApp />
        <LocationProbe />
      </>,
      { route: "/tech-app?showAbout=1" },
    );

    expect(await screen.findByText("About Modal")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent("/tech-app");
      expect(screen.getByTestId("location-probe")).not.toHaveTextContent("showAbout=1");
    });
  });

  it("persists the legacy theme-preference key when toggling from the profile tab", async () => {
    const user = userEvent.setup();
    configureSupabase();

    renderWithProviders(<TechnicianSuperApp />, { route: "/tech-app" });

    await screen.findByText("Dashboard assignments: 2");
    await user.click(screen.getByRole("button", { name: /perfil/i }));
    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
    expect(window.localStorage.getItem("theme-preference")).toBe("dark");
  });
});
