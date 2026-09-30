// @vitest-environment jsdom
import React, { createContext, useContext } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";

const api = vi.hoisted(() => ({
  createFestivalShift: vi.fn(),
  updateFestivalShift: vi.fn(),
  addShiftAssignments: vi.fn(),
  addShiftAssignment: vi.fn(),
  removeShiftAssignment: vi.fn(),
  updateShiftAssignmentRole: vi.fn(),
  fetchJobCrew: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: api.toast }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/features/festival-scheduling/api", () => ({
  createFestivalShift: api.createFestivalShift,
  updateFestivalShift: api.updateFestivalShift,
  addShiftAssignments: api.addShiftAssignments,
  addShiftAssignment: api.addShiftAssignment,
  removeShiftAssignment: api.removeShiftAssignment,
  updateShiftAssignmentRole: api.updateShiftAssignmentRole,
  fetchJobCrew: api.fetchJobCrew,
}));
vi.mock("../ShiftTimeCalculator", () => ({ ShiftTimeCalculator: (): null => null }));

// Button-based stand-in for the Radix Select, which jsdom cannot drive.
const SelectContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({});
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
  ),
  SelectTrigger: (): null => null,
  SelectValue: (): null => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" data-value={value} onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

import { ShiftSheet, type ShiftSheetTarget } from "../ShiftSheet";
import { shiftRoleOptions } from "../shiftModel";

const lightsRoles = shiftRoleOptions("lights");

const person = (id: string, first: string, last: string) => ({
  id,
  first_name: first,
  last_name: last,
  nickname: null,
  department: "lights",
  role: "technician",
});

const cruzAssignment = {
  id: "a-cruz",
  shift_id: "shift-1",
  technician_id: "cruz",
  external_technician_name: null,
  role: "LGT-BRD-E",
  profiles: person("cruz", "Cruz", "Cruzado"),
};

const baseShift: ShiftWithAssignments = {
  id: "shift-1",
  job_id: "job-1",
  date: "2031-07-10",
  name: "Luces tarde",
  start_time: "14:00",
  end_time: "22:00",
  department: "lights",
  stage: null,
  assignments: [],
};

const noop = vi.fn();

const renderSheet = (
  overrides: {
    target?: ShiftSheetTarget | null;
    shifts?: ShiftWithAssignments[];
    isViewOnly?: boolean;
    isShiftListUnsettled?: boolean;
    onClose?: () => void;
    onCreated?: (created: { id: string }) => Promise<void>;
    onSaved?: () => void;
    onDelete?: (id: string) => Promise<boolean>;
  } = {},
) => {
  const props = {
    target: { kind: "edit", shiftId: "shift-1" } as ShiftSheetTarget | null,
    shifts: [baseShift],
    isShiftListUnsettled: overrides.isShiftListUnsettled ?? false,
    onClose: noop,
    onCreated: vi.fn().mockResolvedValue(undefined),
    onSaved: noop,
    onDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  const ui = (next: typeof props) => (
    <ConfirmDialogProvider>
      <ShiftSheet
        target={next.target}
        onClose={next.onClose}
        jobId="job-1"
        date="2031-07-10"
        shifts={next.shifts}
        isShiftListUnsettled={next.isShiftListUnsettled}
        dayStartTime="07:00"
        isViewOnly={overrides.isViewOnly}
        onCreated={next.onCreated}
        onSaved={next.onSaved}
        onDelete={next.onDelete}
      />
    </ConfirmDialogProvider>
  );
  const view = renderWithProviders(ui(props));
  return { ...view, props, rerenderWith: (next: Partial<typeof props>) => view.rerender(ui({ ...props, ...next })) };
};

describe("ShiftSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createFestivalShift.mockResolvedValue({ id: "new-shift" });
    api.updateFestivalShift.mockResolvedValue(undefined);
    api.addShiftAssignments.mockResolvedValue(undefined);
    api.addShiftAssignment.mockResolvedValue(undefined);
    api.removeShiftAssignment.mockResolvedValue(undefined);
    api.updateShiftAssignmentRole.mockResolvedValue(undefined);
    api.fetchJobCrew.mockResolvedValue({
      jobAssignments: [
        { technician_id: "cruz", status: "confirmed", lights_role: "LGT-BRD-E" },
        { technician_id: "rita", status: "invited" },
        { technician_id: "sonia", status: "confirmed", sound_role: "SND-FOH-R" },
      ],
      directory: [person("cruz", "Cruz", "Cruzado"), person("rita", "Rita", "Rol"), { ...person("sonia", "Sonia", "Sonido"), department: "sound", role: "house_tech" }],
      externalNames: ["Pepe Externo"],
    });
  });

  describe("creating", () => {
    it("creates the shift, hands back its id and says the crew can be added next", async () => {
      const { props } = renderSheet({ target: { kind: "create" }, shifts: [] });

      expect(screen.getByText("Crea el turno para poder asignarle personal.")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Nombre del turno"), { target: { value: "  Montaje  " } });
      fireEvent.click(screen.getByRole("button", { name: "Crear turno" }));

      await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "new-shift" })));
      expect(api.createFestivalShift).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: "job-1", date: "2031-07-10", name: "Montaje", start_time: "09:00", end_time: "18:00" }),
      );
    });

    it("starts from the values it is given (a lane and hour picked on the board)", () => {
      renderSheet({ target: { kind: "create", prefill: { start_time: "20:00", end_time: "23:00", stage: "2" } }, shifts: [] });

      expect(screen.getByLabelText("Hora de inicio")).toHaveValue("20:00");
      expect(screen.getByLabelText("Hora de fin")).toHaveValue("23:00");
    });

    it("refuses a shift without a name and shows the failure of a rejected save", async () => {
      const { props } = renderSheet({ target: { kind: "create" }, shifts: [] });
      fireEvent.click(screen.getByRole("button", { name: "Crear turno" }));
      expect(await screen.findByText("El nombre del turno es obligatorio")).toBeInTheDocument();
      expect(api.createFestivalShift).not.toHaveBeenCalled();

      api.createFestivalShift.mockRejectedValue(new Error("denied"));
      fireEvent.change(screen.getByLabelText("Nombre del turno"), { target: { value: "Noche" } });
      fireEvent.click(screen.getByRole("button", { name: "Crear turno" }));
      await waitFor(() =>
        expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "denied", variant: "destructive" })),
      );
      expect(props.onCreated).not.toHaveBeenCalled();
    });
  });

  describe("editing", () => {
    it("saves only what changed, and only once something did", async () => {
      const { props } = renderSheet();
      const save = screen.getByRole("button", { name: "Guardar cambios" });
      expect(save).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Nombre del turno"), { target: { value: "Luces noche" } });
      await waitFor(() => expect(save).toBeEnabled());
      fireEvent.click(save);

      await waitFor(() => expect(api.updateFestivalShift).toHaveBeenCalledWith("shift-1", expect.objectContaining({ name: "Luces noche" })));
      await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    });

    it("follows the live shift without wiping what is being typed", async () => {
      const { rerenderWith } = renderSheet();
      fireEvent.change(screen.getByLabelText("Nombre del turno"), { target: { value: "Cambio a medias" } });

      rerenderWith({ shifts: [{ ...baseShift, assignments: [cruzAssignment] }] });

      expect(screen.getByText("Personal asignado (1)")).toBeInTheDocument();
      expect(screen.getByLabelText("Nombre del turno")).toHaveValue("Cambio a medias");
    });

    it("closes, saying why, when the shift was deleted while the sheet was open", async () => {
      const { props } = renderSheet({ shifts: [] });

      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
      expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Turno no disponible" }));
    });

    it("does not conclude the shift is gone while the day is loading, refreshing or failed to refresh", async () => {
      const { props, rerenderWith } = renderSheet({ shifts: [], isShiftListUnsettled: true });

      expect(screen.getByText("Cargando turno…")).toBeInTheDocument();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(api.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Turno no disponible" }));

      // Only once the list has settled and still lacks the shift is it really gone.
      rerenderWith({ isShiftListUnsettled: false });
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
      expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Turno no disponible" }));
    });

    it("asks before deleting the shift and closes after", async () => {
      const { props } = renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Eliminar turno" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(props.onDelete).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

      await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith("shift-1"));
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    });
  });

  describe("deleting", () => {
    it("stays open when the delete failed, so it can be retried", async () => {
      const { props } = renderSheet({ onDelete: vi.fn().mockResolvedValue(false) });

      fireEvent.click(screen.getByRole("button", { name: "Eliminar turno" }));
      fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));

      await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith("shift-1"));
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Eliminar turno" })).toBeInTheDocument();
    });
  });

  describe("crew", () => {
    it("adds several people in one go: each keeps their job role, the rest get the chosen one", async () => {
      renderSheet();

      const department = (await screen.findByText("Luces en este trabajo")).closest('[role="group"]') as HTMLElement;
      expect(within(department).getByText(/Cruz Cruzado/)).toBeInTheDocument();
      expect(within(department).getByText(/Rita Rol/)).toBeInTheDocument();
      expect(within(department).queryByText(/Sonia Sonido/)).not.toBeInTheDocument();
      expect(screen.getByText(/Sonia Sonido · Plantilla/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("checkbox", { name: /Cruz Cruzado/ }));
      fireEvent.click(screen.getByRole("checkbox", { name: /Rita Rol/ }));
      fireEvent.click(screen.getByRole("button", { name: lightsRoles[1].label }));
      fireEvent.click(screen.getByRole("button", { name: "Añadir al turno (2)" }));

      await waitFor(() => expect(api.addShiftAssignments).toHaveBeenCalledTimes(1));
      expect(api.addShiftAssignments).toHaveBeenCalledWith([
        { shift_id: "shift-1", technician_id: "cruz", role: "LGT-BRD-E" },
        { shift_id: "shift-1", technician_id: "rita", role: lightsRoles[1].code },
      ]);
    });

    it("finds people by name, ignoring accents", async () => {
      renderSheet();
      await screen.findByText(/Cruz Cruzado/);

      fireEvent.change(screen.getByLabelText("Buscar en el equipo"), { target: { value: "RÓL" } });

      expect(screen.getByText(/Rita Rol/)).toBeInTheDocument();
      expect(screen.queryByText(/Cruz Cruzado/)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Buscar en el equipo"), { target: { value: "nadie" } });
      expect(screen.getByText("Nadie coincide con la búsqueda.")).toBeInTheDocument();
    });

    it("adds externals by typing or from earlier names, together with internal crew", async () => {
      renderSheet();
      await screen.findByText(/Cruz Cruzado/);

      fireEvent.click(screen.getByRole("button", { name: "Pepe Externo" }));
      fireEvent.change(screen.getByLabelText("Técnico externo"), { target: { value: "Luz Nueva" } });
      fireEvent.keyDown(screen.getByLabelText("Técnico externo"), { key: "Enter" });
      fireEvent.click(screen.getByRole("checkbox", { name: /Cruz Cruzado/ }));
      fireEvent.click(screen.getByRole("button", { name: "Añadir al turno (3)" }));

      await waitFor(() => expect(api.addShiftAssignments).toHaveBeenCalledTimes(1));
      expect(api.addShiftAssignments.mock.calls[0][0]).toEqual([
        { shift_id: "shift-1", technician_id: "cruz", role: "LGT-BRD-E" },
        { shift_id: "shift-1", external_technician_name: "Pepe Externo", role: lightsRoles[0].code },
        { shift_id: "shift-1", external_technician_name: "Luz Nueva", role: lightsRoles[0].code },
      ]);
    });

    it("does not offer people who are already on the shift", async () => {
      renderSheet({ shifts: [{ ...baseShift, assignments: [cruzAssignment] }] });
      await screen.findByText(/Rita Rol/);

      expect(screen.queryByRole("checkbox", { name: /Cruz Cruzado/ })).not.toBeInTheDocument();
      expect(screen.getByText("Personal asignado (1)")).toBeInTheDocument();
    });

    it("changes a role in place", async () => {
      renderSheet({ shifts: [{ ...baseShift, assignments: [cruzAssignment] }] });

      const row = screen.getByText("Cruz Cruzado").closest("li") as HTMLElement;
      fireEvent.click(within(row).getByRole("button", { name: lightsRoles[2].label }));

      await waitFor(() => expect(api.updateShiftAssignmentRole).toHaveBeenCalledWith("a-cruz", lightsRoles[2].code));
    });

    it("removes a person and offers to undo it", async () => {
      renderSheet({ shifts: [{ ...baseShift, assignments: [cruzAssignment] }] });

      fireEvent.click(screen.getByRole("button", { name: "Quitar a Cruz Cruzado del turno" }));
      await waitFor(() => expect(api.removeShiftAssignment).toHaveBeenCalledWith("a-cruz"));

      await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Personal retirado" })));
      const undo = api.toast.mock.calls.map((call) => call[0]).find((arg) => arg.title === "Personal retirado").action;
      undo.props.onClick();

      await waitFor(() =>
        expect(api.addShiftAssignment).toHaveBeenCalledWith({
          shift_id: "shift-1",
          role: "LGT-BRD-E",
          technician_id: "cruz",
          external_technician_name: null,
        }),
      );
    });

    it("reports a person who is already on the shift instead of failing silently", async () => {
      api.addShiftAssignments.mockRejectedValue({ code: "23505" });
      renderSheet();

      fireEvent.click(await screen.findByRole("checkbox", { name: /Cruz Cruzado/ }));
      fireEvent.click(screen.getByRole("button", { name: "Añadir al turno (1)" }));

      await waitFor(() =>
        expect(api.toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: "Este técnico ya está asignado al turno.", variant: "destructive" }),
        ),
      );
    });

    it("does not carry the role picked for one department over to another", async () => {
      const { rerenderWith } = renderSheet();
      await screen.findByRole("checkbox", { name: /Rita Rol/ });
      fireEvent.click(screen.getByRole("button", { name: lightsRoles[2].label }));

      // The shift is moved to sound (saved by a colleague, say) while the sheet is open.
      rerenderWith({ shifts: [{ ...baseShift, department: "sound" }] });
      fireEvent.click(await screen.findByRole("checkbox", { name: /Rita Rol/ }));
      fireEvent.click(screen.getByRole("button", { name: "Añadir al turno (1)" }));

      await waitFor(() => expect(api.addShiftAssignments).toHaveBeenCalledTimes(1));
      const [row] = api.addShiftAssignments.mock.calls[0][0];
      expect(row.role).toBe(shiftRoleOptions("sound")[0].code);
      expect(row.role).not.toBe(lightsRoles[2].code);
    });

    it("lets a free-text role be corrected in place, and never saves an empty one", async () => {
      renderSheet({
        shifts: [
          {
            ...baseShift,
            department: "logistics",
            assignments: [{ ...cruzAssignment, role: "runner" }],
          },
        ],
      });

      const field = screen.getByRole("textbox", { name: "Función de Cruz Cruzado" });
      expect(field).toHaveValue("runner");

      fireEvent.change(field, { target: { value: "  carga y descarga " } });
      fireEvent.blur(field);
      await waitFor(() => expect(api.updateShiftAssignmentRole).toHaveBeenCalledWith("a-cruz", "carga y descarga"));

      api.updateShiftAssignmentRole.mockClear();
      fireEvent.change(field, { target: { value: "   " } });
      fireEvent.blur(field);
      expect(api.updateShiftAssignmentRole).not.toHaveBeenCalled();
      expect(field).toHaveValue("runner");
    });

    it("lets logistics shifts take a free-text role", async () => {
      renderSheet({ shifts: [{ ...baseShift, department: "logistics" }] });
      await screen.findByText(/Cruz Cruzado/);

      expect(screen.getByPlaceholderText("Carga y descarga, runner, …")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("checkbox", { name: /Cruz Cruzado/ }));
      expect(screen.getByRole("button", { name: "Añadir al turno (1)" })).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("Carga y descarga, runner, …"), { target: { value: "runner" } });
      fireEvent.click(screen.getByRole("button", { name: "Añadir al turno (1)" }));
      await waitFor(() =>
        expect(api.addShiftAssignments).toHaveBeenCalledWith([{ shift_id: "shift-1", technician_id: "cruz", role: "runner" }]),
      );
    });
  });

  describe("read only", () => {
    it("shows the times and crew without a form or a picker", async () => {
      renderSheet({ isViewOnly: true, shifts: [{ ...baseShift, assignments: [cruzAssignment] }] });

      expect(screen.getByText("14:00 – 22:00")).toBeInTheDocument();
      expect(screen.getByText("Cruz Cruzado")).toBeInTheDocument();
      expect(screen.queryByRole("form", { name: "Datos del turno" })).not.toBeInTheDocument();
      expect(screen.queryByText("Añadir personal")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Quitar a/ })).not.toBeInTheDocument();
      expect(api.fetchJobCrew).not.toHaveBeenCalled();
    });
  });
});
