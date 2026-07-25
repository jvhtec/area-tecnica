import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { getFestivalIssuerMarkDataUrl } from '@/utils/pdf/festival-report';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MM_TO_PT = 2.834645669291339;
/** Mirrors `festivalGeometry` (portrait) so the contents sits on the set's grid. */
const LEFT = 25.4 * MM_TO_PT;
const RIGHT = PAGE_WIDTH - 16.4 * MM_TO_PT;
const HEADER_RULE_Y = PAGE_HEIGHT - 26 * MM_TO_PT;
const CONTENT_TOP_Y = PAGE_HEIGHT - 40 * MM_TO_PT;
const FOOTER_RULE_Y = PAGE_HEIGHT - 278.5 * MM_TO_PT;
const CONTENT_BOTTOM_Y = PAGE_HEIGHT - 268 * MM_TO_PT;

const INK = rgb(23 / 255, 20 / 255, 15 / 255);
const SOFT = rgb(122 / 255, 115 / 255, 106 / 255);
const FAINT = rgb(183 / 255, 176 / 255, 166 / 255);
const ACCENT = rgb(125 / 255, 1 / 255, 1 / 255);
const RULE = rgb(228 / 255, 223 / 255, 214 / 255);

export type TocChildEntry = {
  title: string;
  pageCount: number;
};

export type TocSection = {
  title: string;
  /** Content pages only — the divider, when present, is counted by this generator. */
  pageCount: number;
  children?: TocChildEntry[];
  /** True when a full-page divider precedes the section's content. */
  hasDivider?: boolean;
};

export type TocLinkRegion = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  targetPage: number;
};

export type TocGenerationResult = {
  blob: Blob;
  links: TocLinkRegion[];
  pageCount: number;
};

type TocLine = {
  title: string;
  indent: number;
  targetPage: number;
  /** Section number, drawn in the accent to the left of top-level titles. */
  marker?: string;
};

const LINE_HEIGHT = 19;
const CHILD_LINE_HEIGHT = 15;

const drawContentsChrome = (
  page: PDFPage,
  fonts: { display: PDFFont; mono: PDFFont },
  issuerMark?: PDFImage | null,
): void => {
  if (issuerMark) {
    const width = 68;
    const height = (issuerMark.height / issuerMark.width) * width;
    page.drawImage(issuerMark, {
      x: LEFT,
      y: HEADER_RULE_Y + 6.4 * MM_TO_PT - height * 0.78,
      width,
      height,
    });
  } else {
    page.drawText('SECTOR-PRO', {
      x: LEFT,
      y: HEADER_RULE_Y + 6.4 * MM_TO_PT,
      size: 8.5,
      font: fonts.display,
      color: INK,
    });
  }
  page.drawText('CONTENIDO', {
    x: RIGHT - fonts.mono.widthOfTextAtSize('CONTENIDO', 5.6),
    y: HEADER_RULE_Y + 6.4 * MM_TO_PT,
    size: 5.6,
    font: fonts.mono,
    color: SOFT,
  });
  page.drawLine({
    start: { x: LEFT, y: HEADER_RULE_Y },
    end: { x: RIGHT, y: HEADER_RULE_Y },
    thickness: 0.35 * MM_TO_PT,
    color: ACCENT,
  });
  page.drawLine({
    start: { x: LEFT, y: FOOTER_RULE_Y },
    end: { x: RIGHT, y: FOOTER_RULE_Y },
    thickness: 0.25 * MM_TO_PT,
    color: RULE,
  });
  page.drawText('SECTOR-PRO  ·  DOCUMENTACIÓN DEL FESTIVAL', {
    x: LEFT,
    y: PAGE_HEIGHT - 282 * MM_TO_PT,
    size: 5.6,
    font: fonts.mono,
    color: SOFT,
  });
};

const truncate = (text: string, font: PDFFont, size: number, maxWidth: number): string => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}...`;
};

/**
 * Contents page for the festival set.
 *
 * The page number printed on a page must be the page number in this index, so
 * the offsets here account for the cover, the contents itself and any section
 * dividers inserted ahead of a section's content.
 */
export const generateTableOfContents = async (
  sections: TocSection[],
  logoUrl?: string,
): Promise<TocGenerationResult> => {
  const usableHeight = CONTENT_TOP_Y - 46 - CONTENT_BOTTOM_Y;
  const totalHeight = sections.reduce(
    (sum, section) =>
      sum + LINE_HEIGHT + (section.children?.length ?? 0) * CHILD_LINE_HEIGHT + 6,
    0,
  );
  const tocPageCount = Math.max(1, Math.ceil(totalHeight / Math.max(usableHeight, 1)));

  const lines: TocLine[] = [];
  // Front matter: the cover, then the contents itself.
  let nextPage = 1 + tocPageCount + 1;

  sections.forEach((section, index) => {
    const dividerPages = section.hasDivider ? 1 : 0;
    lines.push({
      title: section.title,
      indent: 0,
      targetPage: nextPage,
      marker: String(index + 1).padStart(2, '0'),
    });

    let childPage = nextPage + dividerPages;
    for (const child of section.children ?? []) {
      lines.push({ title: child.title, indent: 1, targetPage: childPage });
      childPage += child.pageCount;
    }

    nextPage += section.pageCount + dividerPages;
  });

  const pdfDoc = await PDFDocument.create();
  const display = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const body = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const monoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  let issuerMark: PDFImage | null = null;
  const issuerMarkDataUrl = await getFestivalIssuerMarkDataUrl('ink');
  if (issuerMarkDataUrl) {
    try {
      issuerMark = await pdfDoc.embedPng(issuerMarkDataUrl);
    } catch (error) {
      console.warn('No se pudo añadir la marca de Sector-Pro al índice:', error);
    }
  }

  const tocLinks: TocLinkRegion[] = [];
  let pageIndex = 0;
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawContentsChrome(page, { display, mono }, issuerMark);

  let y = CONTENT_TOP_Y;
  page.drawText('Contenido', { x: LEFT, y, size: 22, font: display, color: INK });
  y -= 12;
  page.drawLine({
    start: { x: LEFT, y },
    end: { x: RIGHT, y },
    thickness: 0.25 * MM_TO_PT,
    color: RULE,
  });
  y -= 26;

  for (const line of lines) {
    const lineHeight = line.indent === 0 ? LINE_HEIGHT : CHILD_LINE_HEIGHT;

    if (y - lineHeight < CONTENT_BOTTOM_Y && pageIndex + 1 < tocPageCount) {
      pageIndex += 1;
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawContentsChrome(page, { display, mono }, issuerMark);
      y = CONTENT_TOP_Y;
    }

    const isSection = line.indent === 0;
    const size = isSection ? 10.5 : 8.6;
    const font = isSection ? display : body;
    const textX = isSection ? LEFT + 26 : LEFT + 40;
    const pageLabel = String(line.targetPage).padStart(2, '0');
    const pageLabelWidth = monoBold.widthOfTextAtSize(pageLabel, isSection ? 9 : 8);
    const numberX = RIGHT - pageLabelWidth;

    if (line.marker) {
      page.drawText(line.marker, { x: LEFT, y, size: 8, font: monoBold, color: ACCENT });
    }

    const title = truncate(line.title, font, size, numberX - textX - 30);
    page.drawText(title, { x: textX, y, size, font, color: isSection ? INK : SOFT });

    // Dot leaders bridge the title to its folio.
    const titleEnd = textX + font.widthOfTextAtSize(title, size) + 6;
    for (let dotX = titleEnd; dotX < numberX - 8; dotX += 5) {
      page.drawText('.', { x: dotX, y, size: 7, font: body, color: FAINT });
    }

    page.drawText(pageLabel, {
      x: numberX,
      y,
      size: isSection ? 9 : 8,
      font: monoBold,
      color: isSection ? INK : SOFT,
    });

    tocLinks.push({
      pageIndex,
      x: LEFT,
      y: y - 3,
      width: RIGHT - LEFT,
      height: lineHeight - 2,
      targetPage: line.targetPage,
    });

    y -= lineHeight;
    if (isSection) y -= 3;
  }

  // Pad out to the announced page count so the offsets above stay true.
  while (pdfDoc.getPageCount() < tocPageCount) {
    drawContentsChrome(pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), { display, mono }, issuerMark);
  }

  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const bytes = await response.arrayBuffer();
        const head = new Uint8Array(bytes.slice(0, 8));
        const isPng = head.length >= 8 && head[0] === 0x89 && head[1] === 0x50;
        const logo = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const width = Math.min(72, logo.width);
        const height = (logo.height / logo.width) * width;
        pdfDoc.getPage(0).drawImage(logo, {
          x: RIGHT - width,
          y: CONTENT_TOP_Y - height + 16,
          width,
          height,
        });
      }
    } catch (error) {
      console.warn('No se pudo añadir el logotipo al índice:', error);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
    links: tocLinks,
    pageCount: pdfDoc.getPageCount(),
  };
};
