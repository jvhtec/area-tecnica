import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateStageGearPDF: vi.fn(),
  exportArtistTablePDF: vi.fn(),
  exportArtistPDF: vi.fn(),
  getPdfPageCount: vi.fn(),
  trackError: vi.fn(),
  exportRfIemTablePDF: vi.fn(),
  NoGearSetupError: class NoGearSetupError extends Error {},
}));

vi.mock("@/utils/gearSetupPdfExport", () => ({
  generateStageGearPDF: mocks.generateStageGearPDF,
  NoGearSetupError: mocks.NoGearSetupError,
}));
vi.mock("@/utils/rfIemTablePdfExport", () => ({ exportRfIemTablePDF: mocks.exportRfIemTablePDF }));
vi.mock("@/utils/artistTablePdfExport", () => ({ exportArtistTablePDF: mocks.exportArtistTablePDF }));
vi.mock("@/utils/artistPdfExport", () => ({ exportArtistPDF: mocks.exportArtistPDF }));
vi.mock("@/lib/errorTracking", () => ({ trackError: mocks.trackError }));
vi.mock("@/utils/pdf/festivalPdfSupport", async () => {
  const actual = await vi.importActual<typeof import("@/utils/pdf/festivalPdfSupport")>("@/utils/pdf/festivalPdfSupport");
  return { ...actual, getPdfPageCount: mocks.getPdfPageCount };
});

import { defaultPrintOptions } from "@/features/festival-print/model";
import type { FestivalArtistRow } from "@/features/festival-print/reportData";
import { generateArtistRequirementsSection } from "../artistRequirementsSection";
import { generateArtistTablesSection } from "../artistTablesSection";
import { buildBundleSections } from "../bundleSections";
import type { FestivalSectionContext } from "../context";
import { generateGearSection } from "../gearSection";
import { generateRfIemSection } from "../tableSections";

const pdf = (size = 5) => new Blob(["x".repeat(size)]);

const artist = (id: string, stage: number, date: string, showStart: string): FestivalArtistRow =>
  ({ id, name: `Artist ${id}`, stage, date, show_start: showStart, show_end: "23:00" }) as FestivalArtistRow;

const context = (overrides: Partial<FestivalSectionContext> = {}): FestivalSectionContext => ({
  jobId: "job-1",
  jobTitle: "Sonorama",
  dayStartTime: "06:00",
  logoUrl: undefined,
  options: defaultPrintOptions(3),
  pdfConcurrency: 2,
  reportProgress: vi.fn(),
  getStageNameByNumber: (stage) => `Escenario ${stage}`,
  stageNamesByNumber: {},
  artists: [],
  stagePlotUrlsByArtistId: {},
  ...overrides,
});

describe("festival bundle sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("gear section", () => {
    it("keeps only the stages that produced a page, in order", async () => {
      mocks.generateStageGearPDF.mockImplementation(async (_job: string, stage: number) => (stage === 2 ? pdf(0) : pdf()));
      const reportProgress = vi.fn();

      const section = await generateGearSection(context({ reportProgress }));

      expect(section.stages).toEqual([1, 3]);
      expect(section.pdfs).toHaveLength(2);
      expect(reportProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "gear-setup", completed: 3, total: 3 }));
    });

    it("leaves out a stage whose PDF fails, and tracks why", async () => {
      mocks.generateStageGearPDF.mockImplementation(async (_job: string, stage: number) => {
        if (stage === 1) throw new Error("no gear");
        return pdf();
      });

      const section = await generateGearSection(context());

      expect(section.stages).toEqual([2, 3]);
      expect(mocks.trackError).toHaveBeenCalledTimes(1);
    });

    it("leaves gear out without reporting an error when the festival has no gear setup", async () => {
      mocks.generateStageGearPDF.mockRejectedValue(new mocks.NoGearSetupError("No gear setup found for festival"));

      const section = await generateGearSection(context());

      expect(section).toEqual({ pdfs: [], stages: [] });
      expect(mocks.trackError).not.toHaveBeenCalled();
    });

    it("does nothing when it is switched off", async () => {
      const options = { ...defaultPrintOptions(3), includeGearSetup: false };
      expect(await generateGearSection(context({ options }))).toEqual({ pdfs: [], stages: [] });
      expect(mocks.generateStageGearPDF).not.toHaveBeenCalled();
    });
  });

  describe("RF/IEM section", () => {
    it("is left out, without calling the exporter or reporting an error, when nobody has RF or IEM", async () => {
      const section = await generateRfIemSection(context({ artists: [artist("a", 1, "2026-07-01", "20:00")] }));

      expect(section).toBeNull();
      expect(mocks.exportRfIemTablePDF).not.toHaveBeenCalled();
      expect(mocks.trackError).not.toHaveBeenCalled();
    });

    it("is made when an artist has a wireless system", async () => {
      mocks.exportRfIemTablePDF.mockResolvedValue(pdf());
      const withRf = {
        ...artist("a", 1, "2026-07-01", "20:00"),
        wireless_systems: [{ model: "AD4Q", quantity_ch: 4 }],
      } as FestivalArtistRow;

      const section = await generateRfIemSection(context({ artists: [withRf] }));

      expect(section).not.toBeNull();
      expect(mocks.exportRfIemTablePDF.mock.calls[0][0].artists).toHaveLength(1);
    });
  });

  describe("artist tables section", () => {
    it("makes a table per date and stage of the selected stages", async () => {
      mocks.exportArtistTablePDF.mockResolvedValue(pdf());
      const options = { ...defaultPrintOptions(3), artistTableStages: [1, 2] };

      const pdfs = await generateArtistTablesSection(
        context({
          options,
          artists: [
            artist("a", 1, "2026-07-01", "20:00"),
            artist("b", 2, "2026-07-01", "21:00"),
            artist("c", 3, "2026-07-01", "22:00"),
            artist("d", 1, "2026-07-02", "20:00"),
          ],
        }),
      );

      expect(pdfs).toHaveLength(3);
      expect(mocks.exportArtistTablePDF.mock.calls.map(([data]) => [data.date, data.stage, data.paginate])).toEqual([
        ["2026-07-01", "1", false],
        ["2026-07-01", "2", false],
        ["2026-07-02", "1", false],
      ]);
    });

    it("makes nothing for nobody", async () => {
      expect(await generateArtistTablesSection(context())).toEqual([]);
    });
  });

  describe("artist sheets section", () => {
    it("makes a sheet per artist in show order, with the artist's name as its title", async () => {
      mocks.exportArtistPDF.mockResolvedValue(pdf());
      const section = await generateArtistRequirementsSection(
        context({ artists: [artist("late", 1, "2026-07-01", "22:00"), artist("early", 1, "2026-07-01", "18:00")] }),
      );
      expect(section.titles).toEqual(["Artist early", "Artist late"]);
      expect(section.pdfs).toHaveLength(2);
    });
  });

  describe("bundle sections", () => {
    const documents = () => ({
      shifts: [pdf()],
      gear: { pdfs: [pdf()], stages: [1, 3] },
      artistTables: [pdf()],
      artistSheets: { pdfs: [pdf(), pdf()], titles: ["A", "B"] },
      rfIem: pdf(),
      infrastructure: null,
      wiredMics: pdf(),
      weather: null,
      missingRiders: pdf(),
    });

    it("orders the sections and gives each its folios and contents", async () => {
      mocks.getPdfPageCount.mockResolvedValue(2);

      const sections = await buildBundleSections(documents(), defaultPrintOptions(3), (s) => `Escenario ${s}`);

      expect(sections.map((s) => s.title)).toEqual([
        "Turnos de personal",
        "Dotación por escenario",
        "Programa del día",
        "RF e IEM",
        "Microfonía cableada",
        "Riders pendientes",
        "Fichas de artista",
      ]);
      const gear = sections.find((s) => s.title === "Dotación por escenario");
      expect(gear?.contents).toEqual(["Escenario 1", "Escenario 3"]);
      const sheets = sections.find((s) => s.title === "Fichas de artista");
      expect(sheets?.pageCount).toBe(4);
      expect(sheets?.children).toEqual([
        { title: "A", pageCount: 2 },
        { title: "B", pageCount: 2 },
      ]);
    });

    it("leaves out sections that are switched off or have no pages", async () => {
      mocks.getPdfPageCount.mockImplementation(async (blob: Blob) => (blob.size === 5 ? 1 : 0));
      const options = { ...defaultPrintOptions(3), includeShiftSchedules: false, includeArtistRequirements: false };
      const docs = documents();
      docs.rfIem = pdf(9); // counted as zero pages

      const sections = await buildBundleSections(docs, options, (s) => `Escenario ${s}`);

      const titles = sections.map((s) => s.title);
      expect(titles).not.toContain("Turnos de personal");
      expect(titles).not.toContain("RF e IEM");
      expect(titles).not.toContain("Fichas de artista");
      expect(titles).toContain("Programa del día");
    });
  });
});
