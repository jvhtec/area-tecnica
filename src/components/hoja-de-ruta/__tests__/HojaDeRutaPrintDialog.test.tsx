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

const sections: HojaDeRutaPrintSection[] = [
  { id: "event", label: "Evento", icon: Calendar },
  { id: "venue", label: "Lugar", icon: MapPin },
];

describe("HojaDeRutaPrintDialog", () => {
  it("renders section PDF actions and calls the selected section handler", async () => {
    const user = userEvent.setup();
    const onGenerateSectionPDF = vi.fn();

    render(
      <HojaDeRutaPrintDialog
        showDialog
        setShowDialog={vi.fn()}
        onGeneratePDF={vi.fn()}
        onGenerateDriverCertificatePDF={vi.fn()}
        onGenerateSectionPDF={onGenerateSectionPDF}
        onPreviewPDF={vi.fn()}
        onPreviewDriverCertificatePDF={vi.fn()}
        onPreviewSectionPDF={vi.fn()}
        onGenerateXLS={vi.fn()}
        sections={sections}
      />
    );

    expect(screen.getByText("Imprimir sección a PDF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documento Completo PDF" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Evento" }));

    expect(onGenerateSectionPDF).toHaveBeenCalledTimes(1);
    expect(onGenerateSectionPDF).toHaveBeenCalledWith("event");
  });

  it("calls preview handlers without using generate actions", async () => {
    const user = userEvent.setup();
    const onGeneratePDF = vi.fn();
    const onPreviewPDF = vi.fn();
    const onPreviewSectionPDF = vi.fn();

    render(
      <HojaDeRutaPrintDialog
        showDialog
        setShowDialog={vi.fn()}
        onGeneratePDF={onGeneratePDF}
        onGenerateDriverCertificatePDF={vi.fn()}
        onGenerateSectionPDF={vi.fn()}
        onPreviewPDF={onPreviewPDF}
        onPreviewDriverCertificatePDF={vi.fn()}
        onPreviewSectionPDF={onPreviewSectionPDF}
        onGenerateXLS={vi.fn()}
        sections={sections}
      />
    );

    await user.click(screen.getByRole("button", { name: "Vista previa documento completo PDF" }));
    await user.click(screen.getByRole("button", { name: "Vista previa Evento" }));

    expect(onPreviewPDF).toHaveBeenCalledTimes(1);
    expect(onPreviewSectionPDF).toHaveBeenCalledWith("event");
    expect(onGeneratePDF).not.toHaveBeenCalled();
  });
});
