// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createJob, createTimesheet } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  useTimesheetsMock,
  useOptimizedAuthMock,
  useJobPayoutTotalsMock,
  useJobRatesApprovalMock,
  isJobPastClosureWindowMock,
  signatureState,
} = vi.hoisted(() => ({
  useTimesheetsMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
  useJobPayoutTotalsMock: vi.fn(),
  useJobRatesApprovalMock: vi.fn(),
  isJobPastClosureWindowMock: vi.fn(),
  signatureState: {
    clear: vi.fn(),
    toDataURL: vi.fn(() => "data:image/png;base64,signature"),
  },
}));

vi.mock("@/hooks/useTimesheets", () => ({
  useTimesheets: (...args: any[]) => useTimesheetsMock(...args),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/hooks/useJobPayoutTotals", () => ({
  useJobPayoutTotals: (...args: any[]) => useJobPayoutTotalsMock(...args),
}));

vi.mock("@/hooks/useJobRatesApproval", () => ({
  useJobRatesApproval: (...args: any[]) => useJobRatesApprovalMock(...args),
}));

vi.mock("@/utils/jobClosureUtils", () => ({
  isJobPastClosureWindow: (...args: any[]) => isJobPastClosureWindowMock(...args),
}));

vi.mock("react-signature-canvas", () => {
  const React = require("react");

  return {
    default: React.forwardRef((_props: any, ref: any) => {
      React.useImperativeHandle(ref, () => signatureState);
      return <div data-testid="signature-pad">Signature Pad</div>;
    }),
  };
});

import { TimesheetView } from "../TimesheetView";

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

describe("TimesheetView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOptimizedAuthMock.mockReturnValue({ user: { id: "tech-1" } });
    useJobPayoutTotalsMock.mockReturnValue({
      data: [{ timesheets_total_eur: 100, extras_total_eur: 0, total_eur: 100 }],
      isLoading: false,
    });
    useJobRatesApprovalMock.mockReturnValue({ data: { rates_approved: true } });
    isJobPastClosureWindowMock.mockReturnValue(false);
  });

  const baseHookValue = () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    updateTimesheet: vi.fn().mockResolvedValue(undefined),
    submitTimesheet: vi.fn().mockResolvedValue(undefined),
    signTimesheet: vi.fn().mockResolvedValue(undefined),
  });

  it("shows only the current user's timesheets and hides other technicians", () => {
    useTimesheetsMock.mockReturnValue({
      ...baseHookValue(),
      timesheets: [
        createTimesheet({
          id: "mine",
          technician_id: "tech-1",
          date: "2026-03-10",
          start_time: "09:00",
          end_time: "17:00",
          notes: "Mi parte",
        }),
        createTimesheet({
          id: "other",
          technician_id: "tech-2",
          date: "2026-03-10",
          start_time: "10:00",
          end_time: "18:00",
          notes: "Otro parte",
        }),
      ],
    });

    renderWithProviders(
      <TimesheetView
        theme={theme}
        isDark
        job={createJob({ id: "job-1", title: "Job 1" }) as any}
        onClose={vi.fn()}
        userRole="technician"
        userId="tech-1"
      />,
    );

    expect(screen.getByText("Mi parte")).toBeInTheDocument();
    expect(screen.queryByText("Otro parte")).not.toBeInTheDocument();
  });

  it("auto-detects overnight shifts and saves the updated payload", async () => {
    const user = userEvent.setup();
    const updateTimesheet = vi.fn().mockResolvedValue(undefined);

    useTimesheetsMock.mockReturnValue({
      ...baseHookValue(),
      updateTimesheet,
      timesheets: [
        createTimesheet({
          id: "mine",
          technician_id: "tech-1",
          date: "2026-03-10",
          start_time: "09:00",
          end_time: "17:00",
          status: "draft",
        }),
      ],
    });

    renderWithProviders(
      <TimesheetView
        theme={theme}
        isDark={false}
        job={createJob({ id: "job-1", title: "Job 1" }) as any}
        onClose={vi.fn()}
        userRole="technician"
        userId="tech-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: /editar horario/i }));

    const timeInputs = screen.getAllByDisplayValue(/09:00|17:00/);
    await user.clear(timeInputs[0]);
    await user.type(timeInputs[0], "22:00");
    await user.clear(timeInputs[1]);
    await user.type(timeInputs[1], "05:00");

    const overnightCheckbox = screen.getByRole("checkbox", { name: /termina al día siguiente/i });
    expect(overnightCheckbox).toBeChecked();
    expect(screen.getByText("Auto")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(updateTimesheet).toHaveBeenCalledWith(
        "mine",
        expect.objectContaining({
          start_time: "22:00",
          end_time: "05:00",
          ends_next_day: true,
        }),
      );
    });
  });

  it("submits a draft timesheet and saves a signature", async () => {
    const user = userEvent.setup();
    const submitTimesheet = vi.fn().mockResolvedValue(undefined);
    const signTimesheet = vi.fn().mockResolvedValue(undefined);

    useTimesheetsMock.mockReturnValue({
      ...baseHookValue(),
      submitTimesheet,
      signTimesheet,
      timesheets: [
        createTimesheet({
          id: "mine",
          technician_id: "tech-1",
          date: "2026-03-10",
          start_time: "09:00",
          end_time: "17:00",
          status: "draft",
        }),
      ],
    });

    renderWithProviders(
      <TimesheetView
        theme={theme}
        isDark
        job={createJob({ id: "job-1", title: "Job 1" }) as any}
        onClose={vi.fn()}
        userRole="technician"
        userId="tech-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: /añadir firma/i }));
    expect(screen.getByTestId("signature-pad")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(signTimesheet).toHaveBeenCalledWith("mine", "data:image/png;base64,signature");
    });

    await user.click(screen.getByRole("button", { name: /enviar parte/i }));

    expect(submitTimesheet).toHaveBeenCalledWith("mine");
  });

  it("hides technician totals until rates are approved and locks actions after closure", () => {
    useJobRatesApprovalMock.mockReturnValue({ data: { rates_approved: false } });
    isJobPastClosureWindowMock.mockReturnValue(true);
    useTimesheetsMock.mockReturnValue({
      ...baseHookValue(),
      timesheets: [
        createTimesheet({
          id: "mine",
          technician_id: "tech-1",
          date: "2026-03-10",
          start_time: "09:00",
          end_time: "17:00",
          status: "draft",
        }),
      ],
    });

    renderWithProviders(
      <TimesheetView
        theme={theme}
        isDark={false}
        job={createJob({ id: "job-1", title: "Job 1" }) as any}
        onClose={vi.fn()}
        userRole="technician"
        userId="tech-1"
      />,
    );

    expect(screen.getByText(/tarifas pendientes de aprobación/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar horario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enviar parte/i })).not.toBeInTheDocument();
  });
});
