// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { formatCurrency } from "@/lib/utils";
import { createTimesheet } from "@/test/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";

const {
  useTimesheetsMock,
  useOptimizedAuthMock,
  useJobPayoutTotalsMock,
  useJobRatesApprovalMock,
  updateTimesheetMock,
  submitTimesheetMock,
  signTimesheetMock,
  refetchMock,
} = vi.hoisted(() => ({
  useTimesheetsMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
  useJobPayoutTotalsMock: vi.fn(),
  useJobRatesApprovalMock: vi.fn(),
  updateTimesheetMock: vi.fn(),
  submitTimesheetMock: vi.fn(),
  signTimesheetMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("@/hooks/useTimesheets", () => ({
  useTimesheets: useTimesheetsMock,
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: useOptimizedAuthMock,
}));

vi.mock("@/hooks/useJobPayoutTotals", () => ({
  useJobPayoutTotals: useJobPayoutTotalsMock,
}));

vi.mock("@/hooks/useJobRatesApproval", () => ({
  useJobRatesApproval: useJobRatesApprovalMock,
}));

vi.mock("react-signature-canvas", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    default: React.forwardRef((_props: any, ref) => {
      React.useImperativeHandle(ref, () => ({
        toDataURL: () => "data:image/png;base64,mock-signature",
        clear: () => undefined,
      }));

      return React.createElement("div", { "data-testid": "signature-pad" });
    }),
  };
});

import { TimesheetView } from "@/components/technician/TimesheetView";

const theme = {
  bg: "bg-slate-950",
  nav: "bg-slate-900",
  card: "border-slate-800 bg-slate-900",
  textMain: "text-white",
  textMuted: "text-slate-400",
  accent: "text-blue-400",
  input: "border-slate-700 bg-slate-900 text-white",
  modalOverlay: "bg-black/90",
  divider: "border-slate-800",
  danger: "text-red-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  cluster: "bg-slate-900",
} as const;

const baseJob = {
  id: "job-1",
  title: "Festival Main Stage",
  start_time: "2026-12-01T08:00:00Z",
  end_time: "2026-12-01T20:00:00Z",
  timezone: "Europe/Madrid",
  location: { name: "Madrid Arena" },
};

const buildTimesheetsReturn = (timesheets: Record<string, unknown>[] = []) => ({
  timesheets,
  isLoading: false,
  isError: false,
  updateTimesheet: updateTimesheetMock,
  submitTimesheet: submitTimesheetMock,
  signTimesheet: signTimesheetMock,
  refetch: refetchMock,
});

const matchesCurrency = (expected: string) => (content: string) =>
  content.replace(/\s+/g, "") === expected.replace(/\s+/g, "");

const renderTimesheetView = ({
  timesheets = [],
  payoutRows = [],
  ratesApproved = true,
  userRole = "technician",
  userId = "tech-1",
}: {
  timesheets?: any[];
  payoutRows?: any[];
  ratesApproved?: boolean;
  userRole?: string | null;
  userId?: string | null;
} = {}) => {
  useTimesheetsMock.mockReturnValue(buildTimesheetsReturn(timesheets));
  useJobPayoutTotalsMock.mockReturnValue({
    data: payoutRows,
    isLoading: false,
  });
  useJobRatesApprovalMock.mockReturnValue({
    data: { rates_approved: ratesApproved },
  });
  useOptimizedAuthMock.mockReturnValue({
    user: userId ? { id: userId } : null,
  });

  return renderWithProviders(
    React.createElement(TimesheetView, {
      theme,
      isDark: true,
      job: baseJob,
      onClose: vi.fn(),
      userRole,
      userId,
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  updateTimesheetMock.mockResolvedValue(null);
  submitTimesheetMock.mockResolvedValue(null);
  signTimesheetMock.mockResolvedValue(null);
  refetchMock.mockResolvedValue(undefined);
});

describe("Timesheets Critical Paths", () => {
  it("shows the auto-created empty state when no timesheets exist", () => {
    renderTimesheetView();

    expect(screen.getByText(/no hay partes de horas/i)).toBeInTheDocument();
    expect(screen.getByText(/los partes se crean automáticamente/i)).toBeInTheDocument();
  });

  it("keeps technician earnings hidden until rates are approved", () => {
    renderTimesheetView({
      payoutRows: [
        {
          technician_id: "tech-1",
          timesheets_total_eur: 120,
          extras_total_eur: 30,
          total_eur: 150,
        },
      ],
      ratesApproved: false,
    });

    expect(screen.getByText(/tarifas pendientes de aprobación/i)).toBeInTheDocument();
    expect(screen.queryByText(formatCurrency(150))).not.toBeInTheDocument();
  });

  it("shows management totals when approved payout data is available", () => {
    renderTimesheetView({
      userRole: "management",
      userId: "manager-1",
      payoutRows: [
        {
          technician_id: "tech-1",
          timesheets_total_eur: 120,
          extras_total_eur: 30,
          total_eur: 150,
        },
      ],
    });

    expect(screen.getByText(matchesCurrency(formatCurrency(120)))).toBeInTheDocument();
    expect(screen.getByText(matchesCurrency(formatCurrency(30)))).toBeInTheDocument();
    expect(screen.getByText(matchesCurrency(formatCurrency(150)))).toBeInTheDocument();
  });

  it("lets rejected timesheets be edited and resubmitted", async () => {
    const user = userEvent.setup();
    const timesheet = createTimesheet({
      id: "ts-rejected",
      date: "2026-12-01",
      status: "rejected",
      rejection_reason: "Faltan notas",
      technician_id: "tech-1",
    });

    renderTimesheetView({ timesheets: [timesheet] });

    expect(screen.getByText(/parte rechazado/i)).toBeInTheDocument();
    expect(screen.getByText(/faltan notas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar parte/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /editar horario/i }));
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    await user.click(screen.getByRole("button", { name: /enviar parte/i }));
    expect(submitTimesheetMock).toHaveBeenCalledWith("ts-rejected");
  });

  it("captures and saves a signature before submission", async () => {
    const user = userEvent.setup();
    const timesheet = createTimesheet({
      id: "ts-sign",
      date: "2026-12-01",
      status: "draft",
      technician_id: "tech-1",
    });

    renderTimesheetView({ timesheets: [timesheet] });

    await user.click(screen.getByRole("button", { name: /añadir firma/i }));

    expect(screen.getByText(/firma digital/i)).toBeInTheDocument();
    expect(screen.getByTestId("signature-pad")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(signTimesheetMock).toHaveBeenCalledWith(
        "ts-sign",
        "data:image/png;base64,mock-signature",
      );
    });
  });

  it("shows the approved visible rate breakdown when the manager has released amounts", () => {
    const timesheet = createTimesheet({
      id: "ts-approved",
      date: "2026-12-01",
      status: "approved",
      technician_id: "tech-1",
      amount_breakdown_visible: {
        category: "responsable",
        worked_minutes: 600,
        worked_hours_rounded: 10,
        base_day_hours: 8,
        mid_tier_hours: 2,
        base_amount_eur: 150,
        overtime_hours: 1,
        overtime_hour_eur: 30,
        overtime_amount_eur: 30,
        total_eur: 180,
        notes: [],
      },
    });

    renderTimesheetView({
      timesheets: [timesheet],
      payoutRows: [
        {
          technician_id: "tech-1",
          timesheets_total_eur: 180,
          extras_total_eur: 0,
          total_eur: 180,
        },
      ],
      ratesApproved: true,
    });

    expect(screen.getByText(/desglose de tarifa/i)).toBeInTheDocument();
    expect(screen.getByText(/total: €180\.00/i)).toBeInTheDocument();
    expect(screen.getAllByText(/aprobado/i)).not.toHaveLength(0);
  });
});
