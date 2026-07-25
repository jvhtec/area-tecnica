import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const MM_TO_PT = 2.834645669291339;

/** Footer slot geometry, mirroring `festivalGeometry` in tokens.ts. */
const PORTRAIT_FOOTER = { rightInset: 16.4, textFromTop: 282 } as const;
const LANDSCAPE_FOOTER = { rightInset: 16, textFromTop: 195.5 } as const;

export interface ContinuousPaginationOptions {
  /**
   * Pages to leave unnumbered, 1-based. The cover carries no folio; section
   * dividers carry their own numbering in the divider design.
   */
  skipPages?: number[];
  /**
   * Page number printed on the first numbered page. Front matter is counted so
   * the folio on the page always matches the folio in the contents.
   */
  startAt?: number;
}

/**
 * Stamps `NN / NN` into the footer slot of every page of a merged document.
 *
 * The festival bundle is assembled from many independently generated PDFs. Each
 * one leaves the page-number slot empty when it is generated as part of a set,
 * and this pass fills it with the set's own continuous numbering — so a page
 * never says `Página 1 de 1` in a 40-page document, and the number on the page
 * is the number in the contents.
 */
export const stampContinuousPagination = async (
  pdfBlob: Blob,
  options: ContinuousPaginationOptions = {},
): Promise<Blob> => {
  try {
    const pdfDoc = await PDFDocument.load(await pdfBlob.arrayBuffer());
    const pages = pdfDoc.getPages();
    if (pages.length === 0) return pdfBlob;

    const skip = new Set(options.skipPages ?? []);
    const startAt = options.startAt ?? 1;

    const font = await pdfDoc.embedFont(StandardFonts.CourierBold);
    const ink = rgb(23 / 255, 20 / 255, 15 / 255);
    const faint = rgb(183 / 255, 176 / 255, 166 / 255);
    const size = 7.5;

    // Skipped pages still consume a number — the cover and the section dividers
    // are counted but carry no folio, so every printed number keeps matching
    // the number the contents page points at.
    const lastNumber = startAt + pages.length - 1;
    const totalLabel = ` / ${String(lastNumber).padStart(2, '0')}`;
    const totalWidth = font.widthOfTextAtSize(totalLabel, size);

    pages.forEach((page, index) => {
      const current = startAt + index;
      if (skip.has(index + 1)) return;

      const { width, height } = page.getSize();
      const spec = width > height ? LANDSCAPE_FOOTER : PORTRAIT_FOOTER;
      const right = width - spec.rightInset * MM_TO_PT;
      const baseline = height - spec.textFromTop * MM_TO_PT;

      const currentLabel = String(current).padStart(2, '0');
      const currentWidth = font.widthOfTextAtSize(currentLabel, size);

      page.drawText(currentLabel, {
        x: right - totalWidth - currentWidth,
        y: baseline,
        size,
        font,
        color: ink,
      });
      page.drawText(totalLabel, {
        x: right - totalWidth,
        y: baseline,
        size,
        font,
        color: faint,
      });
    });

    const bytes = await pdfDoc.save();
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  } catch (error) {
    console.error('No se pudo numerar el documento combinado:', error);
    return pdfBlob;
  }
};
