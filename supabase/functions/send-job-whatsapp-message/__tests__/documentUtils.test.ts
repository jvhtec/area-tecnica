import { describe, expect, it } from "vitest";

import {
  DEPT_PREFIXES,
  hasHojaDeRutaText,
  isJobHojaDeRutaDocument,
  isPdfDocument,
  isTourHojaDeRutaDocument,
  normalizeObjectPath,
  normalizeText,
  resolveJobDocumentBucket,
  toHojaAttachment,
} from "../documentUtils.ts";

// ── normalizeObjectPath ───────────────────────────────────────────────────────

describe("normalizeObjectPath", () => {
  it("returns empty string for null", () => {
    expect(normalizeObjectPath(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeObjectPath(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeObjectPath("")).toBe("");
  });

  it("strips a single leading slash", () => {
    expect(normalizeObjectPath("/hojas-de-ruta/job-1/file.pdf")).toBe("hojas-de-ruta/job-1/file.pdf");
  });

  it("strips multiple leading slashes", () => {
    expect(normalizeObjectPath("///hojas-de-ruta/job-1/file.pdf")).toBe("hojas-de-ruta/job-1/file.pdf");
  });

  it("leaves paths without leading slashes unchanged", () => {
    expect(normalizeObjectPath("hojas-de-ruta/job-1/file.pdf")).toBe("hojas-de-ruta/job-1/file.pdf");
  });
});

// ── normalizeText ─────────────────────────────────────────────────────────────

describe("normalizeText", () => {
  it("lowercases input", () => {
    expect(normalizeText("HOJA DE RUTA")).toBe("hoja de ruta");
  });

  it("strips diacritical marks", () => {
    // ú → u, é → e, á → a
    expect(normalizeText("Hoja de Rúta")).toBe("hoja de ruta");
    expect(normalizeText("Producción")).toBe("produccion");
  });

  it("preserves ASCII characters unchanged", () => {
    expect(normalizeText("abc 123")).toBe("abc 123");
  });
});

// ── hasHojaDeRutaText ─────────────────────────────────────────────────────────

describe("hasHojaDeRutaText", () => {
  it("matches when both file_name and file_path contain hoja + ruta", () => {
    expect(hasHojaDeRutaText({ file_name: "Hoja de Ruta.pdf", file_path: "job-1/Hoja de Ruta.pdf" })).toBe(true);
  });

  it("matches when only file_name contains hoja + ruta", () => {
    expect(hasHojaDeRutaText({ file_name: "Hoja de Ruta.pdf", file_path: null })).toBe(true);
  });

  it("matches english 'route' keyword", () => {
    expect(hasHojaDeRutaText({ file_name: "Hoja de Route.pdf", file_path: null })).toBe(true);
  });

  it("returns false when only 'hoja' is present without 'ruta' or 'route'", () => {
    expect(hasHojaDeRutaText({ file_name: "Hoja de Gastos.pdf", file_path: null })).toBe(false);
  });

  it("returns false when only 'ruta' is present without 'hoja'", () => {
    expect(hasHojaDeRutaText({ file_name: "ruta_config.pdf", file_path: null })).toBe(false);
  });

  it("matches after normalizing accented characters", () => {
    expect(hasHojaDeRutaText({ file_name: "Hoja de Rúta.pdf", file_path: null })).toBe(true);
  });

  it("returns false when both file_name and file_path are null", () => {
    expect(hasHojaDeRutaText({ file_name: null, file_path: null })).toBe(false);
  });
});

// ── isPdfDocument ─────────────────────────────────────────────────────────────

describe("isPdfDocument", () => {
  it("detects PDF by .pdf extension in file_name", () => {
    expect(isPdfDocument({ file_name: "Report.pdf", file_path: null })).toBe(true);
  });

  it("detects PDF by .pdf extension in file_path", () => {
    expect(isPdfDocument({ file_name: null, file_path: "docs/Report.pdf" })).toBe(true);
  });

  it("detects PDF by file_type application/pdf", () => {
    expect(isPdfDocument({ file_name: "Report", file_path: null, file_type: "application/pdf" })).toBe(true);
  });

  it("returns false for Word documents", () => {
    expect(isPdfDocument({
      file_name: "Report.docx",
      file_path: null,
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })).toBe(false);
  });

  it("returns false when all fields are null", () => {
    expect(isPdfDocument({ file_name: null, file_path: null })).toBe(false);
  });

  it("is case-insensitive (uppercase .PDF)", () => {
    expect(isPdfDocument({ file_name: "REPORT.PDF", file_path: null })).toBe(true);
  });
});

// ── resolveJobDocumentBucket ──────────────────────────────────────────────────

describe("resolveJobDocumentBucket", () => {
  it.each([...DEPT_PREFIXES])("maps '%s/' prefix to job_documents bucket", (prefix) => {
    expect(resolveJobDocumentBucket(`${prefix}/job-1/file.pdf`)).toBe("job_documents");
  });

  it("maps hojas-de-ruta/ prefix to job-documents bucket", () => {
    expect(resolveJobDocumentBucket("hojas-de-ruta/job-1/Hoja de Ruta.pdf")).toBe("job-documents");
  });

  it("maps an unrecognised prefix to job-documents bucket", () => {
    expect(resolveJobDocumentBucket("misc/job-1/file.pdf")).toBe("job-documents");
  });

  it("maps a uuid-style path to job-documents bucket", () => {
    expect(resolveJobDocumentBucket("550e8400-e29b-41d4-a716-446655440000/file.pdf")).toBe("job-documents");
  });

  it("strips a leading slash before resolving", () => {
    expect(resolveJobDocumentBucket("/sound/job-1/file.pdf")).toBe("job_documents");
  });

  it("returns job-documents for an empty path", () => {
    expect(resolveJobDocumentBucket("")).toBe("job-documents");
  });
});

// ── isJobHojaDeRutaDocument ───────────────────────────────────────────────────

describe("isJobHojaDeRutaDocument", () => {
  it("matches the canonical hojas-de-ruta/{jobId}/ path", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta - Show.pdf",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches hojas-de-ruta/ prefix with a different jobId when name contains hoja de ruta text", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta - Gira.pdf",
      file_path: "hojas-de-ruta/job-99/Hoja de Ruta - Gira.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches legacy {jobId}/ prefix with hoja de ruta text", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta.pdf",
      file_path: "job-1/Hoja de Ruta.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches via catch-all when path has no special prefix but name contains hoja de ruta", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta - Extra.pdf",
      file_path: "shared/Hoja de Ruta - Extra.pdf",
    }, "job-1")).toBe(true);
  });

  it("returns false when file_path is null", () => {
    expect(isJobHojaDeRutaDocument({ file_name: "Hoja de Ruta.pdf", file_path: null }, "job-1")).toBe(false);
  });

  it("returns false when file_path is empty", () => {
    expect(isJobHojaDeRutaDocument({ file_name: "Hoja de Ruta.pdf", file_path: "" }, "job-1")).toBe(false);
  });

  it("returns false for non-PDF files even with the correct path prefix", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta.docx",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }, "job-1")).toBe(false);
  });

  it("returns false for PDFs that have neither hoja/ruta text nor the canonical prefix", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Presupuesto 2024.pdf",
      file_path: "job-1/Presupuesto 2024.pdf",
    }, "job-1")).toBe(false);
  });

  it("normalizes accented characters when matching", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Rúta - Show.pdf",
      file_path: "hojas-de-ruta/job-1/Hoja de Rúta - Show.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches the english 'route' keyword", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Route.pdf",
      file_path: "job-1/Hoja de Route.pdf",
    }, "job-1")).toBe(true);
  });

  it("strips a leading slash from file_path before matching", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta.pdf",
      file_path: "/hojas-de-ruta/job-1/Hoja de Ruta.pdf",
    }, "job-1")).toBe(true);
  });

  it("detects PDF via file_type when the extension is absent from name/path", () => {
    expect(isJobHojaDeRutaDocument({
      file_name: "Hoja de Ruta",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta",
      file_type: "application/pdf",
    }, "job-1")).toBe(true);
  });
});

// ── isTourHojaDeRutaDocument ──────────────────────────────────────────────────

describe("isTourHojaDeRutaDocument", () => {
  it("matches via hojas-de-ruta/ prefix (any filename)", () => {
    expect(isTourHojaDeRutaDocument({
      file_name: "tour_call_sheet.pdf",
      file_path: "hojas-de-ruta/tour-1/tour_call_sheet.pdf",
    })).toBe(true);
  });

  it("matches via hoja de ruta text in filename", () => {
    expect(isTourHojaDeRutaDocument({
      file_name: "Hoja de Ruta - Tour Date.pdf",
      file_path: "schedules/tour-1/Hoja de Ruta - Tour Date.pdf",
    })).toBe(true);
  });

  it("returns false for a generic schedule PDF without hoja de ruta text", () => {
    expect(isTourHojaDeRutaDocument({
      file_name: "tour_schedule.pdf",
      file_path: "schedules/tour-1/tour_schedule.pdf",
    })).toBe(false);
  });

  it("returns false when file_path is null", () => {
    expect(isTourHojaDeRutaDocument({ file_name: "Hoja de Ruta.pdf", file_path: null })).toBe(false);
  });

  it("returns false when file_path is empty", () => {
    expect(isTourHojaDeRutaDocument({ file_name: "Hoja de Ruta.pdf", file_path: "" })).toBe(false);
  });

  it("returns false for non-PDF files even with hoja de ruta text", () => {
    expect(isTourHojaDeRutaDocument({
      file_name: "Hoja de Ruta.docx",
      file_path: "tour-1/Hoja de Ruta.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })).toBe(false);
  });

  it("matches the english 'route' keyword", () => {
    expect(isTourHojaDeRutaDocument({
      file_name: "Hoja de Route.pdf",
      file_path: "tour-1/Hoja de Route.pdf",
    })).toBe(true);
  });

  it("strips a leading slash from file_path before matching", () => {
    expect(isTourHojaDeRutaDocument({
      file_name: "Hoja de Ruta.pdf",
      file_path: "/hojas-de-ruta/tour-1/Hoja de Ruta.pdf",
    })).toBe(true);
  });
});

// ── toHojaAttachment ──────────────────────────────────────────────────────────

describe("toHojaAttachment", () => {
  it("returns null when file_path is null", () => {
    expect(toHojaAttachment("job_documents", { file_name: "Hoja de Ruta.pdf", file_path: null }, "job-documents")).toBeNull();
  });

  it("returns null when file_path is empty", () => {
    expect(toHojaAttachment("job_documents", { file_name: "Hoja de Ruta.pdf", file_path: "" }, "job-documents")).toBeNull();
  });

  it("returns a complete HojaAttachment for a job document", () => {
    const result = toHojaAttachment(
      "job_documents",
      {
        file_name: "Hoja de Ruta - Show.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
      },
      "job-documents",
    );

    expect(result).toEqual({
      source: "job_documents",
      bucket: "job-documents",
      path: "hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
      filename: "Hoja de Ruta - Show.pdf",
    });
  });

  it("returns a complete HojaAttachment for a tour document", () => {
    const result = toHojaAttachment(
      "tour_documents",
      {
        file_name: "Hoja de Ruta - Gira.pdf",
        file_path: "hojas-de-ruta/tour-1/Hoja de Ruta - Gira.pdf",
      },
      "tour-documents",
    );

    expect(result).toEqual({
      source: "tour_documents",
      bucket: "tour-documents",
      path: "hojas-de-ruta/tour-1/Hoja de Ruta - Gira.pdf",
      filename: "Hoja de Ruta - Gira.pdf",
    });
  });

  it("uses job_documents bucket for departmental paths", () => {
    const result = toHojaAttachment(
      "job_documents",
      {
        file_name: "Hoja de Ruta.pdf",
        file_path: "sound/job-1/Hoja de Ruta.pdf",
      },
      "job_documents",
    );

    expect(result?.bucket).toBe("job_documents");
    expect(result?.path).toBe("sound/job-1/Hoja de Ruta.pdf");
  });

  it("uses 'Hoja de Ruta.pdf' as the default filename when file_name is null", () => {
    const result = toHojaAttachment(
      "job_documents",
      {
        file_name: null,
        file_path: "hojas-de-ruta/job-1/unnamed",
        file_type: "application/pdf",
      },
      "job-documents",
    );

    expect(result?.filename).toBe("Hoja de Ruta.pdf");
  });

  it("strips a leading slash from file_path", () => {
    const result = toHojaAttachment(
      "job_documents",
      {
        file_name: "Hoja de Ruta.pdf",
        file_path: "/hojas-de-ruta/job-1/Hoja de Ruta.pdf",
      },
      "job-documents",
    );

    expect(result?.path).toBe("hojas-de-ruta/job-1/Hoja de Ruta.pdf");
  });
});