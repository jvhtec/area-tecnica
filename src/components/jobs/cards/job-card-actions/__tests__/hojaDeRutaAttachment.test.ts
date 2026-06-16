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

  // ── isJobHojaDeRutaDocument – additional edge cases ──────────────────────

  it("returns false when file_path is null", () => {
    expect(isJobHojaDeRutaDocument({ id: "doc-1", file_name: "Hoja de Ruta.pdf", file_path: null }, "job-1")).toBe(false);
  });

  it("returns false when file_path is empty string", () => {
    expect(isJobHojaDeRutaDocument({ id: "doc-1", file_name: "Hoja de Ruta.pdf", file_path: "" }, "job-1")).toBe(false);
  });

  it("matches hojas-de-ruta/ prefix for a different jobId when the name contains hoja de ruta text", () => {
    // path starts with hojas-de-ruta/ but belongs to a different job – still matches via line 38 condition
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Gira.pdf",
      file_path: "hojas-de-ruta/job-99/Hoja de Ruta - Gira.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches via the catch-all when path has neither the job prefix nor hojas-de-ruta prefix", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Extra.pdf",
      file_path: "shared/Hoja de Ruta - Extra.pdf",
    }, "job-1")).toBe(true);
  });

  it("matches english 'route' keyword as an alternative to 'ruta'", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Route.pdf",
      file_path: "job-1/Hoja de Route.pdf",
    }, "job-1")).toBe(true);
  });

  it("normalizes accented characters when matching", () => {
    // 'ú' in Rúta should normalize to 'u' → still matches 'ruta'
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Rúta - Show.pdf",
      file_path: "hojas-de-ruta/job-1/Hoja de Rúta - Show.pdf",
    }, "job-1")).toBe(true);
  });

  it("detects PDF via file_type when extension is missing from name/path", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta",
      file_type: "application/pdf",
    }, "job-1")).toBe(true);
  });

  it("strips a leading slash from file_path before matching", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Show.pdf",
      file_path: "/hojas-de-ruta/job-1/Hoja de Ruta - Show.pdf",
    }, "job-1")).toBe(true);
  });

  it("does not match when file_name and file_path contain neither 'hoja' nor hoja-de-ruta path", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Presupuesto 2024.pdf",
      file_path: "job-1/Presupuesto 2024.pdf",
    }, "job-1")).toBe(false);
  });

  // ── isTourHojaDeRutaDocument – additional edge cases ─────────────────────

  it("returns false for tour doc when file_path is null", () => {
    expect(isTourHojaDeRutaDocument({ id: "doc-1", file_name: "Hoja de Ruta.pdf", file_path: null })).toBe(false);
  });

  it("returns false for tour doc when file_path is empty", () => {
    expect(isTourHojaDeRutaDocument({ id: "doc-1", file_name: "Hoja de Ruta.pdf", file_path: "" })).toBe(false);
  });

  it("returns true for tour doc stored under hojas-de-ruta/ regardless of filename", () => {
    // path prefix alone is sufficient
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "tour_call_sheet.pdf",
      file_path: "hojas-de-ruta/tour-1/tour_call_sheet.pdf",
    })).toBe(true);
  });

  it("returns false for tour doc that is hoja-text but not PDF", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.docx",
      file_path: "tour-1/Hoja de Ruta.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })).toBe(false);
  });

  it("matches tour doc with english 'route' keyword", () => {
    expect(isTourHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Route.pdf",
      file_path: "tour-1/Hoja de Route.pdf",
    })).toBe(true);
  });

  // ── pickLatestJobHojaDeRutaDocument – null/empty guard cases ─────────────

  it("returns null when docs is null", () => {
    expect(pickLatestJobHojaDeRutaDocument(null, "job-1")).toBeNull();
  });

  it("returns null when docs is undefined", () => {
    expect(pickLatestJobHojaDeRutaDocument(undefined, "job-1")).toBeNull();
  });

  it("returns null when docs is an empty array", () => {
    expect(pickLatestJobHojaDeRutaDocument([], "job-1")).toBeNull();
  });

  it("returns null when no doc in the list matches the jobId", () => {
    const result = pickLatestJobHojaDeRutaDocument([
      { id: "doc-1", file_name: "Contrato.pdf", file_path: "job-1/Contrato.pdf" },
    ], "job-1");
    expect(result).toBeNull();
  });

  it("preserves all original fields on the returned doc and adds source", () => {
    const result = pickLatestJobHojaDeRutaDocument([
      {
        id: "hoja",
        file_name: "Hoja de Ruta.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta.pdf",
        uploaded_at: "2024-01-15T10:00:00Z",
      },
    ], "job-1");

    expect(result).toEqual({
      id: "hoja",
      file_name: "Hoja de Ruta.pdf",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta.pdf",
      uploaded_at: "2024-01-15T10:00:00Z",
      source: "job_documents",
    });
  });

  // ── pickLatestTourHojaDeRutaDocument – null/empty guard cases ────────────

  it("returns null when tour docs is null", () => {
    expect(pickLatestTourHojaDeRutaDocument(null)).toBeNull();
  });

  it("returns null when tour docs is undefined", () => {
    expect(pickLatestTourHojaDeRutaDocument(undefined)).toBeNull();
  });

  it("returns null when tour docs is an empty array", () => {
    expect(pickLatestTourHojaDeRutaDocument([])).toBeNull();
  });

  it("returns null when no tour doc matches", () => {
    const result = pickLatestTourHojaDeRutaDocument([
      { id: "doc-1", file_name: "Contrato Tour.pdf", file_path: "tours/tour-1/Contrato Tour.pdf" },
    ]);
    expect(result).toBeNull();
  });

  it("preserves all original fields on the returned tour doc and adds source", () => {
    const result = pickLatestTourHojaDeRutaDocument([
      {
        id: "tour-hoja",
        file_name: "Hoja de Ruta - Gira.pdf",
        file_path: "hojas-de-ruta/tour-1/Hoja de Ruta - Gira.pdf",
        uploaded_at: "2024-03-01T09:00:00Z",
      },
    ]);

    expect(result).toEqual({
      id: "tour-hoja",
      file_name: "Hoja de Ruta - Gira.pdf",
      file_path: "hojas-de-ruta/tour-1/Hoja de Ruta - Gira.pdf",
      uploaded_at: "2024-03-01T09:00:00Z",
      source: "tour_documents",
    });
  });

  it("picks the first matching tour doc when the list is already ordered newest-first", () => {
    const result = pickLatestTourHojaDeRutaDocument([
      {
        id: "newest",
        file_name: "Hoja de Ruta v2.pdf",
        file_path: "hojas-de-ruta/tour-1/Hoja de Ruta v2.pdf",
        uploaded_at: "2024-06-01T00:00:00Z",
      },
      {
        id: "older",
        file_name: "Hoja de Ruta v1.pdf",
        file_path: "hojas-de-ruta/tour-1/Hoja de Ruta v1.pdf",
        uploaded_at: "2024-05-01T00:00:00Z",
      },
    ]);

    expect(result).toMatchObject({ id: "newest", source: "tour_documents" });
  });
});
