import { exportInfrastructureTablePDF } from "@/utils/infrastructureTablePdfExport";
import { exportMissingRiderReportPDF } from "@/utils/missingRiderReportPdfExport";
import { exportRfIemTablePDF } from "@/utils/rfIemTablePdfExport";
import { exportWiredMicrophoneMatrixPDF, organizeArtistsByDateAndStage } from "@/utils/wiredMicrophoneNeedsPdfExport";
import { getActivePublicArtistFormLinks } from "@/utils/publicArtistFormLinks";
import {
  artistsNeedingWiredMics,
  artistsWithPendingRider,
  toMissingRiderRows,
} from "@/features/festival-print/reportData";
import {
  buildInfrastructureArtists,
  buildRfIemArtists,
  hasRfIemSystems,
  sortArtistsChronologically,
} from "@/utils/pdf/festivalPdfSectionBuilders";
import { attemptSection, type FestivalSectionContext } from "./context";

/** The artists of the festival on the stages a section was asked for, in show order. */
const artistsOnStages = (context: FestivalSectionContext, stages: readonly number[]) =>
  sortArtistsChronologically(
    context.artists.filter((artist) => stages.includes(Number(artist.stage))),
    context.dayStartTime,
  );

export const generateRfIemSection = (context: FestivalSectionContext): Promise<Blob | null> =>
  attemptSection(context, "bundle-rf-iem", async () => {
    const { options, jobTitle, dayStartTime, logoUrl } = context;
    if (!options.includeRfIemTable || context.artists.length === 0) return null;

    const artists = artistsOnStages(context, options.rfIemTableStages);
    // The exporter throws when nobody has RF/IEM; that is "nothing to include", not a failure.
    const withRfIem = buildRfIemArtists(artists, dayStartTime).filter(hasRfIemSystems);
    if (withRfIem.length === 0) return null;

    return exportRfIemTablePDF({ jobTitle, dayStartTime, logoUrl, artists: withRfIem, paginate: false });
  });

export const generateInfrastructureSection = (context: FestivalSectionContext): Promise<Blob | null> =>
  attemptSection(context, "bundle-infrastructure", async () => {
    const { options, jobTitle, logoUrl } = context;
    if (!options.includeInfrastructureTable || context.artists.length === 0) return null;

    const artists = artistsOnStages(context, options.infrastructureTableStages);
    if (artists.length === 0) return null;

    return exportInfrastructureTablePDF({
      jobTitle,
      logoUrl,
      artists: buildInfrastructureArtists(artists),
      paginate: false,
    });
  });

export const generateWiredMicSection = (context: FestivalSectionContext): Promise<Blob | null> =>
  attemptSection(context, "bundle-wired-mics", async () => {
    const { options, jobTitle, logoUrl } = context;
    if (!options.includeWiredMicNeeds || context.artists.length === 0) return null;

    const artists = artistsNeedingWiredMics(
      context.artists.filter((artist) => options.wiredMicNeedsStages.includes(Number(artist.stage))),
    );
    if (artists.length === 0) return null;

    return exportWiredMicrophoneMatrixPDF({
      jobTitle,
      logoUrl,
      artistsByDateAndStage: organizeArtistsByDateAndStage(artists),
      paginate: false,
    });
  });

/** With no artists at all the report is still produced, as an all-complete statement. */
export const generateMissingRiderSection = (context: FestivalSectionContext): Promise<Blob | null> =>
  attemptSection(context, "bundle-missing-riders", async () => {
    const { options, jobTitle, logoUrl, dayStartTime, artists, getStageNameByNumber } = context;
    if (!options.includeMissingRiderReport) return null;

    const pending = sortArtistsChronologically(artistsWithPendingRider(artists), dayStartTime);
    const formUrls = await getActivePublicArtistFormLinks(
      pending.map((artist) => ({ id: artist.id, form_language: artist.form_language })),
    );

    return exportMissingRiderReportPDF({
      jobTitle,
      logoUrl,
      paginate: false,
      artists: toMissingRiderRows(pending, getStageNameByNumber, formUrls),
    });
  });
