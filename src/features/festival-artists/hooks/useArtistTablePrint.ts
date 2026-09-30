import { useState } from "react";
import { toast } from "sonner";

import type { Artist } from "@/components/festival/artistTableTypes";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { trackError } from "@/lib/errorTracking";
import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { sortArtistsChronologically } from "@/utils/artistSorting";
import { fetchFestivalGearSetups, type FestivalGearSetups } from "../api";
import { artistTableFilename, filterArtistsByStage, toArtistTableRow } from "../artistTablePdf";
import { compareArtistsWithGear } from "../gearComparison";
import { useFestivalLogoUrl } from "./useFestivalArtistLookups";

interface UseArtistTablePrintOptions {
  artists: readonly Artist[];
  jobId: string | undefined;
  jobTitle: string | undefined;
  selectedDate: string;
  stageFilter: string;
  dayStartTime: string;
  stageNames: Record<number, string> | undefined;
  /** Called after the PDF was downloaded. */
  onPrinted: () => void;
}

const NO_GEAR: FestivalGearSetups = { festivalGearSetup: null, stageGearSetups: {} };

/** Generates the artist schedule PDF of the day (and stage) shown on the artists page. */
export function useArtistTablePrint({
  artists,
  jobId,
  jobTitle,
  selectedDate,
  stageFilter,
  dayStartTime,
  stageNames,
  onPrinted,
}: UseArtistTablePrintOptions) {
  const { logoUrl } = useFestivalLogoUrl(jobId);
  const [includeGearConflicts, setIncludeGearConflicts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const print = async () => {
    const matching = filterArtistsByStage(artists, stageFilter);
    if (matching.length === 0) {
      toast.error("No se encontraron artistas para los criterios seleccionados");
      return;
    }

    setIsGenerating(true);
    try {
      const sorted = sortArtistsChronologically(matching, dayStartTime) as Artist[];

      // The comparison is a nicety: a failed read prints the table without it.
      let gear = NO_GEAR;
      if (jobId) {
        try {
          gear = await fetchFestivalGearSetups(jobId);
        } catch (error) {
          void trackError(error, { system: "festivals", operation: "print-artist-table-gear", jobId });
        }
      }
      const comparisons = compareArtistsWithGear(sorted, gear.festivalGearSetup, gear.stageGearSetups);

      const blob = await exportArtistTablePDF({
        jobTitle: jobTitle || "Cronograma del festival",
        date: selectedDate,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        stageNames,
        artists: sorted.map((artist) => toArtistTableRow(artist, comparisons[artist.id])),
        dayStartTime,
        logoUrl,
        includeGearConflicts,
      });

      downloadBlobInBrowser(blob, artistTableFilename(selectedDate, stageFilter, stageNames));
      toast.success("PDF del cronograma de artistas generado exitosamente");
      onPrinted();
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "print-artist-table", jobId });
      toast.error("Error al generar PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return { includeGearConflicts, setIncludeGearConflicts, isGenerating, print };
}
