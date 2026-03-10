// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAssignment, createJob, createTechnicianProfile, createTour } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useMyToursMock, techJobCardMock, tourCardMock } = vi.hoisted(() => ({
  useMyToursMock: vi.fn(),
  techJobCardMock: vi.fn(),
  tourCardMock: vi.fn(),
}));

vi.mock("@/hooks/useMyTours", () => ({
  useMyTours: (...args: any[]) => useMyToursMock(...args),
}));

vi.mock("@/components/technician/TechJobCard", () => ({
  TechJobCard: (props: any) => {
    techJobCardMock(props);
    return (
      <div data-testid="tech-job-card">
        {props.job.jobs?.title ?? props.job.title} :: crew-chief:{String(props.isCrewChief)}
      </div>
    );
  },
}));

vi.mock("@/components/technician/TourCard", () => ({
  TourCard: (props: any) => {
    tourCardMock(props);
    return (
      <button type="button" onClick={() => props.onNavigate(props.tour.id)}>
        Open {props.tour.name}
      </button>
    );
  },
}));

vi.mock("@/components/expenses/PendingExpensesSummary", () => ({
  PendingExpensesSummary: () => <div data-testid="pending-expenses">Pending expenses</div>,
}));

import { DashboardScreen } from "../DashboardScreen";

const theme = {
  bg: "bg-slate-950",
  nav: "bg-slate-900",
  card: "bg-slate-900",
  textMain: "text-white",
  textMuted: "text-slate-400",
  accent: "bg-blue-600",
  input: "bg-slate-800",
  modalOverlay: "bg-black/70",
  divider: "border-slate-800",
  danger: "text-red-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  cluster: "bg-white text-black",
} as const;

describe("DashboardScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-03-10T09:00:00Z"));
    useMyToursMock.mockReturnValue({ activeTours: [] });
  });

  it("renders today stats, tours, and today's assignment", () => {
    useMyToursMock.mockReturnValue({
      activeTours: [createTour({ id: "tour-1", name: "Madrid Run" }), createTour({ id: "tour-2", name: "Barcelona Run" })],
    });

    const assignments = [
      createAssignment({
        id: "assignment-today",
        job_id: "job-today",
        jobs: createJob({
          id: "job-today",
          title: "Hoy",
          start_time: "2026-03-10T18:00:00Z",
        }),
        sound_role: "chief",
      }),
      createAssignment({
        id: "assignment-upcoming",
        job_id: "job-upcoming",
        jobs: createJob({
          id: "job-upcoming",
          title: "Proximo",
          start_time: "2026-03-12T18:00:00Z",
        }),
      }),
    ];

    renderWithProviders(
      <DashboardScreen
        theme={theme}
        isDark
        user={{ email: "tech@example.com" }}
        userProfile={createTechnicianProfile({ role: "house_tech", department: "sound" })}
        assignments={assignments as any}
        isLoading={false}
        onOpenAction={vi.fn()}
        onOpenSV={vi.fn()}
        onOpenObliqueStrategy={vi.fn()}
        onOpenTour={vi.fn()}
        onOpenRates={vi.fn()}
        onOpenMessages={vi.fn()}
        onOpenSysCalc={vi.fn()}
        hasSoundVisionAccess
      />,
    );

    expect(screen.getByText("19:00")).toBeInTheDocument();
    expect(screen.getByText("2 trabajos")).toBeInTheDocument();
    expect(within(screen.getByText("Tours").parentElement as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(screen.getByTestId("pending-expenses")).toBeInTheDocument();
    expect(screen.getByTestId("tech-job-card")).toHaveTextContent("Hoy");
    expect(screen.getByTestId("tech-job-card")).toHaveTextContent("crew-chief:true");
    expect(screen.getByRole("button", { name: /open madrid run/i })).toBeInTheDocument();
  });

  it("gates optional tools and routes tour navigation through the card callback", async () => {
    const user = userEvent.setup();
    const onOpenTour = vi.fn();
    const onOpenSysCalc = vi.fn();
    const onOpenSV = vi.fn();

    useMyToursMock.mockReturnValue({
      activeTours: [createTour({ id: "tour-77", name: "Mini Tour" })],
    });

    renderWithProviders(
      <DashboardScreen
        theme={theme}
        isDark={false}
        user={{ email: "tech@example.com" }}
        userProfile={createTechnicianProfile({ department: "lights", role: "technician" })}
        assignments={[]}
        isLoading={false}
        onOpenAction={vi.fn()}
        onOpenSV={onOpenSV}
        onOpenObliqueStrategy={vi.fn()}
        onOpenTour={onOpenTour}
        onOpenRates={vi.fn()}
        onOpenMessages={vi.fn()}
        onOpenSysCalc={onOpenSysCalc}
        hasSoundVisionAccess={false}
      />,
    );

    expect(screen.queryByText(/soundvision/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/syscalc/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open mini tour/i }));

    expect(onOpenTour).toHaveBeenCalledWith("tour-77");
    expect(onOpenSV).not.toHaveBeenCalled();
    expect(onOpenSysCalc).not.toHaveBeenCalled();
  });
});
