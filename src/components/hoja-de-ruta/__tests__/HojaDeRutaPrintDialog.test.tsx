// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar, MapPin } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  HojaDeRutaPrintDialog,
  type HojaDeRutaPrintSection,
} from "../HojaDeRutaPrintDialog";

const sections: HojaDeRutaPrintSection[] = [
  { id: "event", label: "Evento", icon: Calendar },
  { id: "venue", label: "Venue", icon: MapPin },
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
});
