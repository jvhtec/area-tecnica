import { describe, expect, it } from "vitest";

import { sanitizeHojaPdfFileName } from "@/utils/hoja-de-ruta/pdf-upload";

describe("sanitizeHojaPdfFileName", () => {
  it("removes diacritics from generated Hoja filenames while preserving readable spaces", () => {
    expect(sanitizeHojaPdfFileName(
      "Hoja de Ruta - Fiestas Populares Torrejón - 2026-06-16 12-30-00.pdf"
    )).toBe("Hoja de Ruta - Fiestas Populares Torrejon - 2026-06-16 12-30-00.pdf");
  });

  it("removes path separators and illegal storage filename characters", () => {
    expect(sanitizeHojaPdfFileName("Hoja_de_Ruta: Tour/Leg?.pdf"))
      .toBe("Hoja de Ruta Tour Leg.pdf");
  });
});
