import { useState } from "react";
import { toast } from "sonner";

import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { useFestivalDayStart } from "@/features/festival-management/useFestivalDayStart";
import { trackError } from "@/lib/errorTracking";
import { buildReadableFilename } from "@/utils/fileName";
import { getErrorMessage } from "@/utils/errorMessage";
import type { PrintDownloadKind, PrintOptions } from "../model";
import {
  NothingToPrintError,
  buildArtistTablesReport,
  buildGearSetupReport,
  buildInfrastructureReport,
  buildMissingRiderReport,
  buildRfIemReport,
  buildShiftSchedulesReport,
  buildWiredMicNeedsReport,
  sendMissingRiderReport,
  type PrintReport,
  type ReportContext,
} from "../reports";

interface Download {
  build: (context: ReportContext) => Promise<PrintReport>;
  success: string;
  failure: string;
}

const DOWNLOADS: Record<PrintDownloadKind, Download> = {
  gearSetup: {
    build: buildGearSetupReport,
    success: "Equipamiento descargado exitosamente",
    failure: "Error al generar Equipamiento",
  },
  shiftSchedules: {
    build: buildShiftSchedulesReport,
    success: "Horarios de Turnos descargados exitosamente",
    failure: "Error al generar Horarios de Turnos",
  },
  artistTables: {
    build: buildArtistTablesReport,
    success: "Tablas de Artistas descargadas exitosamente",
    failure: "Error al generar Tablas de Artistas",
  },
  rfIemTable: {
    build: buildRfIemReport,
    success: "Tabla de RF/IEM descargada exitosamente",
    failure: "Error al generar Tabla de RF/IEM",
  },
  infrastructureTable: {
    build: buildInfrastructureReport,
    success: "Tabla de Infraestructura descargada exitosamente",
    failure: "Error al generar Tabla de Infraestructura",
  },
  wiredMicNeeds: {
    build: buildWiredMicNeedsReport,
    success: "Necesidades de Micrófonos Cableados descargadas exitosamente",
    failure: "Error al generar Necesidades de Micrófonos Cableados",
  },
  missingRiderReport: {
    build: buildMissingRiderReport,
    success: "Reporte de Riders Faltantes descargado exitosamente",
    failure: "Error al generar Reporte de Riders Faltantes",
  },
};

interface Options {
  jobId?: string;
  jobTitle: string;
  options: PrintOptions;
}

/**
 * The one-click downloads next to each section of the print dialog, plus mailing the missing-rider
 * report. A report with nothing to show is a toast, not an error.
 */
export function usePrintOptionDownloads({ jobId, jobTitle, options }: Options) {
  const dayStart = useFestivalDayStart(jobId);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [isSending, setIsSending] = useState(false);

  const context: ReportContext = {
    jobId,
    jobTitle,
    options,
    getDayStartTime: () => {
      if (dayStart.error) throw dayStart.error;
      if (dayStart.isPending || !dayStart.dayStartTime) {
        throw new Error("La configuración de jornada todavía se está cargando");
      }
      return dayStart.dayStartTime;
    },
  };

  const download = async (kind: PrintDownloadKind) => {
    const { build, success, failure } = DOWNLOADS[kind];
    try {
      const { blob, filenameParts } = await build(context);
      downloadBlobInBrowser(blob, buildReadableFilename(filenameParts));
      toast.success(success);
    } catch (error) {
      if (error instanceof NothingToPrintError) {
        toast.error(error.message);
        return;
      }
      void trackError(error, { system: "festivals", operation: `print-download-${kind}`, jobId });
      toast.error(`${failure}: ${getErrorMessage(error, "Error desconocido")}`);
    }
  };

  const sendMissingRiders = async () => {
    setIsSending(true);
    try {
      const sent = await sendMissingRiderReport(context, recipientEmails);
      toast.success(`Reporte enviado a ${sent} destinatario(s).`);
    } catch (error) {
      if (error instanceof NothingToPrintError) {
        toast.error(error.message);
        return;
      }
      void trackError(error, { system: "festivals", operation: "send-missing-rider-report", jobId });
      toast.error(`Error al enviar reporte de riders faltantes: ${getErrorMessage(error, "Error desconocido")}`);
    } finally {
      setIsSending(false);
    }
  };

  return { download, sendMissingRiders, isSending, recipientEmails, setRecipientEmails };
}
