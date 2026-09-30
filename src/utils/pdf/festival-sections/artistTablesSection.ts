import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { groupArtistsByDateAndStage } from "@/features/festival-print/reportData";
import { buildArtistTableArtists, sortArtistsChronologically } from "@/utils/pdf/festivalPdfSectionBuilders";
import { isNonEmptyBlob } from "@/utils/pdf/festivalPdfSupport";
import { runProgressJobs, type FestivalSectionContext } from "./context";

/** One table per date and stage, in show order. */
export async function generateArtistTablesSection(context: FestivalSectionContext): Promise<Blob[]> {
  const { options, artists, dayStartTime, jobTitle, logoUrl, stageNamesByNumber } = context;
  if (!options.includeArtistTables) return [];

  const onStages = artists.filter((artist) => options.artistTableStages.includes(Number(artist.stage)));
  if (onStages.length === 0) return [];

  const groups = groupArtistsByDateAndStage(sortArtistsChronologically(onStages, dayStartTime));
  const generated = await runProgressJobs(
    context,
    "artist-tables",
    { preparing: "Preparando tablas de artistas", running: "Generando tablas de artistas" },
    groups,
    async ({ date, stage, artists: stageArtists }) => {
      const pdf = await exportArtistTablePDF({
        jobTitle,
        date,
        dayStartTime,
        stage: String(stage),
        stageNames: stageNamesByNumber,
        artists: buildArtistTableArtists(stageArtists),
        logoUrl,
        paginate: false,
      });
      return isNonEmptyBlob(pdf) ? pdf : null;
    },
  );
  return generated.filter(isNonEmptyBlob);
}
