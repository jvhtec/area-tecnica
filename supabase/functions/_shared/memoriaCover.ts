import { PDFImage, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import {
  ACCENT,
  drawIssuerMark,
  drawReportChrome,
  drawTracked,
  embedReportFonts,
  FAINT,
  INK,
  REPORT_CONTENT_WIDTH,
  REPORT_MARGIN,
  REPORT_PAGE,
  RULE,
  SOFT,
  truncate,
  wrapText,
  type ReportFonts,
} from "./reportPdfKit.ts";

/**
 * The cover and index of a Memoria Técnica.
 *
 * It lives in `_shared` because the sound, lights and video functions each
 * carried their own copy of both pages.
 */

export const MEMORIA_PAGE = REPORT_PAGE;
export type MemoriaFonts = ReportFonts;
export const embedMemoriaFonts = embedReportFonts;

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
 * available here is black artwork that cannot be recoloured for a dark page.
 */
export const drawMemoriaCover = (
  page: PDFPage,
  fonts: MemoriaFonts,
  options: MemoriaCoverOptions,
): void => {
  const { height, width } = REPORT_PAGE;
  const issuedAt = options.issuedAt ?? new Date();

  drawIssuerMark(page, fonts, options.issuerMark, height - REPORT_MARGIN);

  if (options.clientLogo && options.clientLogo.width > 0 && options.clientLogo.height > 0) {
    const scale = Math.min(116 / options.clientLogo.width, 64 / options.clientLogo.height);
    const logoWidth = options.clientLogo.width * scale;
    const logoHeight = options.clientLogo.height * scale;
    page.drawImage(options.clientLogo, {
      x: width - REPORT_MARGIN - logoWidth,
      y: height - REPORT_MARGIN - logoHeight + 8,
      width: logoWidth,
      height: logoHeight,
    });
  }

  drawTracked(page, `MEMORIA TÉCNICA · ${options.department.toUpperCase()}`, {
    x: REPORT_MARGIN,
    y: height - 300,
    size: 7.5,
    font: fonts.monoBold,
    color: ACCENT,
    tracking: 1.6,
  });

  const titleSize = 30;
  const lines = wrapText(
    options.projectName.trim() || "Trabajo sin título",
    fonts.display,
    titleSize,
    REPORT_CONTENT_WIDTH,
  ).slice(0, 4);

  let titleY = height - 336;
  for (const line of lines) {
    page.drawText(line, { x: REPORT_MARGIN, y: titleY, size: titleSize, font: fonts.display, color: INK });
    titleY -= titleSize + 4;
  }

  const ruleY = titleY + titleSize - 14;
  page.drawLine({
    start: { x: REPORT_MARGIN, y: ruleY },
    end: { x: width - REPORT_MARGIN, y: ruleY },
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
    x: REPORT_MARGIN,
    y: ruleY - 20,
    size: 7.5,
    font: fonts.monoBold,
    color: SOFT,
    tracking: 1.1,
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
 * the bulleted list it replaces could not: the merge already loads every source
 * before it copies anything, so the page count is there for the taking and the
 * set becomes navigable.
 */
export const drawMemoriaIndex = (
  page: PDFPage,
  fonts: MemoriaFonts,
  options: MemoriaIndexOptions,
): void => {
  const { height, width } = REPORT_PAGE;
  drawReportChrome(page, fonts, `Memoria técnica · ${options.department}`, options.issuerMark);

  let y = height - 150;
  drawTracked(page, "CONTENIDO", {
    x: REPORT_MARGIN,
    y,
    size: 9,
    font: fonts.display,
    color: INK,
    tracking: 1.6,
  });
  page.drawLine({
    start: { x: REPORT_MARGIN + 92, y: y - 3 },
    end: { x: width - REPORT_MARGIN, y: y - 3 },
    thickness: 0.5,
    color: RULE,
  });

  y -= 34;
  let startPage = options.firstContentPage;

  options.sections.forEach((section, index) => {
    const number = String(index + 1).padStart(2, "0");
    const pageLabel = String(startPage).padStart(2, "0");
    const pageLabelWidth = fonts.monoBold.widthOfTextAtSize(pageLabel, 9);

    page.drawText(number, { x: REPORT_MARGIN, y, size: 8, font: fonts.monoBold, color: ACCENT });

    const titleX = REPORT_MARGIN + 26;
    const titleMaxWidth = width - REPORT_MARGIN - titleX - pageLabelWidth - 24;
    page.drawText(truncate(section.title, fonts.body, 11, titleMaxWidth), {
      x: titleX,
      y,
      size: 11,
      font: fonts.body,
      color: INK,
    });

    page.drawText(pageLabel, {
      x: width - REPORT_MARGIN - pageLabelWidth,
      y,
      size: 9,
      font: fonts.monoBold,
      color: INK,
    });

    page.drawLine({
      start: { x: REPORT_MARGIN, y: y - 10 },
      end: { x: width - REPORT_MARGIN, y: y - 10 },
      thickness: 0.5,
      color: RULE,
    });

    y -= 30;
    startPage += section.pageCount;
  });

  const total = options.sections.reduce((sum, section) => sum + section.pageCount, 0);
  drawTracked(page, `${total} ${total === 1 ? "PÁGINA" : "PÁGINAS"} DE DOCUMENTACIÓN`, {
    x: REPORT_MARGIN,
    y: y - 6,
    size: 7,
    font: fonts.mono,
    color: FAINT,
    tracking: 1,
  });
};
