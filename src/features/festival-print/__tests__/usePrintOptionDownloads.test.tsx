// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  trackError: vi.fn(),
  download: vi.fn(),
  reports: {
    buildGearSetupReport: vi.fn(),
    buildShiftSchedulesReport: vi.fn(),
    buildArtistTablesReport: vi.fn(),
    buildRfIemReport: vi.fn(),
    buildInfrastructureReport: vi.fn(),
    buildWiredMicNeedsReport: vi.fn(),
    buildMissingRiderReport: vi.fn(),
    sendMissingRiderReport: vi.fn(),
  },
  dayStart: { dayStartTime: "06:00", error: null as unknown, isPending: false },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/errorTracking", () => ({ trackError: mocks.trackError }));
vi.mock("@/features/festival-management/commands", () => ({ downloadBlobInBrowser: mocks.download }));
vi.mock("@/features/festival-management/useFestivalDayStart", () => ({ useFestivalDayStart: () => mocks.dayStart }));
vi.mock("../reports", async () => {
  const actual = await vi.importActual<typeof import("../reports")>("../reports");
  return { ...actual, ...mocks.reports };
});

import { defaultPrintOptions } from "../model";
import { NothingToPrintError } from "../reports";
import { usePrintOptionDownloads } from "../hooks/usePrintOptionDownloads";

const setup = () =>
  renderHook(() => usePrintOptionDownloads({ jobId: "job-1", jobTitle: "Sonorama", options: defaultPrintOptions(2) }));

describe("usePrintOptionDownloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dayStart.dayStartTime = "06:00";
    mocks.dayStart.error = null;
    mocks.dayStart.isPending = false;
  });

  it("downloads the report under its file name and says so", async () => {
    mocks.reports.buildRfIemReport.mockResolvedValue({ blob: new Blob(["x"]), filenameParts: ["Sonorama", "Tabla RF IEM"] });
    const { result } = setup();

    await act(() => result.current.download("rfIemTable"));

    expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringContaining("Tabla RF IEM"));
    expect(mocks.toast.success).toHaveBeenCalledWith("Tabla de RF/IEM descargada exitosamente");
  });

  it("reports a report with nothing to show as a message, not as an error", async () => {
    mocks.reports.buildShiftSchedulesReport.mockRejectedValue(new NothingToPrintError("No hay turnos para los escenarios seleccionados."));
    const { result } = setup();

    await act(() => result.current.download("shiftSchedules"));

    expect(mocks.toast.error).toHaveBeenCalledWith("No hay turnos para los escenarios seleccionados.");
    expect(mocks.trackError).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("tracks and reports a real failure", async () => {
    mocks.reports.buildGearSetupReport.mockRejectedValue(new Error("boom"));
    const { result } = setup();

    await act(() => result.current.download("gearSetup"));

    expect(mocks.trackError).toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith("Error al generar Equipamiento: boom");
  });

  it("hands the reports a day start that fails while the setting is loading", async () => {
    mocks.dayStart.isPending = true;
    mocks.reports.buildArtistTablesReport.mockImplementation(async (context) => context.getDayStartTime());
    const { result } = setup();

    await act(() => result.current.download("artistTables"));

    expect(mocks.toast.error).toHaveBeenCalledWith(
      "Error al generar Tablas de Artistas: La configuración de jornada todavía se está cargando",
    );
  });

  it("mails the missing-rider report to what was typed and clears the busy flag", async () => {
    mocks.reports.sendMissingRiderReport.mockResolvedValue(2);
    const { result } = setup();
    act(() => result.current.setRecipientEmails("a@x.com, b@x.com"));

    await act(() => result.current.sendMissingRiders());

    expect(mocks.reports.sendMissingRiderReport).toHaveBeenCalledWith(expect.anything(), "a@x.com, b@x.com");
    expect(mocks.toast.success).toHaveBeenCalledWith("Reporte enviado a 2 destinatario(s).");
    expect(result.current.isSending).toBe(false);
  });

  it("asks for a recipient instead of failing", async () => {
    mocks.reports.sendMissingRiderReport.mockRejectedValue(new NothingToPrintError("Añade al menos un correo externo para enviar el reporte."));
    const { result } = setup();

    await act(() => result.current.sendMissingRiders());

    expect(mocks.toast.error).toHaveBeenCalledWith("Añade al menos un correo externo para enviar el reporte.");
    expect(result.current.isSending).toBe(false);
  });
});
