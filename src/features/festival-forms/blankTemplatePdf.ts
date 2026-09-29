import { trackError } from "@/lib/errorTracking";
import { exportArtistPDF } from "@/utils/artistPdfExport";
import { buildReadableFilename } from "@/utils/fileName";
import { fetchFestivalGearOptionsForTemplate } from "@/utils/festivalGearOptions";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { generateQRCode } from "@/utils/qrcode";
import { fetchArtistForTemplate, fetchPendingArtistForm } from "./api";
import { buildBlankArtistPdfData } from "./blankTemplate";
import { buildArtistFormUrl, type FormLanguage } from "./links";

interface BlankTemplateResult {
  blob: Blob;
  fileName: string;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Blank printable form for one artist, pre-filled with their schedule and (when they have one)
 * the public form link and its QR. `formUrl` is passed by the send flow, which has just issued
 * the token; the download flow falls back to the artist's already-sent link.
 */
export async function buildArtistBlankTemplatePdf({
  artistId,
  artistName,
  selectedDate,
  jobId,
  language,
  formUrl,
}: {
  artistId: string;
  artistName: string;
  selectedDate?: string;
  jobId?: string;
  language: FormLanguage;
  formUrl?: string;
}): Promise<BlankTemplateResult> {
  if (!artistId) throw new Error("Se requiere el ID del artista");

  const artist = await fetchArtistForTemplate(artistId);
  const date = artist?.date || selectedDate || todayKey();
  const name = artist?.name || artistName || "Artista";
  const stage = typeof artist?.stage === "number" ? artist.stage : 1;

  let publicFormUrl = formUrl ?? "";
  if (!publicFormUrl) {
    // A lookup failure only means the template has no link on it.
    const pending = await fetchPendingArtistForm(artistId).catch(() => null);
    if (pending) publicFormUrl = buildArtistFormUrl(pending.token, language);
  }

  let publicFormQrDataUrl = "";
  if (publicFormUrl) {
    try {
      publicFormQrDataUrl = await generateQRCode(publicFormUrl);
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "blank-template-qr", artistId });
    }
  }

  const [logoUrl, festivalOptions] = jobId
    ? await Promise.all([fetchJobLogo(jobId), fetchFestivalGearOptionsForTemplate(jobId, stage)])
    : [undefined, undefined];

  const blob = await exportArtistPDF(
    buildBlankArtistPdfData({
      forArtist: true,
      name,
      stage,
      date,
      schedule: {
        loadIn: artist?.load_in_time || "",
        show: { start: artist?.show_start || "", end: artist?.show_end || "" },
        soundcheck: artist?.soundcheck
          ? {
              date: artist.soundcheck_date || date,
              start: artist.soundcheck_start || "",
              end: artist.soundcheck_end || "",
            }
          : undefined,
        lineCheck: artist?.line_check
          ? { start: artist.line_check_start || "", end: artist.line_check_end || "" }
          : undefined,
      },
      logoUrl,
      festivalOptions,
      publicFormUrl,
      publicFormQrDataUrl,
    }),
    { templateMode: true, language },
  );

  return {
    blob,
    fileName: buildReadableFilename([language === "en" ? "Template" : "Plantilla", name, date]),
  };
}

/** Blank printable form for a whole festival date and stage (not tied to one artist). */
export async function buildStageBlankTemplatePdf({
  jobId,
  date,
  stage,
}: {
  jobId: string;
  date: string;
  stage: number;
}): Promise<BlankTemplateResult> {
  const [logoUrl, festivalOptions] = await Promise.all([
    fetchJobLogo(jobId),
    fetchFestivalGearOptionsForTemplate(jobId, stage),
  ]);

  const blob = await exportArtistPDF(
    buildBlankArtistPdfData({
      name: "Plantilla Artista",
      stage,
      date,
      schedule: { loadIn: "", show: { start: "", end: "" }, lineCheck: { start: "", end: "" } },
      logoUrl,
      festivalOptions,
    }),
    { templateMode: true },
  );

  return { blob, fileName: buildReadableFilename(["Plantilla en blanco artista", date]) };
}
