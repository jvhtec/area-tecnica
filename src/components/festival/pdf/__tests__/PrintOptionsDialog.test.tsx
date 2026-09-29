// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  sendMissingRiders: vi.fn(),
  setRecipientEmails: vi.fn(),
}));

vi.mock("@/features/festival-print/hooks/usePrintOptionDownloads", () => ({
  usePrintOptionDownloads: () => ({
    download: mocks.download,
    sendMissingRiders: mocks.sendMissingRiders,
    isSending: false,
    recipientEmails: "",
    setRecipientEmails: mocks.setRecipientEmails,
  }),
}));

import { PrintOptionsDialog } from "../PrintOptionsDialog";

const renderDialog = (props: Partial<React.ComponentProps<typeof PrintOptionsDialog>> = {}) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PrintOptionsDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      maxStages={3}
      jobTitle="Sonorama"
      jobId="job-1"
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
};

describe("PrintOptionsDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers every document, all selected", () => {
    renderDialog();
    for (const label of [
      "Configuración de Equipamiento por Stage",
      "Horarios de Turnos de Personal",
      "Tablas de Programación de Artistas",
      "Requerimientos Individuales de Artistas",
      "Resumen de RF e IEM de Artistas",
      "Resumen de Necesidades de Infraestructura",
      "Requerimientos de Micrófonos Cableados",
      "Incluir Pronóstico del Tiempo",
      "Reporte de Riders Faltantes",
    ]) {
      expect(screen.getByLabelText(label)).toBeChecked();
    }
  });

  it("downloads one document on its own", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Descargar solo: Resumen de RF e IEM de Artistas" }));
    expect(mocks.download).toHaveBeenCalledWith("rfIemTable");
  });

  it("has no quick downloads (nor the email form) without a job", () => {
    renderDialog({ jobId: undefined });
    expect(screen.queryByRole("button", { name: /Descargar solo/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Enviar Reporte por Email")).not.toBeInTheDocument();
  });

  it("mails the missing-rider report", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Enviar Reporte por Email/ }));
    expect(mocks.sendMissingRiders).toHaveBeenCalled();
  });

  it("shows stage pickers only when there is more than one stage", () => {
    renderDialog({ maxStages: 1 });
    expect(screen.queryByText("Selecciona los escenarios:")).not.toBeInTheDocument();
  });

  it("turns a stage off for one document and names it in the proposed file", () => {
    renderDialog({ maxStages: 2 });
    // Keep only the gear setup so the file name is about it.
    for (const label of [
      "Horarios de Turnos de Personal",
      "Tablas de Programación de Artistas",
      "Requerimientos Individuales de Artistas",
      "Resumen de RF e IEM de Artistas",
      "Resumen de Necesidades de Infraestructura",
      "Requerimientos de Micrófonos Cableados",
      "Incluir Pronóstico del Tiempo",
      "Reporte de Riders Faltantes",
    ]) {
      fireEvent.click(screen.getByLabelText(label));
    }
    expect(screen.getByText(/Sonorama.*Dotación técnica/)).toBeInTheDocument();

    fireEvent.click(document.getElementById("gear-setup-stage-2") as HTMLElement);

    expect(screen.getByText(/Escenario 1.*Dotación técnica/)).toBeInTheDocument();
  });

  it("deselects and reselects every stage at once", () => {
    renderDialog({ maxStages: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Deseleccionar Todos los Stages" }));
    expect(document.getElementById("gear-setup-stage-1")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar Todos los Stages" }));
    expect(document.getElementById("gear-setup-stage-1")).toBeChecked();
    expect(document.getElementById("wired-mic-needs-stage-2")).toBeChecked();
  });

  it("hands the chosen options and file name to the caller, then closes", () => {
    const { onConfirm, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Generar/, hidden: false }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [options, filename] = onConfirm.mock.calls[0];
    expect(options.includeGearSetup).toBe(true);
    expect(options.generateIndividualStagePDFs).toBe(false);
    expect(filename).toContain("Documentación completa");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open while generating and shows the progress", () => {
    const { onOpenChange } = renderDialog({
      isGenerating: true,
      progress: { phase: "gear-setup", completed: 1, total: 4, label: "Generando dotacion tecnica" },
    });
    expect(screen.getByText("Generando dotacion tecnica")).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
