import { getActivePublicArtistFormLinks } from "@/utils/publicArtistFormLinks";
import { blobToBase64 } from "@/utils/blobToBase64";
import { buildReadableFilename } from "@/utils/fileName";
import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { exportInfrastructureTablePDF } from "@/utils/infrastructureTablePdfExport";
import { exportMissingRiderReportPDF } from "@/utils/missingRiderReportPdfExport";
import { exportRfIemTablePDF } from "@/utils/rfIemTablePdfExport";
import { exportShiftsTablePDF } from "@/utils/shiftsTablePdfExport";
import { NoGearSetupError, generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { organizeArtistsByDateAndStage, exportWiredMicrophoneMatrixPDF } from "@/utils/wiredMicrophoneNeedsPdfExport";
import { mergePDFs } from "@/utils/pdf/pdfMerge";
import { fetchPreparedFestivalLogo } from "@/utils/pdf/logoOptimization";
import {
  attachShiftAssignmentsAndProfiles,
  buildArtistTableArtists,
  buildInfrastructureArtists,
  buildRfIemArtists,
  hasInfrastructureNeeds,
  hasRfIemSystems,
  sortArtistsChronologically,
} from "@/utils/pdf/festivalPdfSectionBuilders";
import { escapeHtml, parseRecipientEmails } from "@/features/festival-forms/emailTemplate";
import {
  fetchAllFestivalArtists,
  fetchArtistsOnStages,
  fetchShiftsForPrint,
  fetchStageNamesByNumber,
  sendReportEmail,
} from "./api";
import type { PrintOptions } from "./model";
import {
  artistsNeedingWiredMics,
  artistsWithPendingRider,
  groupArtistsByDateAndStage,
  toMissingRiderRows,
} from "./reportData";

/** The report has nothing to show for the current selection; the message says why, in Spanish. */
export class NothingToPrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NothingToPrintError";
  }
}

export interface PrintReport {
  blob: Blob;
  /** What the downloaded file is called (joined by `buildReadableFilename`). */
  filenameParts: string[];
}

export interface ReportContext {
  jobId: string | undefined;
  jobTitle: string;
  options: PrintOptions;
  /** The festival day's start; throws while it is still loading or failed to load. */
  getDayStartTime: () => string;
}

const titleOrFestival = (jobTitle: string) => jobTitle || "Festival";

const requireJobId = (jobId: string | undefined, what: string): string => {
  if (!jobId) throw new NothingToPrintError(`Se requiere el ID del trabajo para generar ${what}`);
  return jobId;
};

/** Merges the pieces into one PDF (or returns the only one). */
const mergeIfMany = async (pdfs: Blob[]): Promise<Blob> => (pdfs.length === 1 ? pdfs[0] : mergePDFs(pdfs));

const nonEmpty = (pdfs: Blob[]) => pdfs.filter((pdf) => pdf.size > 0);

export async function buildGearSetupReport(context: ReportContext): Promise<PrintReport> {
  const jobId = requireJobId(context.jobId, "el reporte de equipamiento");
  const { gearSetupStages } = context.options;
  if (gearSetupStages.length === 0) {
    throw new NothingToPrintError("No hay escenarios seleccionados para el equipamiento.");
  }
  const logoUrl = await fetchPreparedFestivalLogo(jobId);

  let blobs: Blob[];
  try {
    blobs = await Promise.all(
      gearSetupStages.map((stageNumber) => generateStageGearPDF(jobId, stageNumber, undefined, logoUrl)),
    );
  } catch (error) {
    if (error instanceof NoGearSetupError) {
      throw new NothingToPrintError("Este festival aún no tiene configuración de equipamiento.");
    }
    throw error;
  }

  if (blobs.length === 1) {
    return {
      blob: blobs[0],
      filenameParts: [titleOrFestival(context.jobTitle), `Escenario ${gearSetupStages[0]}`, "Dotación técnica"],
    };
  }
  return {
    blob: await mergePDFs(blobs),
    filenameParts: [titleOrFestival(context.jobTitle), "Dotación técnica"],
  };
}

export async function buildShiftSchedulesReport(context: ReportContext): Promise<PrintReport> {
  const jobId = requireJobId(context.jobId, "horarios de turnos");
  const dayStartTime = context.getDayStartTime();
  const logoUrl = await fetchPreparedFestivalLogo(jobId);

  const { shifts, assignments, profilesById } = await fetchShiftsForPrint(
    jobId,
    context.options.shiftScheduleStages,
  );
  if (shifts.length === 0) throw new NothingToPrintError("No hay turnos para los escenarios seleccionados.");

  const hydrated = attachShiftAssignmentsAndProfiles(shifts, assignments, profilesById);
  const shiftsByDate = new Map<string, typeof hydrated>();
  for (const shift of hydrated) {
    const day = shiftsByDate.get(shift.date);
    if (day) day.push(shift);
    else shiftsByDate.set(shift.date, [shift]);
  }

  const pdfs: Blob[] = [];
  for (const date of [...shiftsByDate.keys()].sort()) {
    const dailyShifts = shiftsByDate.get(date) ?? [];
    if (dailyShifts.length === 0) continue;
    pdfs.push(await exportShiftsTablePDF({ jobTitle: context.jobTitle, date, dayStartTime, logoUrl, shifts: dailyShifts }));
  }

  const usable = nonEmpty(pdfs);
  if (usable.length === 0) {
    throw new NothingToPrintError("No se pudieron generar PDFs de turnos para los escenarios seleccionados.");
  }
  return {
    blob: await mergeIfMany(usable),
    filenameParts: [titleOrFestival(context.jobTitle), "Horarios de turnos"],
  };
}

export async function buildArtistTablesReport(context: ReportContext): Promise<PrintReport> {
  const jobId = requireJobId(context.jobId, "tablas de artistas");
  const dayStartTime = context.getDayStartTime();
  const logoUrl = await fetchPreparedFestivalLogo(jobId);

  const artists = await fetchArtistsOnStages(jobId, context.options.artistTableStages);
  if (artists.length === 0) throw new NothingToPrintError("No hay artistas para los escenarios seleccionados.");

  const sorted = sortArtistsChronologically(artists, dayStartTime);
  const stageNames = await fetchStageNamesByNumber(jobId);

  const pdfs: Blob[] = [];
  for (const group of groupArtistsByDateAndStage(sorted)) {
    pdfs.push(
      await exportArtistTablePDF({
        jobTitle: context.jobTitle,
        date: group.date,
        dayStartTime,
        stage: String(group.stage),
        stageNames,
        logoUrl,
        artists: buildArtistTableArtists(group.artists),
      }),
    );
  }

  const usable = nonEmpty(pdfs);
  if (usable.length === 0) {
    throw new NothingToPrintError("No se pudieron generar tablas de artistas para los escenarios seleccionados.");
  }
  return {
    blob: await mergeIfMany(usable),
    filenameParts: [titleOrFestival(context.jobTitle), "Cronograma artistas"],
  };
}

export async function buildRfIemReport(context: ReportContext): Promise<PrintReport> {
  const jobId = requireJobId(context.jobId, "tabla de RF/IEM");
  const dayStartTime = context.getDayStartTime();
  const logoUrl = await fetchPreparedFestivalLogo(jobId);

  const artists = await fetchArtistsOnStages(jobId, context.options.rfIemTableStages);
  const withRfIem = buildRfIemArtists(sortArtistsChronologically(artists, dayStartTime), dayStartTime).filter(
    hasRfIemSystems,
  );
  if (withRfIem.length === 0) throw new NothingToPrintError("No hay datos RF/IEM para los escenarios seleccionados.");

  return {
    blob: await exportRfIemTablePDF({ jobTitle: context.jobTitle, dayStartTime, logoUrl, artists: withRfIem }),
    filenameParts: [titleOrFestival(context.jobTitle), "Tabla RF IEM"],
  };
}

export async function buildInfrastructureReport(context: ReportContext): Promise<PrintReport> {
  const jobId = requireJobId(context.jobId, "tabla de infraestructura");
  const dayStartTime = context.getDayStartTime();
  const logoUrl = await fetchPreparedFestivalLogo(jobId);

  const artists = await fetchArtistsOnStages(jobId, context.options.infrastructureTableStages);
  const withNeeds = buildInfrastructureArtists(sortArtistsChronologically(artists, dayStartTime)).filter(
    hasInfrastructureNeeds,
  );
  if (withNeeds.length === 0) {
    throw new NothingToPrintError("No hay necesidades de infraestructura para los escenarios seleccionados.");
  }

  return {
    blob: await exportInfrastructureTablePDF({ jobTitle: context.jobTitle, logoUrl, artists: withNeeds }),
    filenameParts: [titleOrFestival(context.jobTitle), "Tabla infraestructura"],
  };
}

export async function buildWiredMicNeedsReport(context: ReportContext): Promise<PrintReport> {
  const jobId = requireJobId(context.jobId, "necesidades de micrófonos cableados");
  const logoUrl = await fetchPreparedFestivalLogo(jobId);

  const artists = await fetchArtistsOnStages(jobId, context.options.wiredMicNeedsStages);
  const artistsByDateAndStage = organizeArtistsByDateAndStage(artistsNeedingWiredMics(artists));

  return {
    blob: await exportWiredMicrophoneMatrixPDF({ jobTitle: context.jobTitle, logoUrl, artistsByDateAndStage }),
    filenameParts: [titleOrFestival(context.jobTitle), "Necesidades micrófonos cableados"],
  };
}

export interface MissingRiderReport extends PrintReport {
  missingCount: number;
}

export async function buildMissingRiderReport(context: ReportContext): Promise<MissingRiderReport> {
  const jobId = requireJobId(context.jobId, "el reporte de riders faltantes");

  const artists = await fetchAllFestivalArtists(jobId);
  const pending = artistsWithPendingRider(artists);
  // Not knowing the stage names only means the generic "Escenario n".
  const stageNames = await fetchStageNamesByNumber(jobId).catch(() => ({}) as Record<number, string>);
  const formUrls = await getActivePublicArtistFormLinks(
    pending.map((artist) => ({ id: artist.id, form_language: artist.form_language })),
  );
  const logoUrl = (await fetchPreparedFestivalLogo(jobId)) || "";

  const blob = await exportMissingRiderReportPDF({
    jobTitle: context.jobTitle,
    logoUrl,
    artists: toMissingRiderRows(pending, (stage) => stageNames[stage] || `Escenario ${stage}`, formUrls),
  });

  return {
    blob,
    missingCount: pending.length,
    filenameParts: [titleOrFestival(context.jobTitle), "Reporte riders faltantes"],
  };
}

/** Subject and HTML body of the mail that carries the missing-rider report. */
export function buildMissingRiderEmail(jobTitle: string, missingCount: number) {
  return {
    subject: `Reporte Riders Faltantes - ${jobTitle}`,
    bodyHtml: `
        <p>Hola,</p>
        <p>Adjuntamos el <strong>Reporte de Riders Faltantes</strong> del festival <strong>${escapeHtml(jobTitle)}</strong>.</p>
        <p>Artistas con rider pendiente: <strong>${missingCount}</strong>.</p>
        <p>El PDF incluye el QR del formulario público por artista para completar la información técnica cuanto antes.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:12px;color:#6b7280;">
          Este correo es automático. Por favor, no respondas a este email. Si tienes incidencias, contacta con la oficina técnica del festival en
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>
      `,
  };
}

/** Builds the missing-rider report and mails it to the external recipients typed in the dialog. */
export async function sendMissingRiderReport(context: ReportContext, recipientsText: string): Promise<number> {
  const recipients = parseRecipientEmails(recipientsText);
  if (recipients.length === 0) {
    throw new NothingToPrintError("Añade al menos un correo externo para enviar el reporte.");
  }

  const { blob, missingCount, filenameParts } = await buildMissingRiderReport(context);
  const { subject, bodyHtml } = buildMissingRiderEmail(context.jobTitle, missingCount);
  await sendReportEmail({
    subject,
    bodyHtml,
    recipients,
    pdfAttachment: {
      filename: buildReadableFilename(filenameParts),
      content: await blobToBase64(blob),
      size: blob.size,
    },
    senderNameOverride: "Festivales - Sector Pro",
  });
  return recipients.length;
}
