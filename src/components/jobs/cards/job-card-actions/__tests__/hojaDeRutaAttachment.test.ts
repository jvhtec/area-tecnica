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
