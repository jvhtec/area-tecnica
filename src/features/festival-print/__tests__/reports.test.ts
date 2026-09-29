import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: {
    fetchAllFestivalArtists: vi.fn(),
    fetchArtistsOnStages: vi.fn(),
    fetchShiftsForPrint: vi.fn(),
    fetchStageNamesByNumber: vi.fn(),
    sendReportEmail: vi.fn(),
  },
  exportMissingRiderReportPDF: vi.fn(),
  exportShiftsTablePDF: vi.fn(),
  exportArtistTablePDF: vi.fn(),
  exportRfIemTablePDF: vi.fn(),
  exportInfrastructureTablePDF: vi.fn(),
  exportWiredMicrophoneMatrixPDF: vi.fn(),
  generateStageGearPDF: vi.fn(),
  mergePDFs: vi.fn(),
  getActivePublicArtistFormLinks: vi.fn(),
}));

vi.mock("../api", () => mocks.api);
vi.mock("@/utils/missingRiderReportPdfExport", () => ({ exportMissingRiderReportPDF: mocks.exportMissingRiderReportPDF }));
vi.mock("@/utils/shiftsTablePdfExport", () => ({ exportShiftsTablePDF: mocks.exportShiftsTablePDF }));
vi.mock("@/utils/artistTablePdfExport", () => ({ exportArtistTablePDF: mocks.exportArtistTablePDF }));
vi.mock("@/utils/rfIemTablePdfExport", () => ({ exportRfIemTablePDF: mocks.exportRfIemTablePDF }));
vi.mock("@/utils/infrastructureTablePdfExport", () => ({ exportInfrastructureTablePDF: mocks.exportInfrastructureTablePDF }));
vi.mock("@/utils/wiredMicrophoneNeedsPdfExport", () => ({
  exportWiredMicrophoneMatrixPDF: mocks.exportWiredMicrophoneMatrixPDF,
  organizeArtistsByDateAndStage: (artists: unknown[]) => artists,
}));
vi.mock("@/utils/gearSetupPdfExport", () => ({ generateStageGearPDF: mocks.generateStageGearPDF }));
vi.mock("@/utils/pdf/pdfMerge", () => ({ mergePDFs: mocks.mergePDFs }));
vi.mock("@/utils/pdf/logoOptimization", () => ({ fetchPreparedFestivalLogo: vi.fn().mockResolvedValue("logo.png") }));
vi.mock("@/utils/publicArtistFormLinks", () => ({ getActivePublicArtistFormLinks: mocks.getActivePublicArtistFormLinks }));
vi.mock("@/utils/blobToBase64", () => ({ blobToBase64: vi.fn().mockResolvedValue("BASE64") }));

import { defaultPrintOptions } from "../model";
import {
  NothingToPrintError,
  buildArtistTablesReport,
  buildGearSetupReport,
  buildInfrastructureReport,
  buildMissingRiderEmail,
  buildRfIemReport,
  buildShiftSchedulesReport,
  buildWiredMicNeedsReport,
  buildMissingRiderReport,
  sendMissingRiderReport,
  type ReportContext,
} from "../reports";

const pdf = (size = 10) => new Blob(["x".repeat(size)]);

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
  jobId: "job-1",
  jobTitle: "Sonorama",
  options: defaultPrintOptions(2),
  getDayStartTime: () => "06:00",
  ...overrides,
});

describe("festival print reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.fetchStageNamesByNumber.mockResolvedValue({ 1: "Principal" });
    mocks.getActivePublicArtistFormLinks.mockResolvedValue({});
  });

  it("asks for the job before anything else", async () => {
    await expect(buildGearSetupReport(context({ jobId: undefined }))).rejects.toBeInstanceOf(NothingToPrintError);
    await expect(buildRfIemReport(context({ jobId: undefined }))).rejects.toThrow(/ID del trabajo/);
    expect(mocks.api.fetchArtistsOnStages).not.toHaveBeenCalled();
  });

  describe("gear setup", () => {
    it("downloads a single stage as it is, named after the stage", async () => {
      const blob = pdf();
      mocks.generateStageGearPDF.mockResolvedValue(blob);
      const report = await buildGearSetupReport(context({ options: { ...defaultPrintOptions(2), gearSetupStages: [2] } }));
      expect(report.blob).toBe(blob);
      expect(report.filenameParts).toEqual(["Sonorama", "Escenario 2", "Dotación técnica"]);
      expect(mocks.mergePDFs).not.toHaveBeenCalled();
    });

    it("merges several stages", async () => {
      mocks.generateStageGearPDF.mockResolvedValue(pdf());
      const merged = pdf(99);
      mocks.mergePDFs.mockResolvedValue(merged);
      const report = await buildGearSetupReport(context());
      expect(report.blob).toBe(merged);
      expect(report.filenameParts).toEqual(["Sonorama", "Dotación técnica"]);
    });

    it("has nothing to make without stages", async () => {
      await expect(
        buildGearSetupReport(context({ options: { ...defaultPrintOptions(2), gearSetupStages: [] } })),
      ).rejects.toThrow("No se pudo generar ningún PDF de equipamiento.");
    });
  });

  describe("shift schedules", () => {
    it("says so when no shift is on the selected stages", async () => {
      mocks.api.fetchShiftsForPrint.mockResolvedValue({ shifts: [], assignments: [], profilesById: new Map() });
      await expect(buildShiftSchedulesReport(context())).rejects.toThrow("No hay turnos para los escenarios seleccionados.");
    });

    it("makes one PDF per day, in date order, and merges them", async () => {
      const shift = (id: string, date: string) => ({
        id,
        job_id: "job-1",
        name: id,
        date,
        start_time: "10:00",
        end_time: "12:00",
        department: "sound",
        stage: 1,
      });
      mocks.api.fetchShiftsForPrint.mockResolvedValue({
        shifts: [shift("b", "2026-07-02"), shift("a", "2026-07-01"), shift("c", "2026-07-01")],
        assignments: [],
        profilesById: new Map(),
      });
      mocks.exportShiftsTablePDF.mockResolvedValue(pdf());
      mocks.mergePDFs.mockResolvedValue(pdf(50));

      const report = await buildShiftSchedulesReport(context());

      expect(mocks.exportShiftsTablePDF.mock.calls.map(([data]) => [data.date, data.shifts.length])).toEqual([
        ["2026-07-01", 2],
        ["2026-07-02", 1],
      ]);
      expect(mocks.exportShiftsTablePDF.mock.calls[0][0].dayStartTime).toBe("06:00");
      expect(report.filenameParts).toEqual(["Sonorama", "Horarios de turnos"]);
    });

    it("waits for the day start setting", async () => {
      const notReady = context({
        getDayStartTime: () => {
          throw new Error("La configuración de jornada todavía se está cargando");
        },
      });
      await expect(buildShiftSchedulesReport(notReady)).rejects.toThrow("todavía se está cargando");
      expect(mocks.api.fetchShiftsForPrint).not.toHaveBeenCalled();
    });
  });

  describe("artist tables", () => {
    it("says so when the stages have no artists", async () => {
      mocks.api.fetchArtistsOnStages.mockResolvedValue([]);
      await expect(buildArtistTablesReport(context())).rejects.toThrow("No hay artistas para los escenarios seleccionados.");
    });

    it("makes a table per date and stage", async () => {
      mocks.api.fetchArtistsOnStages.mockResolvedValue([
        { id: "1", name: "A", date: "2026-07-01", stage: 1, show_start: "20:00", show_end: "21:00" },
        { id: "2", name: "B", date: "2026-07-01", stage: 2, show_start: "20:00", show_end: "21:00" },
      ]);
      mocks.exportArtistTablePDF.mockResolvedValue(pdf());
      mocks.mergePDFs.mockResolvedValue(pdf(30));

      await buildArtistTablesReport(context());

      expect(mocks.exportArtistTablePDF.mock.calls.map(([data]) => [data.date, data.stage])).toEqual([
        ["2026-07-01", "1"],
        ["2026-07-01", "2"],
      ]);
    });
  });

  it("has no RF/IEM report when nobody uses RF or IEM", async () => {
    mocks.api.fetchArtistsOnStages.mockResolvedValue([{ id: "1", name: "A", date: "2026-07-01", stage: 1 }]);
    await expect(buildRfIemReport(context())).rejects.toThrow("No hay datos RF/IEM para los escenarios seleccionados.");
    expect(mocks.exportRfIemTablePDF).not.toHaveBeenCalled();
  });

  it("has no infrastructure report when nobody asks for infrastructure", async () => {
    mocks.api.fetchArtistsOnStages.mockResolvedValue([{ id: "1", name: "A", date: "2026-07-01", stage: 1 }]);
    await expect(buildInfrastructureReport(context())).rejects.toThrow(/infraestructura/);
  });

  it("makes the wired-mic report even when nobody needs mics (it says so itself)", async () => {
    mocks.api.fetchArtistsOnStages.mockResolvedValue([]);
    mocks.exportWiredMicrophoneMatrixPDF.mockResolvedValue(pdf());
    const report = await buildWiredMicNeedsReport(context());
    expect(report.filenameParts).toEqual(["Sonorama", "Necesidades micrófonos cableados"]);
  });

  describe("missing riders", () => {
    const artists = [
      { id: "ok", name: "Ok", stage: 1, date: "2026-07-01", rider_missing: false },
      { id: "gap", name: "Gap", stage: 1, date: "2026-07-01", rider_missing: true, form_language: "es" },
    ];

    it("reports the pending artists with the form links already issued", async () => {
      mocks.api.fetchAllFestivalArtists.mockResolvedValue(artists);
      mocks.getActivePublicArtistFormLinks.mockResolvedValue({ gap: "https://forms/gap" });
      mocks.exportMissingRiderReportPDF.mockResolvedValue(pdf());

      const report = await buildMissingRiderReport(context());

      expect(report.missingCount).toBe(1);
      const data = mocks.exportMissingRiderReportPDF.mock.calls[0][0];
      expect(data.artists).toHaveLength(1);
      expect(data.artists[0]).toMatchObject({ id: "gap", stageName: "Principal", formUrl: "https://forms/gap" });
      expect(mocks.getActivePublicArtistFormLinks).toHaveBeenCalledWith([{ id: "gap", form_language: "es" }]);
    });

    it("falls back to generic stage names when they cannot be read", async () => {
      mocks.api.fetchAllFestivalArtists.mockResolvedValue(artists);
      mocks.api.fetchStageNamesByNumber.mockRejectedValue(new Error("offline"));
      mocks.exportMissingRiderReportPDF.mockResolvedValue(pdf());

      await buildMissingRiderReport(context());

      expect(mocks.exportMissingRiderReportPDF.mock.calls[0][0].artists[0].stageName).toBe("Escenario 1");
    });

    it("mails the report to the typed recipients, once each", async () => {
      mocks.api.fetchAllFestivalArtists.mockResolvedValue(artists);
      mocks.exportMissingRiderReportPDF.mockResolvedValue(pdf(7));
      mocks.api.sendReportEmail.mockResolvedValue(undefined);

      const sent = await sendMissingRiderReport(context(), "a@x.com; b@x.com\na@x.com");

      expect(sent).toBe(2);
      const email = mocks.api.sendReportEmail.mock.calls[0][0];
      expect(email.recipients).toEqual(["a@x.com", "b@x.com"]);
      expect(email.subject).toBe("Reporte Riders Faltantes - Sonorama");
      expect(email.pdfAttachment).toMatchObject({ content: "BASE64", size: 7 });
      expect(email.bodyHtml).toContain("<strong>1</strong>");
    });

    it("does not build anything without recipients", async () => {
      await expect(sendMissingRiderReport(context(), " , ;")).rejects.toBeInstanceOf(NothingToPrintError);
      expect(mocks.api.fetchAllFestivalArtists).not.toHaveBeenCalled();
    });

    it("escapes the festival title in the mail", () => {
      expect(buildMissingRiderEmail("A<b>&Co", 3).bodyHtml).toContain("A&lt;b&gt;&amp;Co");
    });
  });
});
