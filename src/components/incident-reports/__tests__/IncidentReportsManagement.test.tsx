// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createIncidentReport } from "@/test/fixtures";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useIncidentReportsMock, badgeMock } = vi.hoisted(() => ({
  useIncidentReportsMock: vi.fn(),
  badgeMock: vi.fn(),
}));

vi.mock("@/hooks/useIncidentReports", () => ({
  useIncidentReports: (...args: any[]) => useIncidentReportsMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("../IncidentReportsNotificationBadge", () => ({
  IncidentReportsNotificationBadge: ({ userRole }: { userRole: string }) => {
    badgeMock(userRole);
    return <div>Badge role: {userRole}</div>;
  },
}));

import { IncidentReportsManagement } from "../IncidentReportsManagement";

describe("IncidentReportsManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "manager-1" } },
      error: null,
    });
    const profileBuilder = createMockQueryBuilder({
      data: { role: "management" },
      error: null,
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profileBuilder;
      }
      return createMockQueryBuilder();
    });
  });

  it("renders loading and empty states", async () => {
    useIncidentReportsMock.mockReturnValue({
      reports: [],
      isLoading: true,
      deleteReport: vi.fn(),
      isDeleting: false,
      downloadReport: vi.fn(),
    });

    const { rerender } = renderWithProviders(<IncidentReportsManagement />);

    expect(screen.getByText(/cargando reportes/i)).toBeInTheDocument();

    useIncidentReportsMock.mockReturnValue({
      reports: [],
      isLoading: false,
      deleteReport: vi.fn(),
      isDeleting: false,
      downloadReport: vi.fn(),
    });
    rerender(<IncidentReportsManagement />);

    expect(await screen.findByText(/no se encontraron reportes/i)).toBeInTheDocument();
  });

  it("filters reports and wires download/delete actions", async () => {
    const user = userEvent.setup();
    const downloadReport = vi.fn();
    const deleteReport = vi.fn();

    useIncidentReportsMock.mockReturnValue({
      reports: [
        createIncidentReport({
          id: "report-1",
          file_name: "amp-failure.pdf",
          job: { id: "job-1", title: "Madrid Show", start_time: "2026-03-10T08:00:00Z", end_time: "2026-03-10T20:00:00Z" },
          uploaded_by_profile: { first_name: "Ana", last_name: "Jones" },
        }),
        createIncidentReport({
          id: "report-2",
          file_name: "video-loss.pdf",
          job: { id: "job-2", title: "Barcelona Show", start_time: "2026-03-10T08:00:00Z", end_time: "2026-03-10T20:00:00Z" },
          uploaded_by_profile: { first_name: "Luis", last_name: "Paz" },
        }),
      ],
      isLoading: false,
      deleteReport,
      isDeleting: false,
      downloadReport,
    });

    renderWithProviders(<IncidentReportsManagement />);

    expect(await screen.findByText("Badge role: management")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/buscar por nombre/i), "ana");

    expect(screen.getByText("amp-failure.pdf")).toBeInTheDocument();
    expect(screen.queryByText("video-loss.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /descargar/i }));
    expect(downloadReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: "report-1" }),
    );

    await user.click(screen.getByRole("button", { name: "" }));
    await user.click(await screen.findByRole("button", { name: /eliminar/i }));

    expect(deleteReport).toHaveBeenCalledWith("report-1");
    expect(badgeMock).toHaveBeenCalledWith("management");
  });
});
