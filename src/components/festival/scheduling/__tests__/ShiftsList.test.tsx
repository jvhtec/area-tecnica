// @vitest-environment jsdom
import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: {} }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { ShiftsList } from "../ShiftsList";

const shift = (id: string, name: string, start_time: string, end_time: string): ShiftWithAssignments => ({
  id,
  job_id: "job-1",
  date: "2031-07-10",
  name,
  start_time,
  end_time,
  stage: 2,
  department: "sound",
  assignments: [
    {
      id: `${id}-a`,
      shift_id: id,
      role: "SND-FOH-R",
      technician_id: "t-1",
      profiles: { id: "t-1", first_name: "Sonia", last_name: "Sonido", department: "sound", role: "technician" },
    },
  ],
});

const renderList = (onDeleteShift = vi.fn(), onOpenShift = vi.fn()) =>
  renderWithProviders(
    <ConfirmDialogProvider>
      <ShiftsList
        dayStartTime="07:00"
        shifts={[shift("night", "Noche", "22:00", "06:00"), shift("morning", "Mañana", "09:00", "15:00")]}
        onDeleteShift={onDeleteShift}
        onOpenShift={onOpenShift}
        jobId="job-1"
        jobDates={[new Date("2031-07-10"), new Date("2031-07-11")]}
        selectedDate="2031-07-10"
        onShiftsCopied={() => {}}
        stageOptions={[
          { number: 1, name: "Principal" },
          { number: 2, name: "Carpa" },
        ]}
      />
    </ConfirmDialogProvider>,
  );

describe("ShiftsList", () => {
  it("orders along the festival day and shows stage name, duration, overnight and crew", () => {
    renderList();

    const titles = screen.getAllByText(/^(Mañana|Noche)$/).map((node) => node.textContent);
    expect(titles).toEqual(["Mañana", "Noche"]);
    expect(screen.getAllByText("Carpa · Sonido")).toHaveLength(2);
    expect(screen.getByText("+1 día")).toBeInTheDocument();
    expect(screen.getByText("8 h")).toBeInTheDocument();
    expect(screen.getAllByText(/Sonia Sonido \(FOH — Responsable\)/)).toHaveLength(2);
  });

  it("opens the shift sheet (details and crew together) from one button", () => {
    const onOpenShift = vi.fn();
    renderList(vi.fn(), onOpenShift);

    fireEvent.click(screen.getAllByRole("button", { name: "Editar y personal" })[0]);
    expect(onOpenShift).toHaveBeenCalledWith("morning");
    expect(screen.queryByRole("button", { name: "Gestionar personal" })).not.toBeInTheDocument();
  });

  it("asks for confirmation before deleting a shift", async () => {
    const onDeleteShift = vi.fn();
    renderList(onDeleteShift);

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    expect(await screen.findByText("Eliminar turno")).toBeInTheDocument();
    expect(onDeleteShift).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(onDeleteShift).toHaveBeenCalledWith("morning"));
  });
});
