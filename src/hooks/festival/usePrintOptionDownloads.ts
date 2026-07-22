/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { toast } from "sonner";

import { dataLayerClient } from "@/services/dataLayerClient";
import {
  exportMissingRiderReportPDF,
  type MissingRiderReportData,
} from "@/utils/missingRiderReportPdfExport";
import {
  exportArtistTablePDF,
  type ArtistTablePdfData,
} from "@/utils/artistTablePdfExport";
import {
  exportShiftsTablePDF,
  type ShiftsTablePdfData,
} from "@/utils/shiftsTablePdfExport";
import {
  exportRfIemTablePDF,
  type RfIemTablePdfData,
} from "@/utils/rfIemTablePdfExport";
import {
  exportInfrastructureTablePDF,
  type InfrastructureTablePdfData,
} from "@/utils/infrastructureTablePdfExport";
import {
  exportWiredMicrophoneMatrixPDF,
  type WiredMicrophoneMatrixData,
  organizeArtistsByDateAndStage,
} from "@/utils/wiredMicrophoneNeedsPdfExport";
import { generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { mergePDFs } from "@/utils/pdf/pdfMerge";
import { fetchJobLogo, fetchLogoUrl } from "@/utils/pdf/logoUtils";
import { ensurePublicArtistFormLinks } from "@/utils/publicArtistFormLinks";
import { buildReadableFilename } from "@/utils/fileName";
import { getArtistRiderStatus } from "@/features/festival-management/selectors";
import {
  attachShiftAssignmentsAndProfiles,
  buildArtistTableArtists,
  buildInfrastructureArtists,
  buildRfIemArtists,
  hasInfrastructureNeeds,
  hasRfIemSystems,
  sortArtistsChronologically,
} from "@/utils/pdf/festivalPdfSectionBuilders";
import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";

type Options = { jobId?: string; jobTitle: string; options: PrintOptions };

const parseRecipientEmails = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,\n;]+/)
        .map((email) => email.trim())
        .filter(Boolean)
    )
  );
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        char
      ] || char)
  );
const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      if (!base64)
        return reject(new Error("No se pudo convertir el PDF a base64"));
      resolve(base64);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(blob);
  });

const downloadBlob = (blob: Blob, filenameParts: Array<unknown>, extension?: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildReadableFilename(filenameParts, extension);
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
};

export const usePrintOptionDownloads = ({
  jobId,
  jobTitle,
  options,
}: Options) => {
  const [missingRiderRecipientEmails, setMissingRiderRecipientEmails] =
    useState("");
  const [isSendingMissingRiderEmail, setIsSendingMissingRiderEmail] =
    useState(false);
  const buildMissingRiderReport = async () => {
    if (!jobId) {
      throw new Error(
        "Se requiere el ID del trabajo para generar el reporte de riders faltantes"
      );
    }

    console.log("Generating Missing Rider Report for job:", jobId);

    // Fetch festival artists
    const { data: artists, error } = await dataLayerClient
      .from("festival_artists")
      .select("*")
      .eq("job_id", jobId);

    if (error) {
      console.error("Error fetching artists:", error);
      throw error;
    }

    const missingRiderArtists =
      artists?.filter(
        (artist) => getArtistRiderStatus(artist) !== "complete"
      ) || [];

    const { data: stageRows } = await dataLayerClient
      .from("festival_stages")
      .select("number, name")
      .eq("job_id", jobId);
    const stageNameByNumber = new Map<number, string>(
      (stageRows || []).map((row) => [
        Number(row.number),
        row.name || `Escenario ${row.number}`,
      ])
    );

    const publicFormLinksByArtistId = await ensurePublicArtistFormLinks(
      missingRiderArtists.map((artist) => ({
        id: artist.id,
        form_language: artist.form_language,
      }))
    );

    console.log(
      `Found ${missingRiderArtists.length} artists with missing riders out of ${
        artists?.length || 0
      } total artists`
    );

    // Fetch logo (festival first, fallback to tour/job resolution)
    const logoUrl = (await fetchJobLogo(jobId)) || "";

    // Prepare data for PDF
    const missingRiderData: MissingRiderReportData = {
      jobTitle,
      logoUrl,
      artists: missingRiderArtists.map((artist) => ({
        id: artist.id,
        name: artist.name || "Unnamed Artist",
        stage: artist.stage || 1,
        stageName:
          stageNameByNumber.get(Number(artist.stage || 1)) ||
          `Escenario ${artist.stage || 1}`,
        date: artist.date || "",
        showTime: {
          start: artist.show_start || "",
          end: artist.show_end || "",
        },
        formUrl: publicFormLinksByArtistId[artist.id],
        status:
          getArtistRiderStatus(artist) === "missing"
            ? ("missing" as const)
            : ("outdated" as const),
        copiedFromDate: artist.rider_copied_from_date || undefined,
      })),
    };

    // Generate PDF
    const pdfBlob = await exportMissingRiderReportPDF(missingRiderData);

    return {
      pdfBlob,
      missingCount: missingRiderArtists.length,
    };
  };

  const handleDownloadMissingRiderReport = async () => {
    try {
      const { pdfBlob } = await buildMissingRiderReport();

      downloadBlob(pdfBlob, [
        jobTitle || "Festival",
        "Reporte riders faltantes",
      ]);

      toast.success("Reporte de Riders Faltantes descargado exitosamente");
    } catch (error: any) {
      console.error("Error generating Missing Rider Report:", error);
      toast.error(
        `Error al generar Reporte de Riders Faltantes: ${error.message}`
      );
    }
  };

  const handleSendMissingRiderReport = async () => {
    const recipients = parseRecipientEmails(missingRiderRecipientEmails);
    if (recipients.length === 0) {
      toast.error("Añade al menos un correo externo para enviar el reporte.");
      return;
    }

    setIsSendingMissingRiderEmail(true);
    try {
      const { pdfBlob, missingCount } = await buildMissingRiderReport();
      const pdfBase64 = await blobToBase64(pdfBlob);
      const pdfFilename = buildReadableFilename([
        jobTitle || "Festival",
        "Reporte riders faltantes",
      ]);

      const bodyHtml = `
        <p>Hola,</p>
        <p>Adjuntamos el <strong>Reporte de Riders Faltantes</strong> del festival <strong>${escapeHtml(
          jobTitle
        )}</strong>.</p>
        <p>Artistas con rider pendiente: <strong>${missingCount}</strong>.</p>
        <p>El PDF incluye el QR del formulario público por artista para completar la información técnica cuanto antes.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:12px;color:#6b7280;">
          Este correo es automático. Por favor, no respondas a este email. Si tienes incidencias, contacta con la oficina técnica del festival en
          <a href="mailto:sonido@sector-pro.com">sonido@sector-pro.com</a>.
        </p>
      `;

      const { data, error } = await dataLayerClient.functions.invoke(
        "send-corporate-email",
        {
          body: {
            subject: `Reporte Riders Faltantes - ${jobTitle}`,
            bodyHtml,
            recipients: { emails: recipients },
            pdfAttachments: [
              {
                filename: pdfFilename,
                content: pdfBase64,
                size: pdfBlob.size,
              },
            ],
            senderNameOverride: "Festivales - Sector Pro",
          },
        }
      );

      if (error) {
        throw error;
      }
      if (!data?.success) {
        throw new Error(data?.error || "No se pudo enviar el correo");
      }

      toast.success(`Reporte enviado a ${recipients.length} destinatario(s).`);
    } catch (error: any) {
      console.error("Error sending Missing Rider Report email:", error);
      toast.error(
        `Error al enviar reporte de riders faltantes: ${error.message}`
      );
    } finally {
      setIsSendingMissingRiderEmail(false);
    }
  };

  const handleDownloadGearSetup = async () => {
    if (!jobId) {
      toast.error(
        "Se requiere el ID del trabajo para generar el reporte de equipamiento"
      );
      return;
    }

    try {
      console.log("Downloading Gear Setup for job:", jobId);

      const logoUrl =
        (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));

      // Generate gear setup PDF for selected stages
      const stagePromises = options.gearSetupStages.map(async (stageNumber) => {
        return await generateStageGearPDF(
          jobId,
          stageNumber,
          undefined,
          logoUrl
        );
      });

      const gearBlobs = await Promise.all(stagePromises);
      if (gearBlobs.length === 0) {
        throw new Error("No se pudo generar ningún PDF de equipamiento.");
      }

      if (gearBlobs.length === 1) {
        // Single stage - download directly
        downloadBlob(gearBlobs[0], [
          jobTitle || "Festival",
          `Escenario ${options.gearSetupStages[0]}`,
          "Dotación técnica",
        ]);
      } else {
        // Multiple stages - merge and download
        const mergedBlob = await mergePDFs(gearBlobs);

        downloadBlob(mergedBlob, [
          jobTitle || "Festival",
          "Dotación técnica",
        ]);
      }

      toast.success("Equipamiento descargado exitosamente");
    } catch (error: any) {
      console.error("Error generating Gear Setup:", error);
      toast.error(`Error al generar Equipamiento: ${error.message}`);
    }
  };

  const handleDownloadShiftSchedules = async () => {
    if (!jobId) {
      toast.error(
        "Se requiere el ID del trabajo para generar horarios de turnos"
      );
      return;
    }

    try {
      console.log("Downloading Shift Schedules for job:", jobId);

      const logoUrl =
        (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));

      const { data: shifts, error } = await dataLayerClient
        .from("festival_shifts")
        .select(
          "id, job_id, name, date, start_time, end_time, department, stage"
        )
        .eq("job_id", jobId)
        .order("date")
        .order("start_time");

      if (error) throw error;
      const filteredShifts = (shifts || []).filter(
        (shift) =>
          !shift.stage ||
          options.shiftScheduleStages.includes(Number(shift.stage))
      );
      if (filteredShifts.length === 0) {
        toast.error("No hay turnos para los escenarios seleccionados.");
        return;
      }

      const shiftIds = filteredShifts.map((shift) => shift.id);
      const { data: assignments, error: assignmentsError } =
        await dataLayerClient
          .from("festival_shift_assignments")
          .select("id, shift_id, technician_id, external_technician_name, role")
          .in("shift_id", shiftIds);

      if (assignmentsError) throw assignmentsError;

      const technicianIds = Array.from(
        new Set(
          (assignments || [])
            .map((assignment) => assignment.technician_id)
            .filter((technicianId): technicianId is string =>
              Boolean(technicianId)
            )
        )
      );

      let profilesById = new Map<
        string,
        {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          department: string | null;
          role: string | null;
        }
      >();

      if (technicianIds.length > 0) {
        const { data: profiles, error: profilesError } = await dataLayerClient
          .from("profiles")
          .select("id, first_name, last_name, email, department, role")
          .in("id", technicianIds);
        if (profilesError) throw profilesError;
        profilesById = new Map(
          (profiles || []).map((profile) => [profile.id, profile])
        );
      }

      const hydratedShifts = attachShiftAssignmentsAndProfiles(
        filteredShifts,
        assignments || [],
        profilesById
      );
      const shiftsByDate = new Map<string, typeof hydratedShifts>();
      for (const shift of hydratedShifts) {
        if (!shiftsByDate.has(shift.date)) shiftsByDate.set(shift.date, []);
        shiftsByDate.get(shift.date)?.push(shift);
      }

      const sortedDates = [...shiftsByDate.keys()].sort();
      const shiftPdfs: Blob[] = [];

      for (const date of sortedDates) {
        const dailyShifts = shiftsByDate.get(date) || [];
        if (dailyShifts.length === 0) continue;
        const shiftsData: ShiftsTablePdfData = {
          jobTitle,
          date,
          logoUrl,
          shifts: dailyShifts,
        };
        const pdfBlob = await exportShiftsTablePDF(shiftsData);
        if (pdfBlob.size > 0) {
          shiftPdfs.push(pdfBlob);
        }
      }

      if (shiftPdfs.length === 0) {
        toast.error(
          "No se pudieron generar PDFs de turnos para los escenarios seleccionados."
        );
        return;
      }

      const outputBlob =
        shiftPdfs.length === 1 ? shiftPdfs[0] : await mergePDFs(shiftPdfs);
      downloadBlob(outputBlob, [
        jobTitle || "Festival",
        "Horarios de turnos",
      ]);

      toast.success("Horarios de Turnos descargados exitosamente");
    } catch (error: any) {
      console.error("Error generating Shift Schedules:", error);
      toast.error(`Error al generar Horarios de Turnos: ${error.message}`);
    }
  };

  const handleDownloadArtistTables = async () => {
    if (!jobId) {
      toast.error(
        "Se requiere el ID del trabajo para generar tablas de artistas"
      );
      return;
    }

    try {
      console.log("Downloading Artist Tables for job:", jobId);

      const logoUrl =
        (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));

      // Fetch artists data
      const { data: artists, error } = await dataLayerClient
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .in("stage", options.artistTableStages)
        .order("date")
        .order("stage")
        .order("show_start");

      if (error) throw error;
      if (!artists || artists.length === 0) {
        toast.error("No hay artistas para los escenarios seleccionados.");
        return;
      }

      const sortedArtists = sortArtistsChronologically(artists);
      const { data: stageRows, error: stageError } = await dataLayerClient
        .from("festival_stages")
        .select("number, name")
        .eq("job_id", jobId);
      if (stageError) throw stageError;

      const stageNames = (stageRows || []).reduce((acc, stage) => {
        acc[Number(stage.number)] = stage.name || `Escenario ${stage.number}`;
        return acc;
      }, {} as Record<number, string>);

      const artistsByDateAndStage = new Map<
        string,
        Map<number, Record<string, unknown>[]>
      >();
      for (const artist of sortedArtists) {
        const date = String(artist.date || "");
        const stage = Number(artist.stage || 1);
        if (!artistsByDateAndStage.has(date))
          artistsByDateAndStage.set(date, new Map());
        const byStage = artistsByDateAndStage.get(date)!;
        if (!byStage.has(stage)) byStage.set(stage, []);
        byStage.get(stage)!.push(artist as unknown as Record<string, unknown>);
      }

      const artistTablePdfs: Blob[] = [];
      for (const [date, byStage] of artistsByDateAndStage.entries()) {
        for (const [stage, stageArtists] of byStage.entries()) {
          const artistData: ArtistTablePdfData = {
            jobTitle,
            date,
            stage: String(stage),
            stageNames,
            logoUrl,
            artists: buildArtistTableArtists(stageArtists),
          };

          const pdfBlob = await exportArtistTablePDF(artistData);
          if (pdfBlob.size > 0) artistTablePdfs.push(pdfBlob);
        }
      }

      if (artistTablePdfs.length === 0) {
        toast.error(
          "No se pudieron generar tablas de artistas para los escenarios seleccionados."
        );
        return;
      }

      const outputBlob =
        artistTablePdfs.length === 1
          ? artistTablePdfs[0]
          : await mergePDFs(artistTablePdfs);
      downloadBlob(outputBlob, [
        jobTitle || "Festival",
        "Cronograma artistas",
      ]);

      toast.success("Tablas de Artistas descargadas exitosamente");
    } catch (error: any) {
      console.error("Error generating Artist Tables:", error);
      toast.error(`Error al generar Tablas de Artistas: ${error.message}`);
    }
  };

  const handleDownloadRfIemTable = async () => {
    if (!jobId) {
      toast.error("Se requiere el ID del trabajo para generar tabla de RF/IEM");
      return;
    }

    try {
      console.log("Downloading RF/IEM Table for job:", jobId);

      const logoUrl =
        (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));

      // Fetch artists data
      const { data: artists, error } = await dataLayerClient
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .in("stage", options.rfIemTableStages)
        .order("date")
        .order("stage")
        .order("show_start");

      if (error) throw error;

      const sortedArtists = sortArtistsChronologically(
        (artists || []) as any[]
      );
      const normalizedArtists = buildRfIemArtists(
        sortedArtists as unknown as Record<string, unknown>[]
      );
      const artistsWithRfIem = normalizedArtists.filter(hasRfIemSystems);
      if (artistsWithRfIem.length === 0) {
        toast.error("No hay datos RF/IEM para los escenarios seleccionados.");
        return;
      }

      const rfIemData: RfIemTablePdfData = {
        jobTitle,
        logoUrl,
        artists: artistsWithRfIem,
      };

      const pdfBlob = await exportRfIemTablePDF(rfIemData);

      downloadBlob(pdfBlob, [
        jobTitle || "Festival",
        "Tabla RF IEM",
      ]);

      toast.success("Tabla de RF/IEM descargada exitosamente");
    } catch (error: any) {
      console.error("Error generating RF/IEM Table:", error);
      toast.error(`Error al generar Tabla de RF/IEM: ${error.message}`);
    }
  };

  const handleDownloadInfrastructureTable = async () => {
    if (!jobId) {
      toast.error(
        "Se requiere el ID del trabajo para generar tabla de infraestructura"
      );
      return;
    }

    try {
      console.log("Downloading Infrastructure Table for job:", jobId);

      const logoUrl =
        (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));

      // Fetch artists data
      const { data: artists, error } = await dataLayerClient
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .in("stage", options.infrastructureTableStages)
        .order("date")
        .order("stage")
        .order("show_start");

      if (error) throw error;

      const sortedArtists = sortArtistsChronologically(
        (artists || []) as any[]
      );
      const normalizedInfrastructureArtists = buildInfrastructureArtists(
        sortedArtists as unknown as Record<string, unknown>[]
      );
      const artistsWithInfrastructure = normalizedInfrastructureArtists.filter(
        hasInfrastructureNeeds
      );
      if (artistsWithInfrastructure.length === 0) {
        toast.error(
          "No hay necesidades de infraestructura para los escenarios seleccionados."
        );
        return;
      }

      const infraData: InfrastructureTablePdfData = {
        jobTitle,
        logoUrl,
        artists: artistsWithInfrastructure,
      };

      const pdfBlob = await exportInfrastructureTablePDF(infraData);

      downloadBlob(pdfBlob, [
        jobTitle || "Festival",
        "Tabla infraestructura",
      ]);

      toast.success("Tabla de Infraestructura descargada exitosamente");
    } catch (error: any) {
      console.error("Error generating Infrastructure Table:", error);
      toast.error(
        `Error al generar Tabla de Infraestructura: ${error.message}`
      );
    }
  };

  const handleDownloadWiredMicNeeds = async () => {
    if (!jobId) {
      toast.error(
        "Se requiere el ID del trabajo para generar necesidades de micrófonos cableados"
      );
      return;
    }

    try {
      console.log("Downloading Wired Microphone Needs for job:", jobId);

      const logoUrl = await fetchLogoUrl(jobId);

      // Fetch artists data
      const { data: artists, error } = await dataLayerClient
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .in("stage", options.wiredMicNeedsStages)
        .order("date")
        .order("stage")
        .order("show_start");

      if (error) throw error;

      const filteredArtists =
        artists?.filter(
          (artist) =>
            (artist.mic_kit === "festival" || artist.mic_kit === "mixed") &&
            artist.wired_mics &&
            Array.isArray(artist.wired_mics) &&
            artist.wired_mics.length > 0
        ) || [];

      const organizedData = organizeArtistsByDateAndStage(filteredArtists);

      const wiredMicData: WiredMicrophoneMatrixData = {
        jobTitle,
        logoUrl,
        artistsByDateAndStage: organizedData,
      };

      const pdfBlob = await exportWiredMicrophoneMatrixPDF(wiredMicData);

      downloadBlob(pdfBlob, [
        jobTitle || "Festival",
        "Necesidades micrófonos cableados",
      ]);

      toast.success(
        "Necesidades de Micrófonos Cableados descargadas exitosamente"
      );
    } catch (error: any) {
      console.error("Error generating Wired Microphone Needs:", error);
      toast.error(
        `Error al generar Necesidades de Micrófonos Cableados: ${error.message}`
      );
    }
  };

  return {
    handleDownloadArtistTables,
    handleDownloadGearSetup,
    handleDownloadInfrastructureTable,
    handleDownloadMissingRiderReport,
    handleDownloadRfIemTable,
    handleDownloadShiftSchedules,
    handleDownloadWiredMicNeeds,
    handleSendMissingRiderReport,
    isSendingMissingRiderEmail,
    missingRiderRecipientEmails,
    setMissingRiderRecipientEmails,
  };
};
