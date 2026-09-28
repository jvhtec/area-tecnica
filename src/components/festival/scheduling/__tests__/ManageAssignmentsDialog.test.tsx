// @vitest-environment jsdom
import React, { createContext, useContext } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";

const { insertMock, rpcMock, tableRows } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  rpcMock: vi.fn(),
  tableRows: {} as Record<string, unknown[]>,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock("@/services/dataLayerClient", () => {
  const builder = (table: string) => {
    const result = { data: tableRows[table] ?? [], error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return {
      ...chain,
      insert: (rows: unknown) => {
        insertMock(table, rows);
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
  };
  return {
    dataLayerClient: {
      from: builder,
      rpc: (...args: unknown[]) => {
        rpcMock(...args);
        return Promise.resolve({ data: tableRows.directory ?? [], error: null });
      },
    },
  };
});

// Button-based stand-in for the Radix Select, which jsdom cannot drive:
// each option is a button that sets the value.
const SelectContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({});
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
  ),
  SelectTrigger: (): null => null,
  SelectValue: (): null => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-options">{children}</div>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div role="group">{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" data-value={value} onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

import { ManageAssignmentsDialog } from "../ManageAssignmentsDialog";

const baseShift: ShiftWithAssignments = {
  id: "shift-1",
  job_id: "job-1",
  date: "2031-07-10",
  start_time: "14:00",
  end_time: "22:00",
  name: "Luces tarde",
  department: "lights",
  assignments: [],
};

describe("ManageAssignmentsDialog", () => {
  beforeEach(() => {
    insertMock.mockReset();
    rpcMock.mockReset();
    tableRows.job_assignments = [
      { technician_id: "cruz", status: "confirmed", lights_role: "LGT-BRD-E" },
      { technician_id: "rita", status: "invited" },
      { technician_id: "sonia", status: "confirmed", sound_role: "SND-FOH-R" },
    ];
    tableRows.festival_shift_assignments = [
      { technician_id: null, external_technician_name: "Pepe Externo" },
    ];
    tableRows.directory = [
      { id: "cruz", first_name: "Cruz", last_name: "Cruzado", department: "sound", role: "technician" },
      { id: "rita", first_name: "Rita", last_name: "Rol", department: "lights", role: "technician" },
      { id: "sonia", first_name: "Sonia", last_name: "Sonido", department: "sound", role: "house_tech" },
    ];
  });

  const renderDialog = (shift: ShiftWithAssignments = baseShift) =>
    renderWithProviders(
      <ManageAssignmentsDialog open onOpenChange={() => {}} shift={shift} onAssignmentsUpdated={() => {}} />,
    );

  it("lists crew by the role they hold on this job, reading names from the safe directory", async () => {
    renderDialog();

    const departmentGroup = await screen.findByText("Luces en este trabajo");
    const group = departmentGroup.closest('[role="group"]') as HTMLElement;
    expect(within(group).getByText(/Cruz Cruzado/)).toBeInTheDocument();
    expect(within(group).getByText(/Rita Rol/)).toBeInTheDocument();
    expect(within(group).queryByText(/Sonia Sonido/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sonia Sonido · Plantilla/)).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("get_profile_directory", { p_profile_ids: ["cruz", "rita", "sonia"] });
  });

  it("keeps the chosen role so several people can be added in a row", async () => {
    renderDialog();

    fireEvent.click(await screen.findByText(/Cruz Cruzado/));
    const assign = screen.getByRole("button", { name: "Asignar al turno" });
    await waitFor(() => expect(assign).toBeEnabled());
    fireEvent.click(assign);
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock.mock.calls[0][1]).toEqual([{ shift_id: "shift-1", role: "LGT-BRD-E", technician_id: "cruz" }]);

    // Rita has no role on the job: the role picked for Cruz carries over.
    fireEvent.click(screen.getByText(/Rita Rol/));
    await waitFor(() => expect(screen.getByRole("button", { name: "Asignar al turno" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Asignar al turno" }));
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(2));
    expect(insertMock.mock.calls[1][1]).toEqual([{ shift_id: "shift-1", role: "LGT-BRD-E", technician_id: "rita" }]);
  });

  it("shows the live crew list and drops assigned people from the candidates", async () => {
    const { rerender } = renderDialog();
    await screen.findByText(/Cruz Cruzado/);

    rerender(
      <ManageAssignmentsDialog
        open
        onOpenChange={() => {}}
        onAssignmentsUpdated={() => {}}
        shift={{
          ...baseShift,
          assignments: [
            {
              id: "a-1",
              shift_id: "shift-1",
              technician_id: "cruz",
              role: "LGT-BRD-E",
              profiles: { id: "cruz", first_name: "Cruz", last_name: "Cruzado", department: "sound", role: "technician" },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Personal asignado (1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cruz Cruzado/ })).not.toBeInTheDocument();
  });

  it("lets logistics shifts take a free-text role and suggests earlier external names", async () => {
    renderDialog({ ...baseShift, department: "logistics" });
    await screen.findByText(/Cruz Cruzado/);

    expect(screen.getByPlaceholderText("Carga y descarga, runner, …")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Técnico externo"));
    const datalist = document.getElementById("festival-external-crew");
    expect(datalist?.querySelector('option[value="Pepe Externo"]')).not.toBeNull();
  });
});
