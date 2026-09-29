// @vitest-environment jsdom
import React, { createContext, useContext } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

const { copyFestivalShiftsMock, toastErrorMock, toastSuccessMock } = vi.hoisted(
  () => ({
    copyFestivalShiftsMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  }),
);

vi.mock("@/features/festival-scheduling/api", () => ({
  copyFestivalShifts: copyFestivalShiftsMock,
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: toastSuccessMock },
}));

const SelectContext = createContext<{
  onValueChange?: (value: string) => void;
}>({});
vi.mock("@/components/ui/select", () => ({
  Select: ({
    onValueChange,
    children,
  }: {
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <SelectContext.Provider value={{ onValueChange }}>
      {children}
    </SelectContext.Provider>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

import { CopyShiftsDialog } from "../CopyShiftsDialog";

const renderDialog = (onShiftsCopied = vi.fn()) => {
  renderWithProviders(
    <CopyShiftsDialog
      open
      onOpenChange={vi.fn()}
      sourceDate="2031-07-10"
      jobDates={[
        new Date("2031-07-10T12:00:00+02:00"),
        new Date("2031-07-11T12:00:00+02:00"),
      ]}
      jobId="job-1"
      onShiftsCopied={onShiftsCopied}
    />,
  );
  return onShiftsCopied;
};

describe("CopyShiftsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyFestivalShiftsMock.mockResolvedValue({
      copiedAssignments: 5,
      copiedShifts: 2,
    });
  });

  it("copies the whole day through one transactional RPC command", async () => {
    const onShiftsCopied = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /11 jul 2031/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Copiar Turnos y Asignaciones" }),
    );

    await waitFor(() => {
      expect(copyFestivalShiftsMock).toHaveBeenCalledTimes(1);
      expect(copyFestivalShiftsMock).toHaveBeenCalledWith({
        jobId: "job-1",
        sourceDate: "2031-07-10",
        targetDate: "2031-07-11",
      });
      expect(onShiftsCopied).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      expect.stringContaining("2 turnos y 5 asignaciones"),
    );
  });

  it("explains the empty-target conflict and does not report success", async () => {
    copyFestivalShiftsMock.mockRejectedValue({
      code: "23505",
      message: "festival_shift_copy_target_not_empty",
    });
    const onShiftsCopied = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /11 jul 2031/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Copiar Turnos y Asignaciones" }),
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Error al copiar turnos: La fecha destino ya tiene turnos. No se ha copiado nada.",
      );
    });
    expect(onShiftsCopied).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("explains when the source day has no shifts", async () => {
    copyFestivalShiftsMock.mockRejectedValue({
      code: "P0002",
      message: "festival_shift_copy_source_empty",
    });
    const onShiftsCopied = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /11 jul 2031/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Copiar Turnos y Asignaciones" }),
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Error al copiar turnos: No se encontraron turnos en la fecha de origen.",
      );
    });
    expect(onShiftsCopied).not.toHaveBeenCalled();
  });
});
