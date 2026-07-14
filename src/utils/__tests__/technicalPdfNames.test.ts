import { describe, expect, it } from "vitest";

import {
  LIGHTS_CONSUMOS_CONFIG,
  SOUND_CONSUMOS_CONFIG,
  VIDEO_CONSUMOS_CONFIG,
} from "@/features/technical-tools/power/consumos/departmentConfigs";
import {
  getJobTechnicalPdfFileName,
  getTourDateTechnicalPdfFileName,
  getTourDefaultsPdfFileName,
} from "@/utils/technicalPdfNames";

describe("technical PDF filenames", () => {
  it("uses the same job-first pattern for each calculator department", () => {
    expect(
      getJobTechnicalPdfFileName("sound", "FEID Madrid", "power")
    ).toBe("FEID Madrid - Sonido potencia.pdf");
    expect(
      getJobTechnicalPdfFileName("lights", "FEID Madrid", "power")
    ).toBe("FEID Madrid - Iluminación potencia.pdf");
    expect(
      getJobTechnicalPdfFileName("video", "FEID Madrid", "weight")
    ).toBe("FEID Madrid - Video peso.pdf");
  });

  it("is used by every power calculator configuration", () => {
    expect(SOUND_CONSUMOS_CONFIG.pdfFileName("FEID Madrid")).toBe(
      "FEID Madrid - Sonido potencia.pdf"
    );
    expect(LIGHTS_CONSUMOS_CONFIG.pdfFileName("FEID Madrid")).toBe(
      "FEID Madrid - Iluminación potencia.pdf"
    );
    expect(VIDEO_CONSUMOS_CONFIG.pdfFileName("FEID Madrid")).toBe(
      "FEID Madrid - Video potencia.pdf"
    );
    expect(SOUND_CONSUMOS_CONFIG.defaultsPdfFileName("FEID Tour L")).toBe(
      "FEID Tour L - Sonido potencia predeterminados.pdf"
    );
  });

  it("uses one filename for direct, bulk, and synchronized tour-date generation", () => {
    expect(
      getTourDateTechnicalPdfFileName(
        "FEID Tour L",
        "2026-07-14",
        "WiZink/Center",
        "sound",
        "power",
        "Sonido L - Large",
      )
    ).toBe(
      "FEID Tour L - 2026-07-14 - WiZink Center - Sonido L - Large potencia.pdf"
    );
  });

  it("keeps defaults clearly distinct from generated date documents", () => {
    expect(
      getTourDefaultsPdfFileName("FEID Tour L", "sound", "power", "Sonido L - Large")
    ).toBe("FEID Tour L - Sonido L - Large potencia predeterminados.pdf");
  });
});
