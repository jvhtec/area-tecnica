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
  isMobile: false,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/errorTracking", () => ({ trackError: mocks.trackError }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.isMobile }));
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
    shifts,
    isShiftListUnsettled,
    onCreated,
  }: {
    target: { kind: string; shiftId?: string } | null;
    shifts: Array<{ id: string }>;
    isShiftListUnsettled: boolean;
    onCreated: (created: Record<string, unknown>) => Promise<void>;
  }) =>
    target ? (
      <div
        data-testid="shift-sheet"
        data-kind={target.kind}
        data-shift-id={target.shiftId ?? ""}
        data-shifts={shifts.map((shift) => shift.id).join(",")}
        data-unsettled={String(isShiftListUnsettled)}
      >
        <button
          onClick={() =>
            void onCreated({ id: "new-shift", job_id: "job-1", date: "2026-07-01", name: "Nuevo", start_time: "09:00", end_time: "10:00" })
          }
        >
          Simular creación
        </button>
      </div>
    ) : null,
}));
vi.mock("../ShiftBoard", () => ({
  ShiftBoard: ({
    shifts,
    laneBy,
    onOpenShift,
    onCreateShift,
  }: {
    shifts: Array<{ id: string; name: string }>;
    laneBy: string;
    onOpenShift: (id: string) => void;
    onCreateShift: (prefill: Record<string, string>) => void;
  }) => (
    <div data-testid="board" data-lane-by={laneBy}>
      {shifts.map((shift) => (
        <button key={shift.id} onClick={() => onOpenShift(shift.id)}>
          Bloque {shift.name}
        </button>
      ))}
      <button onClick={() => onCreateShift({ stage: "2" })}>Nuevo en la pista 2</button>
    </div>
  ),
}));
vi.mock("../ShiftAgenda", () => ({ ShiftAgenda: (): React.ReactElement => <div data-testid="agenda" /> }));
vi.mock("../CopyShiftsDialog", () => ({
  CopyShiftsDialog: ({ onShiftsCopied }: { onShiftsCopied: () => void }) => (
    <button onClick={onShiftsCopied}>Confirmar copia</button>
  ),
}));
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

const renderScheduling = ({ view, dates = 1 }: { view?: "table"; dates?: number } = {}) => {
  if (view) window.localStorage.setItem("festival-scheduling-view", JSON.stringify({ view, laneBy: "stage" }));
  return renderWithProviders(
    <FestivalScheduling
      jobId="job-1"
      jobDates={Array.from({ length: dates }, (_, index) => new Date(`2026-07-0${index + 1}T12:00:00Z`))}
    />,
  );
};

describe("FestivalScheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.isMobile = false;
    mocks.fetchShiftsForDate.mockResolvedValue([{ id: "s1", name: "Montaje", assignments: [] }]);
    mocks.deleteFestivalShift.mockResolvedValue(undefined);
  });

  it("has no manual refresh: the list stays live by itself", async () => {
    renderScheduling({ view: "table" });
    await screen.findByRole("button", { name: "Borrar Montaje" });

    expect(screen.queryByRole("button", { name: /Actualizar/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("subscription-indicator")).toHaveAttribute("data-refresh", "false");
  });

  it("deletes a shift, refreshes the day and says so", async () => {
    renderScheduling({ view: "table" });
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Montaje" }));

    await waitFor(() => expect(mocks.deleteFestivalShift.mock.calls[0][0]).toBe("s1"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Turno eliminado" })));
    // Once to show the day, once more after the delete.
    await waitFor(() => expect(mocks.fetchShiftsForDate.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("reports a failed delete without refreshing", async () => {
    mocks.deleteFestivalShift.mockRejectedValue(new Error("denied"));
    renderScheduling({ view: "table" });
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

    expect(await screen.findByRole("button", { name: "Bloque Montaje" })).toBeInTheDocument();
  }, 15000);

  it("opens the shift sheet to create, and keeps it open on the shift it just created", async () => {
    renderScheduling();
    await screen.findByRole("button", { name: "Bloque Montaje" });

    fireEvent.click(screen.getByRole("button", { name: "Crear turno" }));
    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "create");

    fireEvent.click(screen.getByRole("button", { name: "Simular creación" }));
    await waitFor(() => expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "edit"));
    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-shift-id", "new-shift");
  });

  it("puts a just-created shift in the day's list straight away, so a failed refresh cannot make it look gone", async () => {
    renderScheduling();
    await screen.findByRole("button", { name: "Bloque Montaje" });
    fireEvent.click(screen.getByRole("button", { name: "Crear turno" }));

    // The refresh that follows the save fails.
    mocks.fetchShiftsForDate.mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Simular creación" }));

    await waitFor(() => expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-shift-id", "new-shift"));
    expect(screen.getByTestId("shift-sheet").getAttribute("data-shifts")).toContain("new-shift");
    // While the list refreshes or has failed to, the sheet is told not to treat a missing shift as deleted.
    await waitFor(() => expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-unsettled", "true"));
  }, 15000);

  it("opens an existing shift in the sheet from the table", async () => {
    renderScheduling({ view: "table" });
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Montaje" }));

    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "edit");
    expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-shift-id", "s1");
  });

  describe("views", () => {
    it("opens on the board, and a shift on it opens the sheet", async () => {
      renderScheduling();

      fireEvent.click(await screen.findByRole("button", { name: "Bloque Montaje" }));

      expect(screen.getByTestId("board")).toBeInTheDocument();
      expect(screen.queryByTestId("agenda")).not.toBeInTheDocument();
      expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-shift-id", "s1");
    });

    it("opens the sheet on a new shift with the stage of the lane it was started in", async () => {
      renderScheduling();

      fireEvent.click(await screen.findByRole("button", { name: "Nuevo en la pista 2" }));

      expect(screen.getByTestId("shift-sheet")).toHaveAttribute("data-kind", "create");
    });

    it("is an agenda on a phone", async () => {
      mocks.isMobile = true;
      renderScheduling();

      expect(await screen.findByTestId("agenda")).toBeInTheDocument();
      expect(screen.queryByTestId("board")).not.toBeInTheDocument();
    });

    it("switches to the table, remembers it, and offers grouping only on the board", async () => {
      const first = renderScheduling();
      await screen.findByTestId("board");
      expect(screen.getByRole("radio", { name: "Por departamento" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "Tabla" }));

      expect(await screen.findByRole("button", { name: "Borrar Montaje" })).toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: "Por departamento" })).not.toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem("festival-scheduling-view") ?? "{}").view).toBe("table");

      // A later visit starts where the planner left off.
      first.unmount();
      renderScheduling();
      expect(await screen.findByRole("button", { name: "Borrar Montaje" })).toBeInTheDocument();
    });

    it("groups the board by department when asked", async () => {
      renderScheduling();
      await screen.findByTestId("board");
      expect(screen.getByTestId("board")).toHaveAttribute("data-lane-by", "stage");

      fireEvent.click(screen.getByRole("radio", { name: "Por departamento" }));

      expect(screen.getByTestId("board")).toHaveAttribute("data-lane-by", "department");
    });

    it("shows the agenda on a phone even for an empty day, so a shift can be started in a stage", async () => {
      mocks.isMobile = true;
      mocks.fetchShiftsForDate.mockResolvedValue([]);
      renderScheduling();

      expect(await screen.findByText("No hay turnos programados para esta fecha")).toBeInTheDocument();
      expect(screen.getByTestId("agenda")).toBeInTheDocument();
    });

    it("offers copying the day in every view once the festival has several dates", async () => {
      renderScheduling({ dates: 2 });
      fireEvent.click(await screen.findByRole("button", { name: "Copiar turnos" }));

      fireEvent.click(screen.getByRole("button", { name: "Confirmar copia" }));

      await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar copia" })).not.toBeInTheDocument());
      expect(mocks.fetchShiftsForDate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("has nothing to copy on a single-date festival", async () => {
      renderScheduling();
      await screen.findByTestId("board");
      expect(screen.queryByRole("button", { name: "Copiar turnos" })).not.toBeInTheDocument();
    });

    it("says so when the day has no shifts, and still shows the board to start one on", async () => {
      mocks.fetchShiftsForDate.mockResolvedValue([]);
      renderScheduling();

      expect(await screen.findByText("No hay turnos programados para esta fecha")).toBeInTheDocument();
      expect(screen.getByTestId("board")).toBeInTheDocument();
    });
  });
});
