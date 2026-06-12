import { describe, expect, it } from "vitest";

import {
  getHojaDeRutaPdfSectionFilenameLabel,
  getHojaDeRutaPdfSectionLabel,
  getHojaDeRutaPdfSelectionLabel,
  HOJA_DE_RUTA_PDF_SECTIONS,
  isHojaDeRutaPdfSectionId,
  normalizeHojaDeRutaPdfSections,
  normalizeHojaDeRutaPrintSections,
} from "@/utils/hoja-de-ruta/pdf/section-options";

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
    expect(getHojaDeRutaPdfSectionLabel("venue")).toBe("Lugar");
    expect(getHojaDeRutaPdfSectionFilenameLabel("venue")).toBe("Lugar");
    expect(getHojaDeRutaPdfSelectionLabel(["contacts"])).toBe("Contactos");
    expect(getHojaDeRutaPdfSelectionLabel(["contacts", "staff"])).toBe("Secciones seleccionadas");
    expect(getHojaDeRutaPdfSelectionLabel()).toBeUndefined();
  });

  it("guards section ids", () => {
    expect(isHojaDeRutaPdfSectionId("event")).toBe(true);
    expect(isHojaDeRutaPdfSectionId("not-a-section")).toBe(false);
  });

  it("normalizes persisted section lists", () => {
    expect(normalizeHojaDeRutaPdfSections(["event", "venue", "event", "bad", 1])).toEqual([
      "event",
      "venue",
    ]);
    expect(normalizeHojaDeRutaPdfSections("event")).toEqual([]);
  });

  it("normalizes persisted print subsection lists", () => {
    expect(normalizeHojaDeRutaPrintSections(["power", "program", "power", "bad", 1])).toEqual([
      "power",
      "program",
    ]);
    expect(normalizeHojaDeRutaPrintSections(["schedule"])).toEqual([
      "program",
      "schedule-notes",
      "power",
    ]);
    expect(normalizeHojaDeRutaPrintSections("power")).toEqual([]);
  });
});
