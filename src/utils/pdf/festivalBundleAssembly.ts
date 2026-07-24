import { generateCoverPage } from './coverPageGenerator';
import { generateSectionDivider } from './sectionDividerGenerator';
import { generateTableOfContents, type TocSection } from './tocGenerator';
import { mergePDFs } from './pdfMerge';
import { stampContinuousPagination } from '@/utils/pdf/festival-report';
import {
  addTableOfContentsLinks,
  type FestivalPdfProgress,
} from '@/utils/pdf/festivalPdfSupport';

export interface FestivalBundleSection {
  title: string;
  pdfs: Blob[];
  /** Content pages only — the section divider is added by the assembler. */
  pageCount: number;
  children?: Array<{ title: string; pageCount: number }>;
  /** What the section contains, listed on its divider. */
  contents?: string[];
}

export interface FestivalBundleInput {
  artists: Array<{ stage?: unknown; date?: unknown }>;
  jobId: string;
  jobTitle: string;
  logoUrl?: string;
  sections: FestivalBundleSection[];
  reportProgress: (progress: FestivalPdfProgress) => void;
}

/**
 * Binds the generated documents into one book.
 *
 * The bundle is still assembled from independently generated PDFs, so the
 * things that make it a set rather than a stack are applied here: a cover that
 * states the issue, a contents page whose folios are the real folios, a divider
 * opening each section, and a single continuous numbering pass at the end. No
 * page in the result says "Página 1 de 1".
 */
export const assembleFestivalBundle = async ({
  artists,
  jobId,
  jobTitle,
  logoUrl,
  reportProgress,
  sections,
}: FestivalBundleInput): Promise<Blob> => {
  const tocSections: TocSection[] = sections.map((section) => ({
    title: section.title,
    pageCount: section.pageCount,
    children: section.children,
    hasDivider: true,
  }));

  const { blob: tableOfContents, links: tocLinks, pageCount: tocPageCount } =
    await generateTableOfContents(tocSections, logoUrl);

  const stageCount = new Set(
    artists.map((artist) => Number(artist.stage)).filter((stage) => Number.isFinite(stage)),
  ).size;
  const dayCount = new Set(artists.map((artist) => artist.date).filter(Boolean)).size;

  const coverPage = await generateCoverPage(jobId, jobTitle, logoUrl, {
    artistCount: artists.length,
    dayCount,
    stageCount,
  });

  // Front matter is the cover plus the contents; the first divider follows it.
  let nextPageNumber = 1 + tocPageCount + 1;
  const dividerPageNumbers: number[] = [];
  const dividers: Blob[] = [];

  for (const [index, section] of sections.entries()) {
    dividerPageNumbers.push(nextPageNumber);

    dividers.push(await generateSectionDivider({
      number: index + 1,
      title: section.title,
      contents: section.contents,
      pageRange: `${String(nextPageNumber + 1).padStart(2, '0')} – ${String(nextPageNumber + section.pageCount).padStart(2, '0')}`,
    }));

    nextPageNumber += section.pageCount + 1;
  }

  reportProgress({ phase: 'merge', completed: 2, total: 3, label: 'Combinando PDFs' });

  const merged = await mergePDFs([
    coverPage,
    tableOfContents,
    ...sections.flatMap((section, index) => [dividers[index], ...section.pdfs]),
  ]);
  const linked = await addTableOfContentsLinks(merged, tocLinks);
  // The cover and the dividers are counted but carry no folio.
  const paginated = await stampContinuousPagination(linked, {
    skipPages: [1, ...dividerPageNumbers],
  });

  reportProgress({ phase: 'merge', completed: 3, total: 3, label: 'PDF listo' });

  return paginated;
};
