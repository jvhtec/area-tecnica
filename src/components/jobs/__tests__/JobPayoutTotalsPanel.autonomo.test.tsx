import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { NO_AUTONOMO_LABEL } from "@/utils/autonomo";

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

describe("JobPayoutTotalsPanel autonomo badge", () => {
  beforeEach(() => {
    useJobPayoutDataMock.mockReturnValue({
      jobMeta: {
        id: "job-1",
        title: "Job Uno",
        start_time: "2024-01-01T00:00:00Z",
        end_time: "2024-01-01T06:00:00Z",
        timezone: "Europe/Madrid",
        tour_id: null,
        rates_approved: true,
        job_type: "single",
        invoicing_company: null,
      },
      isTourDate: false,
      isLoading: false,
      error: null,
      isClosureLocked: false,
      payoutTotals: [
        {
          technician_id: "tech-1",
          job_id: "job-1",
          timesheets_total_eur: 100,
          extras_total_eur: 0,
          total_eur: 100,
          payout_approved: true,
          extras_breakdown: { items: [], total_eur: 0 },
          vehicle_disclaimer: false,
          vehicle_disclaimer_text: null,
          expenses_total_eur: 0,
          expenses_breakdown: [],
        },
      ],
      visibleTourQuotes: [],
      tourTimesheetDays: new Map(),
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
      techDaysMap: new Map([["tech-1", 1]]),
      techTotalDaysMap: new Map([["tech-1", 1]]),
      payoutOverrides: [],
      overrideActorMap: new Map(),
      getTechOverride: () => undefined,
      calculatedGrandTotal: 100,
      isManager: true,
      isAdmin: false,
      isAdminOrAdministrative: false,
      userDepartment: null,
      rehearsalDateSet: new Set(),
      jobTimesheetDates: [],
      allDatesMarked: false,
      toggleDateRehearsalMutation: { mutate: vi.fn(), isPending: false },
      toggleAllDatesRehearsalMutation: { mutate: vi.fn(), isPending: false },
      getTechRateModeDateSelection: () => "inherit",
      setTechnicianRateModeMutation: { mutate: vi.fn(), isPending: false },
      standardPayoutTotals: [],
    });

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

  it("renders the non-autonomo badge when the flag is false", () => {
    renderWithProviders(<JobPayoutTotalsPanel jobId="job-1" />);

    expect(screen.getByText(NO_AUTONOMO_LABEL)).toBeInTheDocument();
  });
});
