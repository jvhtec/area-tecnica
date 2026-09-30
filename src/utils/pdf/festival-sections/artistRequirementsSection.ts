import { exportArtistPDF } from "@/utils/artistPdfExport";
import { toArtistPdfData } from "@/features/festival-print/reportData";
import { sortArtistsChronologically } from "@/utils/pdf/festivalPdfSectionBuilders";
import { isNonEmptyBlob } from "@/utils/pdf/festivalPdfSupport";
import { runProgressJobs, type FestivalSectionContext } from "./context";

export interface ArtistSheetsSection {
  pdfs: Blob[];
  /** Artist name of each PDF, for the bundle's contents. */
  titles: string[];
}

/** One individual sheet (ficha) per artist, in show order. */
export async function generateArtistRequirementsSection(
  context: FestivalSectionContext,
): Promise<ArtistSheetsSection> {
  const { options, artists, dayStartTime, logoUrl, stagePlotUrlsByArtistId } = context;
  const section: ArtistSheetsSection = { pdfs: [], titles: [] };
  if (!options.includeArtistRequirements || artists.length === 0) return section;

  const onStages = artists.filter((artist) => options.artistRequirementStages.includes(Number(artist.stage)));
  const sorted = sortArtistsChronologically(onStages, dayStartTime);

  const generated = await runProgressJobs(
    context,
    "artist-requirements",
    { preparing: "Preparando fichas de artistas", running: "Generando fichas de artistas" },
    sorted,
    async (artist) => {
      const pdf = await exportArtistPDF(
        toArtistPdfData(artist, { logoUrl, stagePlotUrl: stagePlotUrlsByArtistId[String(artist.id)] }),
        { paginate: false },
      );
      return isNonEmptyBlob(pdf) ? { pdf, title: artist.name || "Unnamed Artist" } : null;
    },
  );

  for (const result of generated) {
    if (!result) continue;
    section.pdfs.push(result.pdf);
    section.titles.push(result.title);
  }
  return section;
}
