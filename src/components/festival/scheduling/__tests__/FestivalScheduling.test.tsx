// @vitest-environment jsdom
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  trackError: vi.fn(),
  deleteFestivalShift: vi.fn(),
  fetchShiftsForDate: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/errorTracking", () => ({ trackError: mocks.trackError }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useRealtimeSubscription", () => ({ useRealtimeSubscription: vi.fn() }));
vi.mock("@/features/festival-scheduling/api", () => ({
  fetchShiftsForDate: mocks.fetchShiftsForDate,
  deleteFestivalShift: mocks.deleteFestivalShift,
}));
vi.mock("@/features/festival-management/queries", () => ({ fetchFestivalDateTypes: vi.fn().mockResolvedValue({}) }));
vi.mock("@/features/festival-management/useFestivalDayStart", () => ({
  useFestivalDayStart: () => ({ dayStartTime: "06:00", error: null, isDayStartReady: true, isPending: false }),
}));
vi.mock("@/components/festival/FestivalDateNavigation", () => ({ FestivalDateNavigation: (): null => null }));
vi.mock("@/components/ui/subscription-indicator", () => ({
  SubscriptionIndicator: (props: Record<string, unknown>) => (
    <div data-testid="subscription-indicator" data-refresh={String("showRefreshButton" in props)} />
  ),
}));
vi.mock("../ShiftSheet", () => ({
  ShiftSheet: ({
    target,
    onCreated,
  }: {
    target: { kind: string; shiftId?: string } | null;
    onCreated: (shiftId: string) => Promise<void>;
  }) =>
    target ? (
      <div data-testid="shift-sheet" data-kind={target.kind} data-shift-id={target.shiftId ?? ""}>
        <button onClick={() => void onCreated("new-shift")}>Simular creación</button>
      </div>
    ) : null,
}));
vi.mock("../ShiftsList", () => ({ ShiftsList: (): null => null }));
vi.mock("../ShiftsTable", () => ({
  ShiftsTable: ({
    shifts,
    onDeleteShift,
    onOpenShift,
  }: {
    shifts: Array<{ id: string; name: string }>;
    onDeleteShift: (id: string) => void;
    onOpenShift: (id: string) => void;
  }) => (
    <div>
      {shifts.map((shift) => (
        <div key={shift.id}>
          <button onClick={() => onDeleteShift(shift.id)}>Borrar {shift.name}</button>
          <button onClick={() => onOpenShift(shift.id)}>Abrir {shift.name}</button>
        </div>
      ))}
    </div>
  ),
}));

import { FestivalScheduling } from "../FestivalScheduling";

const renderScheduling = () =>
  renderWithProviders(<FestivalScheduling jobId="job-1" jobDates={[new Date("2026-07-01T12:00:00Z")]} />);

describe("FestivalScheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchShiftsForDate.mockResolvedValue([{ id: "s1", name: "Montaje", assignments: [] }]);
    mocks.deleteFestivalShift.mockResolvedValue(undefined);
  });

  it("has no manual refresh: the list stays live by itself", async () => {
    renderScheduling();
    await screen.findByRole("button", { name: "Borrar Montaje" });

    expect(screen.queryByRole("button", { name: /Actualizar/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("subscription-indicator")).toHaveAttribute("data-refresh", "false");
  });

  it("deletes a shift, refreshes the day and says so", async () => {
    renderScheduling();
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Montaje" }));

    await waitFor(() => expect(mocks.deleteFestivalShift.mock.calls[0][0]).toBe("s1"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Turno eliminado" })));
    // Once to show the day, once more after the delete.
    await waitFor(() => expect(mocks.fetchShiftsForDate.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("reports a failed delete without refreshing", async () => {
    mocks.deleteFestivalShift.mockRejectedValue(new Error("denied"));
    renderScheduling();
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Montaje" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudo eliminar el turno: denied", variant: "destructive" }),
      ),
    );
    expect(mocks.trackError).toHaveBeenCalled();
    expect(mocks.fetchShiftsForDate).toHaveBeenCalledTimes(1);
  });

  it("shows a failed load with a retry, not an empty day", async () => {
    mocks.fetchShiftsForDate.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
    renderScheduling();

    expect(await screen.findByText("No se pudieron cargar los turnos", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText("No hay turnos programados para esta fecha")).not.toBeInTheDocument();

    mocks.fetchShiftsForDate.mockResolvedValue([{ id: "s1", name: "Montaje", assignments: [] }]);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("button", { name: "Borrar Montaje" })).toBeInTheDocument();
  }, 15000);

  it("opens the shift sheet to create, and keeps it open on the shift it just created", async () => {
    renderScheduling();
    await screen.findByRole("button", { name: "Borrar Montaje" });

    fireEvent.click(screen.getByRole("button", { name: "Crear turno" }));
    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "create");

    fireEvent.click(screen.getByRole("button", { name: "Simular creación" }));
    await waitFor(() => expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "edit"));
    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-shift-id", "new-shift");
    // The day was refreshed before the sheet switched, so the new shift is in the list it reads.
    expect(mocks.fetchShiftsForDate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("opens an existing shift in the sheet from the list", async () => {
    renderScheduling();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Montaje" }));

    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "edit");
    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-shift-id", "s1");
  });
});
