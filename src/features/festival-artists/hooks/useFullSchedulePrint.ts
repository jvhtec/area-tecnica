import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { exportFullFestivalSchedulePDF } from "@/utils/fullFestivalSchedulePdfExport";
import { buildReadableFilename } from "@/utils/fileName";
import { fetchFestivalScheduleArtists } from "../api";
import { toFullSchedulePdfArtists } from "../artistPdf";

interface UseFullSchedulePrintOptions {
  jobId: string | undefined;
  jobTitle: string;
  stageNames: Record<number, string>;
  logoUrl: string;
}

/** The full-festival schedule PDF of the artist management page. */
export function useFullSchedulePrint({
  jobId,
  jobTitle,
  stageNames,
  logoUrl,
}: UseFullSchedulePrintOptions) {
  const { toast } = useToast();
  const [isFullSchedulePrinting, setIsFullSchedulePrinting] = useState(false);

  const printFullSchedule = async (): Promise<void> => {
    if (!jobId) return;

    setIsFullSchedulePrinting(true);
    try {
      let rows;
      try {
        rows = await fetchFestivalScheduleArtists(jobId);
      } catch (error) {
        void trackError(error, { system: "festivals", operation: "load-full-schedule-artists", jobId });
        toast({
          title: "Error",
          description: "No se pudieron obtener los artistas del festival",
          variant: "destructive",
        });
        return;
      }

      if (rows.length === 0) {
        toast({
          title: "Sin Datos",
          description: "No se encontraron artistas para este festival",
          variant: "destructive",
        });
        return;
      }

      const blob = await exportFullFestivalSchedulePDF({
        jobTitle,
        artists: toFullSchedulePdfArtists(rows),
        stageNames,
        logoUrl: logoUrl || undefined,
      });
      downloadBlobInBrowser(blob, buildReadableFilename([jobTitle || "Festival", "Cronograma completo"]));
      toast({
        title: "Éxito",
        description: "PDF del horario completo del festival generado exitosamente",
      });
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "export-full-schedule-pdf", jobId });
      toast({
        title: "Error",
        description: "No se pudo generar el PDF del horario completo",
        variant: "destructive",
      });
    } finally {
      setIsFullSchedulePrinting(false);
    }
  };

  return { isFullSchedulePrinting, printFullSchedule };
}
