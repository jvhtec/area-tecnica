import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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

  const titleSize = spec.title.length > 34 ? 24 : 30;
  page.drawText(spec.title, {
    x: MARGIN,
    y: PAGE_HEIGHT / 2 - 6,
    size: titleSize,
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
    page.drawText(item, { x: MARGIN, y, size: 9, font: body, color: SOFT });
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
