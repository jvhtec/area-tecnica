// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Artist } from "@/components/festival/artistTableTypes";
import { createTestQueryClient } from "@/test/createTestQueryClient";

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  trackError: vi.fn(),
  download: vi.fn(),
  exportArtistTablePDF: vi.fn(),
  fetchFestivalGearSetups: vi.fn(),
  fetchFestivalLogoUrl: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/errorTracking", () => ({ trackError: mocks.trackError }));
vi.mock("@/features/festival-management/commands", () => ({ downloadBlobInBrowser: mocks.download }));
vi.mock("@/utils/artistTablePdfExport", () => ({ exportArtistTablePDF: mocks.exportArtistTablePDF }));
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    fetchFestivalGearSetups: mocks.fetchFestivalGearSetups,
    fetchFestivalLogoUrl: mocks.fetchFestivalLogoUrl,
  };
});

import { useArtistTablePrint } from "../hooks/useArtistTablePrint";

const artist = (id: string, stage: number, showStart: string): Artist =>
  ({
    id,
    name: `Artist ${id}`,
    stage,
    date: "2026-07-01",
    show_start: showStart,
    show_end: "23:00",
    soundcheck: false,
    foh_console: "",
    mon_console: "",
    wireless_systems: [],
    iem_systems: [],
    monitors_enabled: false,
    monitors_quantity: 0,
    extras_sf: false,
    extras_df: false,
    extras_djbooth: false,
  }) as Artist;

const setup = (overrides: Partial<Parameters<typeof useArtistTablePrint>[0]> = {}) => {
  const onPrinted = vi.fn();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(
    () =>
      useArtistTablePrint({
        artists: [artist("late", 1, "22:00"), artist("early", 1, "18:00"), artist("other", 2, "19:00")],
        jobId: "job-1",
        jobTitle: "Sonorama",
        selectedDate: "2026-07-01",
        stageFilter: "1",
        dayStartTime: "06:00",
        stageNames: { 1: "Principal" },
        onPrinted,
        ...overrides,
      }),
    { wrapper },
  );
  return { ...rendered, onPrinted };
};

describe("useArtistTablePrint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exportArtistTablePDF.mockResolvedValue(new Blob(["pdf"]));
    mocks.fetchFestivalGearSetups.mockResolvedValue({ festivalGearSetup: null, stageGearSetups: {} });
    mocks.fetchFestivalLogoUrl.mockResolvedValue("https://logo/festival.png");
  });

  it("prints the chosen stage in show order, downloads it and reports done", async () => {
    const { result, onPrinted } = setup();

    await act(() => result.current.print());

    const data = mocks.exportArtistTablePDF.mock.calls[0][0];
    expect(data.artists.map((a: { name: string }) => a.name)).toEqual(["Artist early", "Artist late"]);
    expect(data.stage).toBe("1");
    expect(data.includeGearConflicts).toBe(false);
    expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringContaining("Principal"));
    expect(onPrinted).toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });

  it("asks for the gear conflicts summary only when it was ticked", async () => {
    const { result } = setup();
    act(() => result.current.setIncludeGearConflicts(true));

    await act(() => result.current.print());

    expect(mocks.exportArtistTablePDF.mock.calls[0][0].includeGearConflicts).toBe(true);
  });

  it("says so when no artist is on the chosen stage", async () => {
    const { result, onPrinted } = setup({ stageFilter: "9" });

    await act(() => result.current.print());

    expect(mocks.toast.error).toHaveBeenCalledWith("No se encontraron artistas para los criterios seleccionados");
    expect(mocks.exportArtistTablePDF).not.toHaveBeenCalled();
    expect(onPrinted).not.toHaveBeenCalled();
  });

  it("prints without the gear comparison when the gear setup cannot be read", async () => {
    mocks.fetchFestivalGearSetups.mockRejectedValue(new Error("denied"));
    const { result, onPrinted } = setup();

    await act(() => result.current.print());

    expect(mocks.trackError).toHaveBeenCalled();
    expect(mocks.exportArtistTablePDF).toHaveBeenCalled();
    expect(onPrinted).toHaveBeenCalled();
  });

  it("reports a failed export and stays open", async () => {
    mocks.exportArtistTablePDF.mockRejectedValue(new Error("boom"));
    const { result, onPrinted } = setup();

    await act(() => result.current.print());

    expect(mocks.toast.error).toHaveBeenCalledWith("Error al generar PDF");
    expect(onPrinted).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });
});
