import type { PrintOptions } from "@/features/festival-print/model";
import type { FestivalBundleSection } from "@/utils/pdf/festivalBundleAssembly";
import { getPdfPageCount, getTotalPages } from "@/utils/pdf/festivalPdfSupport";
import type { ArtistSheetsSection } from "./artistRequirementsSection";
import type { GearSection } from "./gearSection";

/** The generated documents of the bundle, before they are counted and ordered into sections. */
export interface GeneratedFestivalDocuments {
  shifts: Blob[];
  gear: GearSection;
  artistTables: Blob[];
  artistSheets: ArtistSheetsSection;
  rfIem: Blob | null;
  infrastructure: Blob | null;
  wiredMics: Blob | null;
  weather: Blob | null;
  missingRiders: Blob | null;
}

const pagesOf = (pdf: Blob | null): Promise<number> => (pdf ? getPdfPageCount(pdf) : Promise.resolve(0));

/**
 * A set is a book: every document becomes a section with a divider, and the contents carry the real
 * folios. Sections with no pages are left out.
 */
export async function buildBundleSections(
  documents: GeneratedFestivalDocuments,
  options: PrintOptions,
  getStageNameByNumber: (stage: number) => string,
): Promise<FestivalBundleSection[]> {
  const [shiftPages, gearPages, tablePages, sheetPages, rfIemPages, infrastructurePages, wiredMicPages, weatherPages, missingRiderPages] =
    await Promise.all([
      Promise.all(documents.shifts.map(getPdfPageCount)),
      Promise.all(documents.gear.pdfs.map(getPdfPageCount)),
      Promise.all(documents.artistTables.map(getPdfPageCount)),
      Promise.all(documents.artistSheets.pdfs.map(getPdfPageCount)),
      pagesOf(documents.rfIem),
      pagesOf(documents.infrastructure),
      pagesOf(documents.wiredMics),
      pagesOf(documents.weather),
      pagesOf(documents.missingRiders),
    ]);

  const totalShiftPages = getTotalPages(shiftPages);
  const totalGearPages = getTotalPages(gearPages);
  const totalTablePages = getTotalPages(tablePages);
  const sheetEntries = documents.artistSheets.titles
    .map((title, index) => ({ title, pageCount: sheetPages[index] || 0 }))
    .filter((entry) => entry.pageCount > 0);
  const totalSheetPages = getTotalPages(sheetEntries.map((entry) => entry.pageCount));

  const sections: FestivalBundleSection[] = [];

  if (options.includeShiftSchedules && totalShiftPages > 0) {
    sections.push({
      title: "Turnos de personal",
      pdfs: documents.shifts,
      pageCount: totalShiftPages,
      contents: ["Turnos por departamento y jornada"],
    });
  }
  if (options.includeGearSetup && totalGearPages > 0) {
    sections.push({
      title: "Dotación por escenario",
      pdfs: documents.gear.pdfs,
      pageCount: totalGearPages,
      contents: documents.gear.stages.map(getStageNameByNumber),
    });
  }
  if (options.includeArtistTables && totalTablePages > 0) {
    sections.push({
      title: "Programa del día",
      pdfs: documents.artistTables,
      pageCount: totalTablePages,
      contents: ["Gráfico de jornada y detalle por artista"],
    });
  }
  if (options.includeRfIemTable && documents.rfIem && rfIemPages > 0) {
    sections.push({
      title: "RF e IEM",
      pdfs: [documents.rfIem],
      pageCount: rfIemPages,
      contents: ["Radiofrecuencia y monitorización personal por jornada"],
    });
  }
  if (options.includeInfrastructureTable && documents.infrastructure && infrastructurePages > 0) {
    sections.push({
      title: "Infraestructura",
      pdfs: [documents.infrastructure],
      pageCount: infrastructurePages,
      contents: ["Tiradas solicitadas por artista y escenario"],
    });
  }
  if (options.includeWiredMicNeeds && documents.wiredMics && wiredMicPages > 0) {
    sections.push({
      title: "Microfonía cableada",
      pdfs: [documents.wiredMics],
      pageCount: wiredMicPages,
      contents: ["Matriz por modelo y artista, con pico y total"],
    });
  }
  if (options.includeWeatherPrediction && documents.weather && weatherPages > 0) {
    sections.push({
      title: "Previsión meteorológica",
      pdfs: [documents.weather],
      pageCount: weatherPages,
      contents: ["Previsión diaria para el recinto"],
    });
  }
  if (options.includeMissingRiderReport && documents.missingRiders && missingRiderPages > 0) {
    sections.push({
      title: "Riders pendientes",
      pdfs: [documents.missingRiders],
      pageCount: missingRiderPages,
      contents: ["Artistas sin rider recibido o con rider desactualizado"],
    });
  }
  if (options.includeArtistRequirements && totalSheetPages > 0) {
    sections.push({
      title: "Fichas de artista",
      pdfs: documents.artistSheets.pdfs,
      pageCount: totalSheetPages,
      children: sheetEntries,
      contents: [`${sheetEntries.length} fichas individuales`],
    });
  }

  return sections;
}
