// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardMobileHub } from "../DashboardMobileHub";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(),
  },
}));

vi.mock("@/utils/imageOptimization", () => ({
  getOptimizedProfilePictureUrl: (url: string) => url,
}));

describe("DashboardMobileHub", () => {
  it("shows the job location from the optimized jobs location relation", async () => {
    render(
      <DashboardMobileHub
        jobs={[
          {
            id: "job-1",
            title: "WOW 31",
            job_type: "single",
            status: "Confirmado",
            start_time: "2026-06-03T08:00:00.000Z",
            end_time: "2026-06-03T23:59:00.000Z",
            timezone: "Europe/Madrid",
            location: { name: "Madrid Arena" },
            job_departments: [{ department: "sound" }],
            job_assignments: [],
          },
        ]}
        date={new Date("2026-06-03T12:00:00.000Z")}
        onDateSelect={vi.fn()}
        userRole="management"
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
        onJobClick={vi.fn()}
      />
    );

    expect(await screen.findByText("Madrid Arena")).toBeInTheDocument();
    expect(screen.queryByText("Sin ubicación")).not.toBeInTheDocument();
  });
});
