import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { getFestivalIssuerMarkDataUrl } from '@/utils/pdf/festival-report';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const GROUND = rgb(10 / 255, 10 / 255, 9 / 255);
const ACCENT = rgb(188 / 255, 58 / 255, 58 / 255);
const PAPER = rgb(1, 1, 1);
const SOFT = rgb(150 / 255, 144 / 255, 136 / 255);

export interface SectionDividerSpec {
  /** 1-based position of the section within the set. */
  number: number;
  title: string;
  /** What the section contains, one line per entry. */
  contents?: string[];
  /** Page range covered by the section, e.g. `09 – 17`. */
  pageRange?: string;
}

/**
 * Full-bleed section divider. One per section, never more — it is what turns a
 * stack of concatenated reports into a book you can navigate by thumbing the
 * edge of the paper.
 */
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Shrinks a line until it fits, then truncates if it still cannot. */
const fitText = (
  text: string,
  font: PDFFont,
  maxSize: number,
  minSize: number,
  maxWidth: number,
): { text: string; size: number } => {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size };

  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: `${truncated.trimEnd()}...`, size };
};

export const generateSectionDivider = async (spec: SectionDividerSpec): Promise<Blob> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const display = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const body = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: GROUND });

  const issuerMark = await getFestivalIssuerMarkDataUrl('paper');
  if (issuerMark) {
    try {
      const mark = await pdfDoc.embedPng(issuerMark);
      const width = 72;
      const height = (mark.height / mark.width) * width;
      page.drawImage(mark, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - height, width, height });
    } catch (error) {
      console.warn('No se pudo añadir la marca de Sector-Pro al separador:', error);
    }
  }

  page.drawText(String(spec.number).padStart(2, '0'), {
    x: MARGIN,
    y: PAGE_HEIGHT / 2 + 40,
    size: 96,
    font: display,
    color: ACCENT,
  });

  const title = fitText(spec.title, display, 30, 14, CONTENT_WIDTH);
  page.drawText(title.text, {
    x: MARGIN,
    y: PAGE_HEIGHT / 2 - 6,
    size: title.size,
    font: display,
    color: PAPER,
  });

  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT / 2 - 30 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT / 2 - 30 },
    thickness: 0.6,
    color: ACCENT,
  });

  let y = PAGE_HEIGHT / 2 - 52;
  for (const item of (spec.contents ?? []).slice(0, 10)) {
    const line = fitText(item, body, 9, 7, CONTENT_WIDTH);
    page.drawText(line.text, { x: MARGIN, y, size: line.size, font: body, color: SOFT });
    y -= 15;
  }

  if (spec.pageRange) {
    page.drawText(`PÁGINAS ${spec.pageRange}`, {
      x: MARGIN,
      y: 62,
      size: 7,
      font: mono,
      color: SOFT,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};
