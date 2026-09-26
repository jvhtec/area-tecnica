// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar, MapPin } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  HojaDeRutaPrintDialog,
  type HojaDeRutaPrintSection,
} from "@/components/hoja-de-ruta/HojaDeRutaPrintDialog";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

const sections: HojaDeRutaPrintSection[] = [
  { id: "event", label: "Evento", icon: Calendar },
  { id: "venue", label: "Lugar", icon: MapPin },
];

const renderDialog = (overrides: Partial<React.ComponentProps<typeof HojaDeRutaPrintDialog>> = {}) => render(
  <ConfirmDialogProvider>
    <HojaDeRutaPrintDialog
      showDialog
      setShowDialog={vi.fn()}
      onGeneratePDF={vi.fn()}
      onPublishPDF={vi.fn()}
      canPublish
      onGenerateDriverCertificatePDF={vi.fn()}
      onGenerateSectionPDF={vi.fn()}
      onPreviewPDF={vi.fn()}
      onPreviewDriverCertificatePDF={vi.fn()}
      onPreviewSectionPDF={vi.fn()}
      onGenerateXLS={vi.fn()}
      onGenerateAccreditationXLS={vi.fn()}
      sections={sections}
      {...overrides}
    />
  </ConfirmDialogProvider>,
);

describe("HojaDeRutaPrintDialog", () => {
  it("renders section PDF actions and calls the selected section handler", async () => {
    const user = userEvent.setup();
    const onGenerateSectionPDF = vi.fn();

    renderDialog({ onGenerateSectionPDF });

    expect(screen.getByText("Imprimir sección a PDF")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descargar documento completo PDF" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Evento" }));

    expect(onGenerateSectionPDF).toHaveBeenCalledTimes(1);
    expect(onGenerateSectionPDF).toHaveBeenCalledWith("event");
  });

  it("calls preview handlers without using generate actions", async () => {
    const user = userEvent.setup();
    const onGeneratePDF = vi.fn();
    const onPreviewPDF = vi.fn();
    const onPreviewSectionPDF = vi.fn();

    renderDialog({ onGeneratePDF, onPreviewPDF, onPreviewSectionPDF });

    await user.click(screen.getByRole("button", { name: "Vista previa documento completo PDF" }));
    await user.click(screen.getByRole("button", { name: "Vista previa Evento" }));

    expect(onPreviewPDF).toHaveBeenCalledTimes(1);
    expect(onPreviewSectionPDF).toHaveBeenCalledWith("event");
    expect(onGeneratePDF).not.toHaveBeenCalled();
  });

  it("requires confirmation before exporting accreditation data", async () => {
    const user = userEvent.setup();
    const onGenerateAccreditationXLS = vi.fn();
    renderDialog({ onGenerateAccreditationXLS });

    await user.click(screen.getByRole("button", { name: "Exportar acreditaciones (XLS)" }));
    expect(onGenerateAccreditationXLS).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Exportar" }));
    expect(onGenerateAccreditationXLS).toHaveBeenCalledTimes(1);
  });
});
