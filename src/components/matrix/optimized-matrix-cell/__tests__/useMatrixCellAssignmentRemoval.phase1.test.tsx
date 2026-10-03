// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  rpcMock,
  invokeMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  invokeMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
    functions: { invoke: invokeMock },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { useMatrixCellAssignmentRemoval } from "../useMatrixCellAssignmentRemoval";

const assignment = { job_id: "job-1", sound_role: "SND-FOH-R", lights_role: "LGT-AUX" };
const technician = { id: "tech-1", department: "sound" };
// 12:00 UTC is 13:00 in Madrid: the current day key is 2026-12-01.
const date = new Date("2026-12-01T12:00:00.000Z");

const removedAssignment = {
  id: "a-1", status: "confirmed", sound_role: "SND-FOH-R", lights_role: "LGT-AUX", video_role: null,
  production_role: null, single_day: false, assignment_date: null, assignment_source: "direct",
};

const commandResult = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  outcome: "committed",
  command_id: "cmd",
  job_id: "job-1",
  technician_id: "tech-1",
  state_token: "after",
  replayed: false,
  assignment: null,
  dates: [],
  side_effects: [],
  warnings: [],
  ...overrides,
});

type RpcHandlers = Partial<Record<string, (args: Record<string, unknown>) => unknown>>;

const configureRpc = (handlers: RpcHandlers) => {
  rpcMock.mockImplementation((name: string, args: Record<string, unknown>) => {
    const handler = handlers[name];
    if (handler) return Promise.resolve(handler(args));
    if (name === "record_assignment_side_effects") return Promise.resolve({ data: {}, error: null });
    return Promise.resolve({ data: null, error: { code: "PGRST202", message: `unexpected rpc ${name}` } });
  });
};

const stateWith = (dates: string[]) => ({ data: { exists: true, assignment: removedAssignment, dates, state_token: "loaded" }, error: null });

const wholeRemoval = (deletedTimesheets: number) => ({
  data: commandResult({
    removed: { job_id: "job-1", deleted_timesheets: deletedTimesheets, deleted_assignment: true, assignment: removedAssignment },
    side_effects: [
      { kind: "flex", action: "remove", job_id: "job-1", department: "sound", status: "pending" },
      { kind: "flex", action: "remove", job_id: "job-1", department: "lights", status: "pending" },
      { kind: "notification", action: "assignment.removed", job_id: "job-1", status: "pending" },
    ],
  }),
  error: null,
});

const renderRemoval = () => renderHook(() => useMatrixCellAssignmentRemoval({ assignment, technician, date }));

const rpcCalls = (name: string) => rpcMock.mock.calls.filter(([called]) => called === name);

beforeEach(() => {
  vi.clearAllMocks();
  invokeMock.mockResolvedValue({ data: null, error: null });
});

describe("matrix assignment removal through assignment commands", () => {
  it("discovers other active dates from the authoritative state, excluding the current Madrid date", async () => {
    configureRpc({ get_assignment_command_state: () => stateWith(["2026-11-30", "2026-12-01", "2026-12-02"]) });
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });

    expect(result.current.multiDateRemoval).toMatchObject({
      isOpen: true,
      isLoading: false,
      otherDates: ["2026-11-30", "2026-12-02"],
      otherDatesCount: 2,
      currentDate: "2026-12-01",
      stateToken: "loaded",
    });
  });

  it("keeps removal day-scoped when the lookup fails", async () => {
    configureRpc({ get_assignment_command_state: () => ({ data: null, error: { code: "XX000", message: "lookup failed" } }) });
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });

    expect(result.current.multiDateRemoval).toMatchObject({ otherDatesCount: 0, stateToken: null, currentDate: "2026-12-01" });
  });

  it("removes only the selected day while others remain, guarded by the loaded state", async () => {
    configureRpc({
      get_assignment_command_state: () => stateWith(["2026-12-01", "2026-12-02"]),
      remove_assignment_date: () => ({ data: commandResult({ dates: ["2026-12-02"] }), error: null }),
    });
    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });
    await act(async () => { await result.current.handleRemoveAssignment(false); });

    expect(rpcCalls("remove_assignment_date")[0][1]).toMatchObject({
      p_job_id: "job-1", p_technician_id: "tech-1", p_date: "2026-12-01", p_expected_state_token: "loaded", p_source: "matrix",
    });
    expect(rpcCalls("remove_direct_assignment")).toHaveLength(0);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Día eliminado de la asignación");
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("turns a last-day removal into whole removal using the state the database reported", async () => {
    configureRpc({
      get_assignment_command_state: () => stateWith(["2026-12-01"]),
      remove_assignment_date: () => ({ data: commandResult({ ok: false, outcome: "rejected", code: "last_date", state_token: "server" }), error: null }),
      remove_direct_assignment: () => wholeRemoval(1),
    });
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });
    await act(async () => { await result.current.handleRemoveAssignment(false); });

    expect(rpcCalls("remove_direct_assignment")[0][1]).toMatchObject({ p_expected_state_token: "server" });
    expect(toastSuccessMock).toHaveBeenCalledWith("Asignación eliminada");
  });

  it("removes the whole assignment atomically, then runs the Flex/push plan and reports the day count", async () => {
    configureRpc({
      get_assignment_command_state: () => stateWith(["2026-12-01", "2026-12-02", "2026-12-03"]),
      remove_direct_assignment: () => wholeRemoval(3),
    });
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });
    await act(async () => { await result.current.handleRemoveAssignment(true); });

    expect(rpcCalls("remove_assignment_date")).toHaveLength(0);
    expect(rpcCalls("remove_direct_assignment")[0][1]).toMatchObject({ p_expected_state_token: "loaded" });
    expect(toastSuccessMock).toHaveBeenCalledWith("3 días eliminados de la asignación");
    await vi.waitFor(() => expect(rpcCalls("record_assignment_side_effects")).toHaveLength(1));
    expect(invokeMock).toHaveBeenCalledWith("manage-flex-crew-assignments", {
      body: { job_id: "job-1", technician_id: "tech-1", department: "sound", action: "remove" },
    });
    expect(invokeMock).toHaveBeenCalledWith("manage-flex-crew-assignments", {
      body: { job_id: "job-1", technician_id: "tech-1", department: "lights", action: "remove" },
    });
    expect(invokeMock).toHaveBeenCalledWith("push", { body: expect.objectContaining({
      type: "assignment.removed", job_id: "job-1", recipient_id: "tech-1", departments: ["sound", "lights"],
    }) });
  });

  it("keeps a committed removal successful when a Flex department fails, and records the failure", async () => {
    configureRpc({
      get_assignment_command_state: () => stateWith(["2026-12-01"]),
      remove_direct_assignment: () => wholeRemoval(1),
    });
    invokeMock.mockImplementation((name: string, { body }: { body: { department?: string } }) =>
      Promise.resolve(name === "manage-flex-crew-assignments" && body.department === "lights"
        ? { data: null, error: { message: "Flex down" } }
        : { data: null, error: null }));
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });
    await act(async () => { await result.current.handleRemoveAssignment(true); });

    expect(toastSuccessMock).toHaveBeenCalledWith("Asignación eliminada");
    await vi.waitFor(() => expect(rpcCalls("record_assignment_side_effects")).toHaveLength(1));
    expect(rpcCalls("record_assignment_side_effects")[0][1]).toMatchObject({
      p_results: expect.arrayContaining([{ index: 1, status: "failed", error: "Flex down" }]),
    });
    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/queda registrado para reintentar/i)));
  });

  it("surfaces a stale rejection, refreshes the views and does not run side effects", async () => {
    configureRpc({
      get_assignment_command_state: () => stateWith(["2026-12-01"]),
      remove_direct_assignment: () => ({ data: commandResult({ ok: false, outcome: "rejected", code: "stale_state" }), error: null }),
    });
    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });
    await act(async () => { await result.current.handleRemoveAssignment(true); });

    expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/otra persona ha modificado/i));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("surfaces an authorization failure without claiming success", async () => {
    configureRpc({
      get_assignment_command_state: () => stateWith(["2026-12-01"]),
      remove_direct_assignment: () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
    });
    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);
    const { result } = renderRemoval();

    await act(async () => { await result.current.checkMultiDateAssignment(); });
    await act(async () => { await result.current.handleRemoveAssignment(true); });

    expect(toastErrorMock).toHaveBeenCalledWith("No tienes permiso para modificar asignaciones.");
    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener("assignment-updated", eventSpy);
  });
});
