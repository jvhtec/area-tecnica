import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import type { TocLinkRegion } from "@/utils/pdf/tocGenerator";

export const addTableOfContentsLinks = async (mergedBlob: Blob, links: TocLinkRegion[]): Promise<Blob> => {
  if (links.length === 0) return mergedBlob;

  const mergedBytes = await mergedBlob.arrayBuffer();
  const mergedPdf = await PDFDocument.load(mergedBytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });

  for (const link of links) {
    const tocPage = mergedPdf.getPage(1 + link.pageIndex);
    const destinationPage = mergedPdf.getPage(link.targetPage - 1);

    if (!tocPage || !destinationPage) continue;

    const context = mergedPdf.context;
    const destination = context.obj([
      destinationPage.ref,
      PDFName.of('XYZ'),
      null,
      null,
      null,
    ]);

    const action = context.obj({
      Type: 'Action',
      S: 'GoTo',
      D: destination,
    });

    const annotation = context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [link.x, link.y, link.x + link.width, link.y + link.height],
      Border: [0, 0, 0],
      A: action,
    });

    const pageNode = tocPage.node;
    const existingAnnots = pageNode.lookupMaybe(PDFName.of('Annots'), PDFArray);

    if (existingAnnots) {
      existingAnnots.push(annotation);
    } else {
      pageNode.set(PDFName.of('Annots'), context.obj([annotation]));
    }
  }

  const linkedPdfBytes = await mergedPdf.save();
  return new Blob([new Uint8Array(linkedPdfBytes)], { type: 'application/pdf' });
};

export const getPdfPageCount = async (pdf: Blob): Promise<number> => {
  try {
    const bytes = await pdf.arrayBuffer();
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
    return doc.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    return 0;
  }
};

export const getTotalPages = (pageCounts: number[]): number =>
  pageCounts.reduce((total, count) => total + count, 0);

export type FestivalPdfProgressPhase =
  | "gear-setup"
  | "shift-schedules"
  | "artist-tables"
  | "artist-requirements"
  | "merge";

export interface FestivalPdfProgress {
  phase: FestivalPdfProgressPhase;
  completed: number;
  total: number;
  label: string;
}

export interface FestivalPdfGenerationOptions {
  concurrency?: number;
  onProgress?: (progress: FestivalPdfProgress) => void;
}

export const DEFAULT_PDF_GENERATION_CONCURRENCY = 4;
export const MAX_PDF_GENERATION_CONCURRENCY = 6;

export const clampPdfConcurrency = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PDF_GENERATION_CONCURRENCY;
  }
  return Math.max(1, Math.min(MAX_PDF_GENERATION_CONCURRENCY, Math.floor(value)));
};

export const runWithConcurrency = async <T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> => {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

export const isNonEmptyBlob = (value: Blob | null | undefined): value is Blob =>
  Boolean(value && value.size > 0);
