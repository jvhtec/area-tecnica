// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { buildEmptyGearFormData } from "../model";

const { toastMock, apiMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  apiMock: {
    fetchGearSetupState: vi.fn(),
    saveGlobalGearSetup: vi.fn(),
    saveStageGearSetup: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/lib/errorTracking", () => ({ trackError: vi.fn() }));
vi.mock("../api", () => apiMock);

import { useGearSetupForm } from "../hooks/useGearSetupForm";

const stateWith = (notes: string, extra: Record<string, unknown> = {}) => ({
  gearSetupId: "gear-1",
  globalSetup: null,
  stageSetupId: null,
  form: { ...buildEmptyGearFormData(3), notes },
  ...extra,
});

const setup = (props: { stageNumber?: number; readOnly?: boolean } = {}) => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(
    (hookProps: { stageNumber: number }) =>
      useGearSetupForm({
        jobId: "job-1",
        stageNumber: hookProps.stageNumber,
        readOnly: props.readOnly ?? false,
      }),
    { wrapper, initialProps: { stageNumber: props.stageNumber ?? 1 } },
  );
  return { ...rendered, queryClient };
};

describe("useGearSetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.fetchGearSetupState.mockResolvedValue(stateWith("guardado"));
    apiMock.saveGlobalGearSetup.mockResolvedValue({ gearSetupId: "gear-1", globalSetup: null });
    apiMock.saveStageGearSetup.mockResolvedValue({ gearSetupId: "gear-1", stageSetupId: "s", maxStages: 3 });
  });

  it("loads the saved setup into the form", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));
    expect(result.current.gearSetupId).toBe("gear-1");
    expect(result.current.hasStageSpecificSetup).toBe(false);
  });

  it("does not overwrite unsaved edits when the server data is refetched", async () => {
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));

    act(() => result.current.handleChange({ notes: "editando" }));

    apiMock.fetchGearSetupState.mockResolvedValue(stateWith("cambio remoto"));
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(apiMock.fetchGearSetupState).toHaveBeenCalledTimes(2);
    expect(result.current.setup.notes).toBe("editando");
  });

  it("re-seeds the form when another stage is selected", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));
    act(() => result.current.handleChange({ notes: "editando" }));

    apiMock.fetchGearSetupState.mockResolvedValue(stateWith("escenario 2", { stageSetupId: "stage-2" }));
    rerender({ stageNumber: 2 });

    await waitFor(() => expect(result.current.setup.notes).toBe("escenario 2"));
    expect(result.current.hasStageSpecificSetup).toBe(true);
  });

  it("saves stage 1 as the festival-wide setup, passing the existing id", async () => {
    const { result } = setup({ stageNumber: 1 });
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));

    act(() => result.current.handleChange({ notes: "nuevo" }));
    act(() => result.current.save());

    await waitFor(() => expect(apiMock.saveGlobalGearSetup).toHaveBeenCalledTimes(1));
    expect(apiMock.saveGlobalGearSetup).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "nuevo" }),
      "job-1",
      "gear-1",
    );
    expect(apiMock.saveStageGearSetup).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "La configuración de equipamiento global ha sido guardada." }),
      ),
    );
  });

  it("saves any other stage through the transactional stage save", async () => {
    const { result } = setup({ stageNumber: 3 });
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));

    act(() => result.current.save());

    await waitFor(() => expect(apiMock.saveStageGearSetup).toHaveBeenCalledTimes(1));
    expect(apiMock.saveStageGearSetup).toHaveBeenCalledWith(expect.anything(), "job-1", 3);
    expect(apiMock.saveGlobalGearSetup).not.toHaveBeenCalled();
  });

  it("ignores edits and saves when read-only", async () => {
    const { result } = setup({ readOnly: true });
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));

    act(() => result.current.handleChange({ notes: "no" }));
    act(() => result.current.save());

    expect(result.current.setup.notes).toBe("guardado");
    expect(apiMock.saveGlobalGearSetup).not.toHaveBeenCalled();
  });

  it("tells the user when saving fails", async () => {
    apiMock.saveGlobalGearSetup.mockRejectedValue(new Error("boom"));
    const { result } = setup();
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));

    act(() => result.current.save());

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
  it("keeps edits made while a save is still in flight", async () => {
    let finishSave: () => void = () => undefined;
    apiMock.saveGlobalGearSetup.mockReturnValue(
      new Promise((resolve) => {
        finishSave = () => resolve({ gearSetupId: "gear-1", globalSetup: null });
      }),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.setup.notes).toBe("guardado"));

    act(() => result.current.handleChange({ notes: "primero" }));
    act(() => result.current.save());
    // The user keeps typing while the request is pending; the server ends up with "primero".
    act(() => result.current.handleChange({ notes: "segundo" }));
    apiMock.fetchGearSetupState.mockResolvedValue(stateWith("primero"));

    await act(async () => {
      finishSave();
    });
    await waitFor(() => expect(apiMock.saveGlobalGearSetup).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Éxito" })));

    expect(apiMock.saveGlobalGearSetup).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "primero" }),
      "job-1",
      "gear-1",
    );
    expect(result.current.setup.notes).toBe("segundo");
  });

  it("ends on the saved values after saving and refetches once", async () => {
    apiMock.fetchGearSetupState.mockResolvedValueOnce(stateWith("antes"));
    const { result } = setup();
    await waitFor(() => expect(result.current.setup.notes).toBe("antes"));

    act(() => result.current.handleChange({ notes: "nuevo" }));
    apiMock.fetchGearSetupState.mockResolvedValue(stateWith("nuevo"));
    act(() => result.current.save());

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Éxito" })));
    await waitFor(() => expect(result.current.setup.notes).toBe("nuevo"));

    expect(apiMock.fetchGearSetupState).toHaveBeenCalledTimes(2);
  });
});
