import { describe, expect, it } from "vitest";

import {
  isJobHojaDeRutaDocument,
  isTourHojaDeRutaDocument,
  pickLatestJobHojaDeRutaDocument,
  pickLatestLinkedJobHojaDeRutaDocument,
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

  it("does not attach files with unsafe PDF-looking names", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta.pdf.exe",
      file_path: "job-1/Hoja de Ruta.pdf.exe",
      file_type: "application/x-msdownload",
    }, "job-1")).toBe(false);
  });

  it("accepts the PDF MIME type even when the filename has no extension", () => {
    expect(isJobHojaDeRutaDocument({
      id: "doc-1",
      file_name: "Hoja de Ruta - Show",
      file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Show",
      file_type: "application/pdf; charset=binary",
    }, "job-1")).toBe(true);
  });

  it("picks the latest matching job document by upload time", () => {
    const selected = pickLatestJobHojaDeRutaDocument([
      {
        id: "old-hoja",
        file_name: "Hoja de Ruta - Old.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta - Old.pdf",
        uploaded_at: "2026-06-16T10:00:00Z",
      },
      {
        id: "new-hoja",
        file_name: "Hoja de Ruta - New.pdf",
        file_path: "hojas-de-ruta/job-1/Hoja de Ruta - New.pdf",
        uploaded_at: "2026-06-16T12:00:00Z",
      },
    ], "job-1");

    expect(selected).toMatchObject({ id: "new-hoja", source: "job_documents" });
  });

  it("picks the latest linked job Hoja de Ruta across all candidate jobs", () => {
    const selected = pickLatestLinkedJobHojaDeRutaDocument([
      {
        id: "job-2-hoja",
        job_id: "job-2",
        file_name: "Hoja de Ruta - Linked 2.pdf",
        file_path: "hojas-de-ruta/job-2/Hoja de Ruta - Linked 2.pdf",
        uploaded_at: "2026-06-16T10:00:00Z",
      },
      {
        id: "job-3-hoja",
        job_id: "job-3",
        file_name: "Hoja de Ruta - Linked 3.pdf",
        file_path: "hojas-de-ruta/job-3/Hoja de Ruta - Linked 3.pdf",
        uploaded_at: "2026-06-16T12:00:00Z",
      },
    ], ["job-2", "job-3"]);

    expect(selected).toMatchObject({ id: "job-3-hoja", source: "job_documents" });
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
