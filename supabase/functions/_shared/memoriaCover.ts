import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";

/**
 * The cover and index of a Memoria Técnica, on the platform's document system.
 *
 * The app-side generators share `@/utils/pdf/report-system`, which is built on
 * jsPDF and cannot be imported here. This is the same design expressed in
 * pdf-lib for the Deno runtime: a warm near-black for copy, one accent that
 * only ever rules, hairlines instead of filled bands, and mono for anything
 * counted or indexed.
 *
 * It lives in `_shared` because the sound, lights and video functions each
 * carried their own copy of the cover and the index.
 */

export const MEMORIA_PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 56;
const CONTENT_WIDTH = MEMORIA_PAGE.width - MARGIN * 2;

const INK = rgb(23 / 255, 20 / 255, 15 / 255);
const SOFT = rgb(122 / 255, 115 / 255, 106 / 255);
const FAINT = rgb(183 / 255, 176 / 255, 166 / 255);
const ACCENT = rgb(125 / 255, 1 / 255, 1 / 255);
const RULE = rgb(228 / 255, 223 / 255, 214 / 255);

export interface MemoriaFonts {
  display: PDFFont;
  body: PDFFont;
  mono: PDFFont;
  monoBold: PDFFont;
}

export const embedMemoriaFonts = async (pdf: PDFDocument): Promise<MemoriaFonts> => ({
  display: await pdf.embedFont(StandardFonts.HelveticaBold),
  body: await pdf.embedFont(StandardFonts.Helvetica),
  mono: await pdf.embedFont(StandardFonts.Courier),
  monoBold: await pdf.embedFont(StandardFonts.CourierBold),
});

/** One appended document, with the page count the index needs to point at it. */
export interface MemoriaSection {
  title: string;
  pageCount: number;
}

export interface MemoriaBranding {
  /** Client or job mark, placed once on the cover. */
  clientLogo?: PDFImage | null;
  /** The Sector-Pro wordmark, top left of every front-matter page. */
  issuerMark?: PDFImage | null;
}

/** Width of letter-spaced text, which pdf-lib cannot measure for us. */
const trackedWidth = (text: string, font: PDFFont, size: number, tracking: number): number => {
  if (!text) return 0;
  let width = 0;
  for (const character of text) width += font.widthOfTextAtSize(character, size) + tracking;
  return width - tracking;
};

/** Letter-spaced caps, which pdf-lib has no option for. */
const drawTracked = (
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; tracking?: number },
): number => {
  const tracking = options.tracking ?? 1.2;
  let x = options.x;
  for (const character of text) {
    page.drawText(character, { x, y: options.y, size: options.size, font: options.font, color: options.color });
    x += options.font.widthOfTextAtSize(character, options.size) + tracking;
  }
  return x - options.x - tracking;
};

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth || !current) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** Trims to an ellipsis so a long title never runs into the page number. */
const truncate = (text: string, font: PDFFont, size: number, maxWidth: number): string => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}…`;
};

/** Returns the height the mark occupies above the baseline it sits on. */
const drawIssuerMark = (page: PDFPage, fonts: MemoriaFonts, mark: PDFImage | null | undefined, y: number): number => {
  if (mark && mark.width > 0 && mark.height > 0) {
    const height = 13;
    const width = (mark.width / mark.height) * height;
    page.drawImage(mark, { x: MARGIN, y, width, height });
    return height;
  }
  drawTracked(page, "SECTOR-PRO", { x: MARGIN, y, size: 9, font: fonts.display, color: INK, tracking: 1 });
  return 9;
};

const madridDate = (issuedAt: Date): string =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(issuedAt);

export interface MemoriaCoverOptions extends MemoriaBranding {
  /** "Sonido", "Iluminación", "Vídeo". */
  department: string;
  projectName: string;
  issuedAt?: Date;
  /** Documents in the set, for the count on the cover strip. */
  sectionCount?: number;
}

/**
 * The cover. The project is the subject, so it is the title; what kind of
 * document this is rides in the eyebrow, where it does not compete with the
 * name anyone is looking for.
 *
 * Set on paper rather than the festival set's black ground: a memoria is
 * printed and filed on whatever office printer is nearest, and the issuer mark
 * available here is black artwork that could not be recoloured for a dark page.
 */
export const drawMemoriaCover = (
  page: PDFPage,
  fonts: MemoriaFonts,
  options: MemoriaCoverOptions,
): void => {
  const { height } = MEMORIA_PAGE;
  const issuedAt = options.issuedAt ?? new Date();

  drawIssuerMark(page, fonts, options.issuerMark, height - MARGIN);

  if (options.clientLogo && options.clientLogo.width > 0 && options.clientLogo.height > 0) {
    const maxWidth = 116;
    const maxHeight = 64;
    const scale = Math.min(maxWidth / options.clientLogo.width, maxHeight / options.clientLogo.height);
    const width = options.clientLogo.width * scale;
    const logoHeight = options.clientLogo.height * scale;
    page.drawImage(options.clientLogo, {
      x: MEMORIA_PAGE.width - MARGIN - width,
      y: height - MARGIN - logoHeight + 8,
      width,
      height: logoHeight,
    });
  }

  drawTracked(page, `MEMORIA TÉCNICA · ${options.department.toUpperCase()}`, {
    x: MARGIN,
    y: height - 300,
    size: 7.5,
    font: fonts.monoBold,
    color: ACCENT,
    tracking: 1.6,
  });

  const titleSize = 30;
  const lines = wrapText(options.projectName.trim() || "Trabajo sin título", fonts.display, titleSize, CONTENT_WIDTH).slice(0, 4);
  let titleY = height - 336;
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y: titleY, size: titleSize, font: fonts.display, color: INK });
    titleY -= titleSize + 4;
  }

  const ruleY = titleY + titleSize - 14;
  page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: MEMORIA_PAGE.width - MARGIN, y: ruleY },
    thickness: 1,
    color: ACCENT,
  });

  const facts = [
    options.sectionCount !== undefined
      ? `${options.sectionCount} ${options.sectionCount === 1 ? "DOCUMENTO" : "DOCUMENTOS"}`
      : null,
    `EMITIDA ${madridDate(issuedAt)}`,
  ].filter((fact): fact is string => Boolean(fact));

  drawTracked(page, facts.join("   ·   "), {
    x: MARGIN,
    y: ruleY - 20,
    size: 7.5,
    font: fonts.monoBold,
    color: SOFT,
    tracking: 1.1,
  });
};

/**
 * The running head of a front-matter page: the issuer left, the document type
 * right, and one accent rule closing it.
 */
const drawFrontMatterChrome = (
  page: PDFPage,
  fonts: MemoriaFonts,
  department: string,
  issuerMark: PDFImage | null | undefined,
): void => {
  const { height, width } = MEMORIA_PAGE;
  const baseline = height - MARGIN;

  // The mark sits on the baseline, the rule clears the whole of it: drawing the
  // rule a fixed distance below the baseline ran it through the wordmark.
  const markHeight = drawIssuerMark(page, fonts, issuerMark, baseline);

  const label = `MEMORIA TÉCNICA · ${department.toUpperCase()}`;
  const tracking = 0.9;
  drawTracked(page, label, {
    x: width - MARGIN - trackedWidth(label, fonts.monoBold, 6.5, tracking),
    y: baseline + markHeight / 2 - 2,
    size: 6.5,
    font: fonts.monoBold,
    color: SOFT,
    tracking,
  });

  const ruleY = baseline - 8;
  page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: width - MARGIN, y: ruleY },
    thickness: 1,
    color: ACCENT,
  });
};

export interface MemoriaIndexOptions extends MemoriaBranding {
  department: string;
  sections: MemoriaSection[];
  /** 1-based page the first appended document starts on. */
  firstContentPage: number;
}

/**
 * The index. Each row carries the page the document actually starts on, which
 * the bulleted list it replaces could not: the merge knows every source page
 * count before it copies anything, so the number is free and the set becomes
 * navigable.
 */
export const drawMemoriaIndex = (
  page: PDFPage,
  fonts: MemoriaFonts,
  options: MemoriaIndexOptions,
): void => {
  const { height, width } = MEMORIA_PAGE;
  drawFrontMatterChrome(page, fonts, options.department, options.issuerMark);

  let y = height - 150;
  drawTracked(page, "CONTENIDO", { x: MARGIN, y, size: 9, font: fonts.display, color: INK, tracking: 1.6 });
  page.drawLine({
    start: { x: MARGIN + 92, y: y - 3 },
    end: { x: width - MARGIN, y: y - 3 },
    thickness: 0.5,
    color: RULE,
  });

  y -= 34;
  let startPage = options.firstContentPage;

  options.sections.forEach((section, index) => {
    const number = String(index + 1).padStart(2, "0");
    const pageLabel = String(startPage).padStart(2, "0");
    const pageLabelWidth = fonts.monoBold.widthOfTextAtSize(pageLabel, 9);

    page.drawText(number, { x: MARGIN, y, size: 8, font: fonts.monoBold, color: ACCENT });

    const titleX = MARGIN + 26;
    const titleMaxWidth = width - MARGIN - titleX - pageLabelWidth - 24;
    page.drawText(truncate(section.title, fonts.body, 11, titleMaxWidth), {
      x: titleX,
      y,
      size: 11,
      font: fonts.body,
      color: INK,
    });

    page.drawText(pageLabel, {
      x: width - MARGIN - pageLabelWidth,
      y,
      size: 9,
      font: fonts.monoBold,
      color: INK,
    });

    page.drawLine({
      start: { x: MARGIN, y: y - 10 },
      end: { x: width - MARGIN, y: y - 10 },
      thickness: 0.5,
      color: RULE,
    });

    y -= 30;
    startPage += section.pageCount;
  });

  const total = options.sections.reduce((sum, section) => sum + section.pageCount, 0);
  drawTracked(page, `${total} ${total === 1 ? "PÁGINA" : "PÁGINAS"} DE DOCUMENTACIÓN`, {
    x: MARGIN,
    y: y - 6,
    size: 7,
    font: fonts.mono,
    color: FAINT,
    tracking: 1,
  });
};
