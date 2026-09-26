// @vitest-environment jsdom
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { useHojaLeaveGuard } from "@/features/hoja-de-ruta/model/useHojaLeaveGuard";

function Harness({ isDirty, onResult }: { isDirty: boolean; onResult: (value: boolean) => void }) {
  const confirmLeave = useHojaLeaveGuard(isDirty);
  return (
    <button
      type="button"
      onClick={async () => {
        const result = await confirmLeave();
        onResult(result);
      }}
    >
      Intentar salir
    </button>
  );
}

describe("useHojaLeaveGuard", () => {
  it("resolves true immediately when there are no unsaved changes", async () => {
    const results: boolean[] = [];
    render(
      <ConfirmDialogProvider>
        <Harness isDirty={false} onResult={(v) => results.push(v)} />
      </ConfirmDialogProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "Intentar salir" }).click();
    });

    expect(results).toEqual([true]);
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });

  it("prompts and resolves false when the user keeps editing", async () => {
    const results: boolean[] = [];
    render(
      <ConfirmDialogProvider>
        <Harness isDirty onResult={(v) => results.push(v)} />
      </ConfirmDialogProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Intentar salir" }).click();
    });

    const keepEditingBtn = await screen.findByRole("button", { name: "Seguir editando" });
    await act(async () => {
      keepEditingBtn.click();
    });

    expect(results).toEqual([false]);
  });

  it("prompts and resolves true when the user discards changes", async () => {
    const results: boolean[] = [];
    render(
      <ConfirmDialogProvider>
        <Harness isDirty onResult={(v) => results.push(v)} />
      </ConfirmDialogProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Intentar salir" }).click();
    });

    const discardBtn = await screen.findByRole("button", { name: "Descartar cambios" });
    await act(async () => {
      discardBtn.click();
    });

    expect(results).toEqual([true]);
  });
});
