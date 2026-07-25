import { PDFDocument } from 'pdf-lib';
import { deduplicateContextImages } from '@/utils/pdf/pdfImageDedup';

export interface MergeOptions {
  /**
   * Collapse identical images after merging. The festival bundle embeds the
   * same logo once per source document, so this is where most of its weight
   * comes from. Defaults to true.
   */
  deduplicateImages?: boolean;
}

export const mergePDFs = async (
  pdfBlobs: Blob[],
  options: MergeOptions = {},
): Promise<Blob> => {
  try {
    if (pdfBlobs.length === 0) {
      throw new Error('No PDFs provided for merging');
    }

    if (pdfBlobs.length === 1) {
      return pdfBlobs[0];
    }

    const mergedPdf = await PDFDocument.create();

    for (const [index, pdfBlob] of pdfBlobs.entries()) {
      if (!pdfBlob || pdfBlob.size === 0) {
        console.warn(`Se omite un PDF vacío en la posición ${index}.`);
        continue;
      }

      try {
        const sourcePdf = await PDFDocument.load(await pdfBlob.arrayBuffer(), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
        });

        const pageIndices = sourcePdf.getPageIndices();
        if (pageIndices.length === 0) {
          console.warn(`El PDF en la posición ${index} no tiene páginas.`);
          continue;
        }

        // One copy call per source document, not one per page: pdf-lib's copier
        // caches by reference within a single call, so all pages of a source
        // share its embedded fonts and images instead of duplicating them page
        // by page.
        const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
        for (const page of copiedPages) {
          mergedPdf.addPage(page);
        }
      } catch (error) {
        console.error(`No se pudo procesar el PDF en la posición ${index}:`, error);
      }
    }

    const pageCount = mergedPdf.getPageCount();
    if (pageCount === 0) {
      throw new Error('No valid pages found in the provided PDFs');
    }

    if (options.deduplicateImages !== false) {
      const { kept, removed } = deduplicateContextImages(mergedPdf.context);
      if (removed > 0) {
        console.log(`Imágenes del PDF combinado: ${kept} únicas, ${removed} copias eliminadas.`);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    return new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDF documents: ${(error as Error).message}`);
  }
};
