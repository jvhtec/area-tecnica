// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  rpcMock,
  invokeMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  invokeMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: fromMock,
    rpc: rpcMock,
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { useMatrixCellAssignmentRemoval } from "../useMatrixCellAssignmentRemoval";

type BuilderResult = { data?: unknown; error?: unknown };
type QueryBuilder = PromiseLike<BuilderResult> & {
  calls: Array<[string, ...unknown[]]>;
  select: (...args: unknown[]) => QueryBuilder;
  delete: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  neq: (...args: unknown[]) => QueryBuilder;
};

const makeBuilder = (result: BuilderResult): QueryBuilder => {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = {} as QueryBuilder;
  builder.calls = calls;
  builder.select = vi.fn((...args: unknown[]) => {
    calls.push(["select", ...args]);
    return builder;
  });
  builder.delete = vi.fn((...args: unknown[]) => {
    calls.push(["delete", ...args]);
    return builder;
  });
  builder.eq = vi.fn((...args: unknown[]) => {
    calls.push(["eq", ...args]);
    return builder;
  });
  builder.neq = vi.fn((...args: unknown[]) => {
    calls.push(["neq", ...args]);
    return builder;
  });
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

const assignment = {
  job_id: "job-1",
  sound_role: "SND-FOH-R",
  lights_role: "LGT-AUX",
};

const technician = {
  id: "tech-1",
  department: "sound",
};

const date = new Date("2026-12-01T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: { success: true }, error: null });
  invokeMock.mockResolvedValue({ data: null, error: null });
});

describe("matrix assignment removal Phase 1 characterization", () => {
  it("discovers other active dates while excluding the current Madrid date", async () => {
    const builder = makeBuilder({
      data: [{ date: "2026-12-02" }, { date: "2026-12-03" }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.checkMultiDateAssignment();
    });

    expect(fromMock).toHaveBeenCalledWith("timesheets");
    expect(builder.calls).toEqual(
      expect.arrayContaining([
        ["select", "date"],
        ["eq", "job_id", "job-1"],
        ["eq", "technician_id", "tech-1"],
        ["eq", "is_active", true],
        ["neq", "date", "2026-12-01"],
      ]),
    );
    expect(result.current.multiDateRemoval).toMatchObject({
      isOpen: true,
      isLoading: false,
      otherDates: ["2026-12-02", "2026-12-03"],
      otherDatesCount: 2,
      currentDate: "2026-12-01",
      removeOption: "single",
    });
  });

  it("fails closed to an empty other-date list when the lookup errors", async () => {
    fromMock.mockReturnValue(
      makeBuilder({ data: null, error: new Error("timesheet lookup failed") }),
    );

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.checkMultiDateAssignment();
    });

    expect(result.current.multiDateRemoval).toMatchObject({
      isOpen: true,
      isLoading: false,
      otherDates: [],
      otherDatesCount: 0,
      currentDate: "2026-12-01",
    });
  });

  it("uses hard lifecycle cancellation for whole-assignment removal", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.handleRemoveAssignment(true);
    });

    expect(rpcMock).toHaveBeenCalledWith("manage_assignment_lifecycle", {
      p_job_id: "job-1",
      p_technician_id: "tech-1",
      p_action: "cancel",
      p_delete_mode: "hard",
    });

    expect(invokeMock).toHaveBeenCalledWith("manage-flex-crew-assignments", {
      body: {
        job_id: "job-1",
        technician_id: "tech-1",
        department: "sound",
        action: "remove",
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("manage-flex-crew-assignments", {
      body: {
        job_id: "job-1",
        technician_id: "tech-1",
        department: "lights",
        action: "remove",
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("push", {
      body: expect.objectContaining({
        action: "broadcast",
        type: "assignment.removed",
        job_id: "job-1",
        recipient_id: "tech-1",
        technician_id: "tech-1",
        departments: expect.arrayContaining(["sound", "lights"]),
      }),
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Asignación eliminada");
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("keeps successful removal successful when one Flex department fails", async () => {
    invokeMock.mockImplementation((
      name: string,
      args?: { body?: { department?: string } },
    ) => {
      if (
        name === "manage-flex-crew-assignments"
        && args?.body?.department === "lights"
      ) {
        return Promise.resolve({ data: null, error: new Error("Flex unavailable") });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.handleRemoveAssignment(true);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Asignación eliminada");
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("keeps successful removal successful when push delivery fails", async () => {
    invokeMock.mockImplementation((name: string) => {
      if (name === "push") {
        return Promise.resolve({ data: null, error: new Error("push unavailable") });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.handleRemoveAssignment(true);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Asignación eliminada");
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("surfaces lifecycle failure and does not emit assignment-updated", async () => {
    rpcMock.mockResolvedValue({
      data: { error: "conflict_detected" },
      error: null,
    });
    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.handleRemoveAssignment(true);
    });

    expect(toastErrorMock).toHaveBeenCalledWith("conflict_detected");
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("removes only the selected timesheet date when other dates remain", async () => {
    const lookupBuilder = makeBuilder({
      data: [{ date: "2026-12-02" }],
      error: null,
    });
    const deleteBuilder = makeBuilder({
      data: null,
      error: null,
    });
    fromMock
      .mockReturnValueOnce(lookupBuilder)
      .mockReturnValueOnce(deleteBuilder);

    const eventSpy = vi.fn();
    window.addEventListener("assignment-updated", eventSpy);

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.checkMultiDateAssignment();
    });
    expect(result.current.multiDateRemoval.otherDatesCount).toBe(1);

    await act(async () => {
      await result.current.handleRemoveAssignment(false);
    });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(deleteBuilder.calls).toEqual(
      expect.arrayContaining([
        ["delete"],
        ["eq", "job_id", "job-1"],
        ["eq", "technician_id", "tech-1"],
        ["eq", "date", "2026-12-01"],
      ]),
    );
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Día eliminado de la asignación");
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("assignment-updated", eventSpy);
  });

  it("uses whole-assignment removal automatically when no other active dates exist", async () => {
    fromMock.mockReturnValue(
      makeBuilder({
        data: [],
        error: null,
      }),
    );

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.checkMultiDateAssignment();
    });
    expect(result.current.multiDateRemoval.otherDatesCount).toBe(0);

    await act(async () => {
      await result.current.handleRemoveAssignment(false);
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "manage_assignment_lifecycle",
      expect.objectContaining({
        p_action: "cancel",
        p_delete_mode: "hard",
      }),
    );
  });

  it("reports the total removed-day count when deleting a multi-date assignment", async () => {
    fromMock.mockReturnValue(
      makeBuilder({
        data: [{ date: "2026-12-02" }, { date: "2026-12-03" }],
        error: null,
      }),
    );

    const { result } = renderHook(() =>
      useMatrixCellAssignmentRemoval({ assignment, technician, date }),
    );

    await act(async () => {
      await result.current.checkMultiDateAssignment();
    });

    await act(async () => {
      await result.current.handleRemoveAssignment(true);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      "3 días eliminados de la asignación",
    );
  });
});
