import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatCurrency } from "@/lib/utils";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useJobPayoutDataMock, usePayoutActionsMock } = vi.hoisted(() => ({
  useJobPayoutDataMock: vi.fn(),
  usePayoutActionsMock: vi.fn(),
}));

vi.mock("@/components/jobs/payout-totals/useJobPayoutData", () => ({
  useJobPayoutData: useJobPayoutDataMock,
}));

vi.mock("@/components/jobs/payout-totals/usePayoutActions", () => ({
  usePayoutActions: usePayoutActionsMock,
}));

import { JobPayoutTotalsPanel } from "../JobPayoutTotalsPanel";

describe("JobPayoutTotalsPanel tourdate payouts", () => {
  const buildPayoutData = () => ({
    jobMeta: {
      id: "job-tour-1",
      title: "Tour Date",
      start_time: "2024-01-01T00:00:00Z",
      end_time: "2024-01-01T06:00:00Z",
      timezone: "Europe/Madrid",
      tour_id: "tour-1",
      rates_approved: true,
      job_type: "tourdate",
      invoicing_company: null,
    },
    isTourDate: true,
    isLoading: false,
    error: null,
    isClosureLocked: false,
    payoutTotals: [
      {
        technician_id: "tech-1",
        job_id: "job-tour-1",
        timesheets_total_eur: 150,
        extras_total_eur: 25,
        total_eur: 175,
        payout_approved: true,
        extras_breakdown: {
          items: [
            {
              extra_type: "travel_half",
              quantity: 1,
              unit_eur: 25,
              amount_eur: 25,
            },
          ],
          total_eur: 25,
        },
        vehicle_disclaimer: true,
        vehicle_disclaimer_text: "Vehículo asignado por la gira.",
        expenses_total_eur: 0,
        expenses_breakdown: [],
      },
    ],
    visibleTourQuotes: [],
    profilesWithEmail: [
      {
        id: "tech-1",
        first_name: "Ana",
        last_name: "Lopez",
        email: "ana@example.com",
        autonomo: false,
      },
    ],
    profileMap: new Map([
      [
        "tech-1",
        {
          id: "tech-1",
          first_name: "Ana",
          last_name: "Lopez",
          email: "ana@example.com",
          autonomo: false,
        },
      ],
    ]),
    autonomoMap: new Map([["tech-1", false]]),
    getTechName: () => "Ana Lopez",
    lpoMap: new Map(),
    flexElementMap: new Map(),
    buildFinDocUrl: () => null,
    techDaysMap: new Map(),
    techTotalDaysMap: new Map(),
    payoutOverrides: [],
    overrideActorMap: new Map(),
    getTechOverride: () => undefined,
    calculatedGrandTotal: 175,
    isManager: true,
    isAdmin: false,
    canViewTechnicianRateModePanel: false,
    isAdminOrAdministrative: false,
    userDepartment: null,
    rehearsalDateSet: new Set<string>(),
    jobTimesheetDates: [] as string[],
    allDatesMarked: false,
    toggleDateRehearsalMutation: { mutate: vi.fn(), isPending: false },
    toggleAllDatesRehearsalMutation: { mutate: vi.fn(), isPending: false },
    getTechRateModeDateSelection: () => "inherit",
    setTechnicianRateModeMutation: { mutate: vi.fn(), isPending: false },
    standardPayoutTotals: [],
  });

  beforeEach(() => {
    useJobPayoutDataMock.mockReturnValue(buildPayoutData());

    usePayoutActionsMock.mockReturnValue({
      isExporting: false,
      isSendingEmails: false,
      sendingByTech: {},
      missingEmailTechIds: [],
      previewOpen: false,
      previewContext: null,
      isLoadingPreview: false,
      editingTechId: null,
      editingAmount: "",
      setEditingAmount: vi.fn(),
      handleExport: vi.fn(),
      handleSendEmails: vi.fn(),
      handlePreviewEmails: vi.fn(),
      handleSendEmailForTech: vi.fn(),
      handleStartEdit: vi.fn(),
      handleSaveOverride: vi.fn(),
      handleRemoveOverride: vi.fn(),
      handleCancelEdit: vi.fn(),
      closePreview: vi.fn(),
      isSavingOverride: false,
      isRemovingOverride: false,
      toggleApprovalMutation: { mutate: vi.fn(), isPending: false },
    });
  });

  it("renders mapped tour payouts with totals and extras", () => {
    renderWithProviders(<JobPayoutTotalsPanel jobId="job-tour-1" />);

    const normalize = (value: string) => value.replace(/\s+/g, "");
    const grandTotals = screen.getAllByText(
      (content) => normalize(content) === normalize(formatCurrency(175)),
    );
    const baseTotals = screen.getAllByText(
      (content) => normalize(content) === normalize(formatCurrency(150)),
    );

    expect(grandTotals.length).toBeGreaterThan(0);
    expect(baseTotals.length).toBeGreaterThan(0);
    expect(screen.getByText(/travel half/i)).toBeInTheDocument();
    expect(screen.getByText(/vehículo asignado por la gira/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay información de pagos para este trabajo/i)).not.toBeInTheDocument();
  });

  it("hides the technician/date rate-mode section from non-admin payout managers", () => {
    useJobPayoutDataMock.mockReturnValue({
      ...buildPayoutData(),
      isAdmin: false,
      canViewTechnicianRateModePanel: false,
      isManager: true,
      jobTimesheetDates: ["2026-04-10"],
      rehearsalDateSet: new Set(["2026-04-10"]),
    });

    renderWithProviders(<JobPayoutTotalsPanel jobId="job-tour-1" />);

    expect(screen.queryByText(/tarifa por técnico y fecha/i)).not.toBeInTheDocument();
  });

  it("shows the technician/date rate-mode section to admins only", async () => {
    const user = userEvent.setup();

    useJobPayoutDataMock.mockReturnValue({
      ...buildPayoutData(),
      isAdmin: true,
      canViewTechnicianRateModePanel: true,
      isManager: true,
      jobTimesheetDates: ["2026-04-10"],
      rehearsalDateSet: new Set(["2026-04-10"]),
      getTechRateModeDateSelection: () => "inherit",
      setTechnicianRateModeMutation: { mutate: vi.fn(), isPending: false },
    });

    renderWithProviders(<JobPayoutTotalsPanel jobId="job-tour-1" />);

    expect(screen.getByText(/tarifa por técnico y fecha/i)).toBeInTheDocument();
    expect(screen.queryByText(/heredar \(ensayo\)/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /tarifa por técnico y fecha/i }));

    expect(screen.getByText(/heredar \(ensayo\)/i)).toBeInTheDocument();
  });

  it("keeps the admin panel visible when legacy payout data omits technician/date rate-mode handlers", () => {
    useJobPayoutDataMock.mockReturnValue({
      ...buildPayoutData(),
      isAdmin: true,
      canViewTechnicianRateModePanel: true,
      isManager: true,
      jobTimesheetDates: ["2026-04-10"],
      rehearsalDateSet: new Set(["2026-04-10"]),
      getTechRateModeDateSelection: undefined,
      setTechnicianRateModeMutation: undefined,
    });

    renderWithProviders(<JobPayoutTotalsPanel jobId="job-tour-1" />);

    expect(screen.getByText(/tarifa por técnico y fecha/i)).toBeInTheDocument();
    expect(screen.getByText("Ana Lopez")).toBeInTheDocument();
  });
});
