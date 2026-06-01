import { describe, expect, it } from "vitest";

import {
  getHojaDeRutaPdfSectionFilenameLabel,
  getHojaDeRutaPdfSectionLabel,
  getHojaDeRutaPdfSelectionLabel,
  HOJA_DE_RUTA_PDF_SECTIONS,
  isHojaDeRutaPdfSectionId,
} from "../section-options";

describe("hoja de ruta PDF section options", () => {
  it("matches the quick navigation sections", () => {
    expect(HOJA_DE_RUTA_PDF_SECTIONS.map((section) => section.id)).toEqual([
      "event",
      "venue",
      "weather",
      "contacts",
      "staff",
      "travel",
      "accommodation",
      "logistics",
      "schedule",
      "restaurants",
    ]);
  });

  it("labels single and multi-section exports", () => {
    expect(getHojaDeRutaPdfSectionLabel("logistics")).toBe("Logística");
    expect(getHojaDeRutaPdfSectionFilenameLabel("logistics")).toBe("Logistica");
    expect(getHojaDeRutaPdfSelectionLabel(["contacts"])).toBe("Contactos");
    expect(getHojaDeRutaPdfSelectionLabel(["contacts", "staff"])).toBe("Secciones seleccionadas");
    expect(getHojaDeRutaPdfSelectionLabel()).toBeUndefined();
  });

  it("guards section ids", () => {
    expect(isHojaDeRutaPdfSectionId("event")).toBe(true);
    expect(isHojaDeRutaPdfSectionId("not-a-section")).toBe(false);
  });
});
