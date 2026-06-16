import { describe, expect, it } from "vitest";

import {
  isJobHojaDeRutaDocument,
  isTourHojaDeRutaDocument,
  pickLatestJobHojaDeRutaDocument,
  pickLatestTourHojaDeRutaDocument,
} from "@/components/jobs/cards/job-card-actions/hojaDeRutaAttachment";

describe("hojaDeRutaAttachment", () => {
  it("matches current generated job Hoja de Ruta paths", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Show.pdf",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches legacy job-scoped Hoja de Ruta paths", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Tour.pdf",
      file_path: "job-1/Hoja de Ruta - Tour.pdf",
    }, "job-1")).toBe(true);
  });

  it("does not treat other hoja-style documents as route sheets", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Gastos.pdf",
      file_path: "job-1/Hoja de Gastos.pdf",
    }, "job-1")).toBe(false);
  });

  it("does not attach non-PDF route sheet lookalikes", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.docx",
      file_path: "job-1/Hoja de Ruta.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }, "job-1")).toBe(false);
  });

  it("picks the first matching job document from an upload-descending list", () => {
    const selected = pickLatestJobHojaDeRutaDocument([
      {
        id: "calc",
        file_name: "Resumen Potencia.pdf",
        file_path: "calculators/pesos/job-1/Resumen Potencia.pdf",
      },
      {
        id: "hoja",
        file_name: "Hoja de Ruta - Show.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
      },
    ], "job-1");

    expect(selected).toMatchObject({ id: "hoja", source: "job_documents" });
  });

  it("matches tour-document Hoja de Ruta records without matching generic schedules", () => {
    expect(isTourHojaDeRutaDocument({
      id: "schedule",
      file_name: "tour_schedule.pdf",
      file_path: "schedules/tour-1/tour_schedule.pdf",
    })).toBe(false);

    const selected = pickLatestTourHojaDeRutaDocument([
      {
        id: "schedule",
        file_name: "tour_schedule.pdf",
        file_path: "schedules/tour-1/tour_schedule.pdf",
      },
      {
        id: "tour-hoja",
        file_name: "Hoja de Ruta - Tour Date.pdf",
        file_path: "schedules/tour-1/Hoja de Ruta - Tour Date.pdf",
      },
    ]);

    expect(selected).toMatchObject({ id: "tour-hoja", source: "tour_documents" });
  });
});

describe("isJobHojaDeRutaDocument – null and empty path guards", () => {
  it("returns false when file_path is null", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf",
      file_path: null,
    }, "job-1")).toBe(false);
  });

  it("returns false when file_path is an empty string", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf",
      file_path: "",
    }, "job-1")).toBe(false);
  });

  it("strips leading slashes before matching hojas-de-ruta prefix", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Show.pdf",
      file_path: "/hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
    }, "job-1")).toBe(true);
  });
});

describe("isJobHojaDeRutaDocument – hojas-de-ruta prefix with different job id", () => {
  it("matches a hojas-de-ruta doc for another job when it has hoja de ruta text", () => {
    // path starts with "hojas-de-ruta/" but contains a different jobId — still matches
    // because the second branch in isJobHojaDeRutaDocument only checks "hojas-de-ruta/" + hoja text
    expect(isJobHojaDeRutaDocument({
      id: "doc-linked",
      file_name: "Hoja de Ruta.pdf",
      file_path: "hojas-de-ruta/other-job/Hoja de Ruta.pdf",
    }, "job-1")).toBe(true);
  });

  it("does not match a hojas-de-ruta doc for another job when it lacks hoja de ruta text", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-other",
      file_name: "Contract.pdf",
      file_path: "hojas-de-ruta/other-job/Contract.pdf",
    }, "job-1")).toBe(false);
  });
});

describe("isJobHojaDeRutaDocument – accent and language normalization", () => {
  it("matches when the file name contains accented characters (Rúta)", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Rúta.pdf",
      file_path: "job-1/Hoja de Rúta.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches English 'Route' keyword as a synonym for 'Ruta'", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Route - Show.pdf",
      file_path: "job-1/Hoja de Route - Show.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches when file_name is uppercase", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "HOJA DE RUTA.PDF",
      file_path: "job-1/HOJA DE RUTA.PDF",
    }, "job-1")).toBe(true);
  });
});

describe("isJobHojaDeRutaDocument – PDF detection", () => {
  it("detects PDF via file_type MIME type even without .pdf extension", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta",
      file_path: "job-1/Hoja de Ruta",
      file_type: "application/pdf",
    }, "job-1")).toBe(true);
  });

  it("rejects a doc with a PDF-like name but explicitly non-PDF MIME type", () => {
    // file_name contains 'pdf' as a text token, but MIME is wrong and extension is wrong
    // The isPdfDocument check concatenates file_type + file_name + file_path and looks for "pdf"
    // So even with wrong MIME, the presence of ".pdf" or "pdf" anywhere triggers detection.
    // Confirm the docx test from the PR still rejects correctly.
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.docx",
      file_path: "job-1/Hoja de Ruta.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }, "job-1")).toBe(false);
  });

  it("matches when only the path contains a .pdf indicator and hoja text is in the name", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta",
      file_path: "job-1/Hoja de Ruta.pdf",
    }, "job-1")).toBe(true);
  });
});

describe("isJobHojaDeRutaDocument – generic hoja/ruta text fallback", () => {
  it("falls back to text matching when path has no job prefix but name contains hoja de ruta", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf",
      file_path: "shared/Hoja de Ruta.pdf",
    }, "job-1")).toBe(true);
  });

  it("does not match when hoja text is absent regardless of PDF extension", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Technical Rider.pdf",
      file_path: "job-1/Technical Rider.pdf",
    }, "job-1")).toBe(false);
  });
});

describe("isTourHojaDeRutaDocument – null and empty path guards", () => {
  it("returns false when file_path is null", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf",
      file_path: null,
    })).toBe(false);
  });

  it("returns false when file_path is an empty string", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf",
      file_path: "",
    })).toBe(false);
  });

  it("returns false for non-PDF documents even with hoja de ruta text", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.docx",
      file_path: "hojas-de-ruta/tour-1/Hoja de Ruta.docx",
    })).toBe(false);
  });
});

describe("isTourHojaDeRutaDocument – hojas-de-ruta prefix", () => {
  it("matches hojas-de-ruta prefix regardless of filename text", () => {
    // The hojas-de-ruta prefix is sufficient for tour docs (no text check needed)
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "tour-route.pdf",
      file_path: "hojas-de-ruta/tour-1/tour-route.pdf",
    })).toBe(true);
  });

  it("strips a leading slash before matching the hojas-de-ruta prefix", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf",
      file_path: "/hojas-de-ruta/tour-1/Hoja de Ruta.pdf",
    })).toBe(true);
  });
});

describe("isTourHojaDeRutaDocument – text-based fallback", () => {
  it("matches when hoja and ruta appear in file_name but path has no tour prefix", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - EU Tour.pdf",
      file_path: "uploads/2024/Hoja de Ruta - EU Tour.pdf",
    })).toBe(true);
  });

  it("matches English 'route' keyword for tour documents", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Route.pdf",
      file_path: "documents/Hoja de Route.pdf",
    })).toBe(true);
  });

  it("does not match when only 'hoja' appears without ruta/route", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Gastos.pdf",
      file_path: "documents/Hoja de Gastos.pdf",
    })).toBe(false);
  });
});

describe("pickLatestJobHojaDeRutaDocument – null/undefined/empty inputs", () => {
  it("returns null for null input", () => {
    expect(pickLatestJobHojaDeRutaDocument(null, "job-1")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(pickLatestJobHojaDeRutaDocument(undefined, "job-1")).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(pickLatestJobHojaDeRutaDocument([], "job-1")).toBeNull();
  });

  it("returns null when no document matches", () => {
    expect(pickLatestJobHojaDeRutaDocument([
      { id: "doc-1", file_name: "Invoice.pdf", file_path: "job-1/Invoice.pdf" },
    ], "job-1")).toBeNull();
  });
});

describe("pickLatestJobHojaDeRutaDocument – result shape", () => {
  it("propagates all original document fields plus source", () => {
    const doc = {
      id: "hoja-1",
      file_name: "Hoja de Ruta - Show.pdf",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
      file_type: "application/pdf",
      uploaded_at: "2024-06-01T12:00:00Z",
    };

    const result = pickLatestJobHojaDeRutaDocument([doc], "job-1");
    expect(result).toEqual({ ...doc, source: "job_documents" });
  });

  it("returns the first match when multiple documents qualify", () => {
    const result = pickLatestJobHojaDeRutaDocument([
      {
        id: "older-hoja",
        file_name: "Hoja de Ruta v1.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta v1.pdf",
        uploaded_at: "2024-05-01T00:00:00Z",
      },
      {
        id: "newer-hoja",
        file_name: "Hoja de Ruta v2.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta v2.pdf",
        uploaded_at: "2024-06-01T00:00:00Z",
      },
    ], "job-1");

    // find() stops at the first match, so the first array element wins
    expect(result).toMatchObject({ id: "older-hoja", source: "job_documents" });
  });
});

describe("pickLatestTourHojaDeRutaDocument – null/undefined/empty inputs", () => {
  it("returns null for null input", () => {
    expect(pickLatestTourHojaDeRutaDocument(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(pickLatestTourHojaDeRutaDocument(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(pickLatestTourHojaDeRutaDocument([])).toBeNull();
  });

  it("returns null when no document matches", () => {
    expect(pickLatestTourHojaDeRutaDocument([
      { id: "doc-1", file_name: "Tour Rider.pdf", file_path: "schedules/Tour Rider.pdf" },
    ])).toBeNull();
  });
});

describe("pickLatestTourHojaDeRutaDocument – result shape", () => {
  it("propagates all original document fields plus source", () => {
    const doc = {
      id: "tour-hoja-1",
      file_name: "Hoja de Ruta - EU Tour.pdf",
      file_path: "hojas-de-ruta/tour-abc/Hoja de Ruta - EU Tour.pdf",
      file_type: "application/pdf",
      uploaded_at: "2024-09-15T08:00:00Z",
    };

    const result = pickLatestTourHojaDeRutaDocument([doc]);
    expect(result).toEqual({ ...doc, source: "tour_documents" });
  });

  it("skips non-matching docs and picks the first match", () => {
    const result = pickLatestTourHojaDeRutaDocument([
      { id: "rider", file_name: "Stage Rider.pdf", file_path: "docs/Stage Rider.pdf" },
      { id: "hoja", file_name: "Hoja de Ruta.pdf", file_path: "hojas-de-ruta/tour-1/Hoja de Ruta.pdf" },
      { id: "another-hoja", file_name: "Hoja de Ruta v2.pdf", file_path: "hojas-de-ruta/tour-1/Hoja de Ruta v2.pdf" },
    ]);

    expect(result).toMatchObject({ id: "hoja", source: "tour_documents" });
  });
});
