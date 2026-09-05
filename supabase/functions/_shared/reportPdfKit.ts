import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";
import { logEvent } from "./structuredLogger.ts";

/**
 * The platform's document system, expressed in pdf-lib for the Deno runtime.
 *
 * The app-side generators share `@/utils/pdf/report-system`, which is built on
 * jsPDF and cannot be imported here. The rules are the same: a warm near-black
 * for copy, one accent that only ever rules or marks, hairlines instead of
 * filled bands, and mono for anything measured, counted or indexed.
 */

export const REPORT_PAGE = { width: 595.28, height: 841.89 } as const;
export const REPORT_MARGIN = 56;
export const REPORT_CONTENT_WIDTH = REPORT_PAGE.width - REPORT_MARGIN * 2;

export const INK = rgb(23 / 255, 20 / 255, 15 / 255);
export const SOFT = rgb(122 / 255, 115 / 255, 106 / 255);
export const FAINT = rgb(183 / 255, 176 / 255, 166 / 255);
export const ACCENT = rgb(125 / 255, 1 / 255, 1 / 255);
export const RULE = rgb(228 / 255, 223 / 255, 214 / 255);

export interface ReportFonts {
  display: PDFFont;
  body: PDFFont;
  mono: PDFFont;
  monoBold: PDFFont;
}

export const embedReportFonts = async (pdf: PDFDocument): Promise<ReportFonts> => ({
  display: await pdf.embedFont(StandardFonts.HelveticaBold),
  body: await pdf.embedFont(StandardFonts.Helvetica),
  mono: await pdf.embedFont(StandardFonts.Courier),
  monoBold: await pdf.embedFont(StandardFonts.CourierBold),
});

/** Width of letter-spaced text, which pdf-lib cannot measure for us. */
export const trackedWidth = (text: string, font: PDFFont, size: number, tracking: number): number => {
  if (!text) return 0;
  let width = 0;
  for (const character of text) width += font.widthOfTextAtSize(character, size) + tracking;
  return width - tracking;
};

/** Letter-spaced caps, which pdf-lib has no option for. */
export const drawTracked = (
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    tracking?: number;
  },
): void => {
  const tracking = options.tracking ?? 1.2;
  let x = options.x;
  for (const character of text) {
    page.drawText(character, { x, y: options.y, size: options.size, font: options.font, color: options.color });
    x += options.font.widthOfTextAtSize(character, options.size) + tracking;
  }
};

export const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
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

/** Trims to an ellipsis so a value never runs into what sits beside it. */
export const truncate = (text: string, font: PDFFont, size: number, maxWidth: number): string => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}…`;
};

/**
 * The Sector-Pro mark, sitting on `y`. Returns the height it occupies, so a
 * rule below it can clear the whole of it. Falls back to the typographic
 * wordmark when the artwork is unavailable.
 */
export const drawIssuerMark = (
  page: PDFPage,
  fonts: ReportFonts,
  mark: PDFImage | null | undefined,
  y: number,
): number => {
  if (mark && mark.width > 0 && mark.height > 0) {
    const height = 13;
    const width = (mark.width / mark.height) * height;
    page.drawImage(mark, { x: REPORT_MARGIN, y, width, height });
    return height;
  }
  drawTracked(page, "SECTOR-PRO", {
    x: REPORT_MARGIN,
    y,
    size: 9,
    font: fonts.display,
    color: INK,
    tracking: 1,
  });
  return 9;
};

/** The running head: the issuer left, the document type right, one accent rule. */
export const drawReportChrome = (
  page: PDFPage,
  fonts: ReportFonts,
  documentLabel: string,
  issuerMark?: PDFImage | null,
): void => {
  const { height, width } = REPORT_PAGE;
  const baseline = height - REPORT_MARGIN;
  const markHeight = drawIssuerMark(page, fonts, issuerMark, baseline);

  const label = documentLabel.toUpperCase();
  const tracking = 0.9;
  drawTracked(page, label, {
    x: width - REPORT_MARGIN - trackedWidth(label, fonts.monoBold, 6.5, tracking),
    y: baseline + markHeight / 2 - 2,
    size: 6.5,
    font: fonts.monoBold,
    color: SOFT,
    tracking,
  });

  page.drawLine({
    start: { x: REPORT_MARGIN, y: baseline - 8 },
    end: { x: width - REPORT_MARGIN, y: baseline - 8 },
    thickness: 1,
    color: ACCENT,
  });
};

/** Accent eyebrow, tight display title, soft subtitle. Returns the next Y. */
export const drawReportTitleBlock = (
  page: PDFPage,
  fonts: ReportFonts,
  options: { eyebrow: string; title: string; subtitle?: string; y: number },
): number => {
  drawTracked(page, options.eyebrow.toUpperCase(), {
    x: REPORT_MARGIN,
    y: options.y,
    size: 7.5,
    font: fonts.monoBold,
    color: ACCENT,
    tracking: 1.6,
  });

  const titleSize = 24;
  const lines = wrapText(options.title, fonts.display, titleSize, REPORT_CONTENT_WIDTH).slice(0, 3);
  let y = options.y - 30;
  for (const line of lines) {
    page.drawText(line, { x: REPORT_MARGIN, y, size: titleSize, font: fonts.display, color: INK });
    y -= titleSize + 3;
  }

  y += titleSize - 6;
  if (options.subtitle) {
    y -= 18;
    page.drawText(truncate(options.subtitle, fonts.body, 10, REPORT_CONTENT_WIDTH), {
      x: REPORT_MARGIN,
      y,
      size: 10,
      font: fonts.body,
      color: SOFT,
    });
  }
  return y - 26;
};

export interface ReportMetaItem {
  label: string;
  value: string;
}

/** Equal-width meta cells between two hairlines. Returns the next Y. */
export const drawReportMetaGrid = (
  page: PDFPage,
  fonts: ReportFonts,
  items: ReportMetaItem[],
  y: number,
): number => {
  if (items.length === 0) return y;
  const columnWidth = REPORT_CONTENT_WIDTH / items.length;

  const line = (lineY: number) =>
    page.drawLine({
      start: { x: REPORT_MARGIN, y: lineY },
      end: { x: REPORT_PAGE.width - REPORT_MARGIN, y: lineY },
      thickness: 0.5,
      color: RULE,
    });

  line(y);
  items.forEach((item, index) => {
    const x = REPORT_MARGIN + columnWidth * index;
    drawTracked(page, item.label.toUpperCase(), {
      x,
      y: y - 14,
      size: 6,
      font: fonts.monoBold,
      color: SOFT,
      tracking: 0.8,
    });
    page.drawText(truncate(item.value, fonts.display, 9, columnWidth - 10), {
      x,
      y: y - 30,
      size: 9,
      font: fonts.display,
      color: INK,
    });
  });
  line(y - 40);
  return y - 66;
};

/** Numbered section mark: accent number, caps heading, hairline to the margin. */
export const drawReportSectionHeading = (
  page: PDFPage,
  fonts: ReportFonts,
  title: string,
  y: number,
  number?: number,
): number => {
  let headingX = REPORT_MARGIN;
  if (number !== undefined) {
    page.drawText(String(number).padStart(2, "0"), {
      x: REPORT_MARGIN,
      y,
      size: 8,
      font: fonts.monoBold,
      color: ACCENT,
    });
    headingX = REPORT_MARGIN + 26;
  }

  const heading = title.toUpperCase();
  drawTracked(page, heading, { x: headingX, y, size: 9, font: fonts.display, color: INK, tracking: 1.4 });

  const headingEnd = headingX + trackedWidth(heading, fonts.display, 9, 1.4) + 12;
  page.drawLine({
    start: { x: headingEnd, y: y - 3 },
    end: { x: REPORT_PAGE.width - REPORT_MARGIN, y: y - 3 },
    thickness: 0.5,
    color: RULE,
  });
  return y - 26;
};

/** A mono label with its value beside it. Returns the next Y. */
export const drawReportFactRow = (
  page: PDFPage,
  fonts: ReportFonts,
  label: string,
  value: string,
  y: number,
): number => {
  const labelWidth = 150;
  drawTracked(page, label.toUpperCase(), {
    x: REPORT_MARGIN,
    y,
    size: 6,
    font: fonts.monoBold,
    color: SOFT,
    tracking: 0.8,
  });

  const lines = wrapText(value, fonts.body, 10, REPORT_CONTENT_WIDTH - labelWidth);
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x: REPORT_MARGIN + labelWidth, y: cursor, size: 10, font: fonts.body, color: INK });
    cursor -= 14;
  }
  return Math.min(y - 20, cursor - 6);
};

/** Body copy at reading size. Returns the next Y. */
export const drawReportProse = (
  page: PDFPage,
  fonts: ReportFonts,
  text: string,
  y: number,
): number => {
  const content = text?.trim();
  const lines = wrapText(content || "Sin información.", fonts.body, 10, REPORT_CONTENT_WIDTH);
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, {
      x: REPORT_MARGIN,
      y: cursor,
      size: 10,
      font: fonts.body,
      color: content ? INK : SOFT,
    });
    cursor -= 15;
  }
  return cursor - 8;
};

/**
 * Flag box: one border, one ground, one label. Used where a value needs an
 * action taken on it — a rejection and its reason.
 */
export const drawReportFlag = (
  page: PDFPage,
  fonts: ReportFonts,
  options: { label: string; text: string; y: number },
): number => {
  const lines = wrapText(options.text, fonts.body, 9, REPORT_CONTENT_WIDTH - 24);
  const height = 34 + lines.length * 13;
  const top = options.y;

  page.drawRectangle({
    x: REPORT_MARGIN,
    y: top - height,
    width: REPORT_CONTENT_WIDTH,
    height,
    color: rgb(251 / 255, 247 / 255, 238 / 255),
    borderColor: rgb(223 / 255, 203 / 255, 154 / 255),
    borderWidth: 0.5,
  });

  drawTracked(page, options.label.toUpperCase(), {
    x: REPORT_MARGIN + 12,
    y: top - 18,
    size: 6,
    font: fonts.monoBold,
    color: rgb(122 / 255, 90 / 255, 22 / 255),
    tracking: 0.9,
  });

  let cursor = top - 34;
  for (const line of lines) {
    page.drawText(line, { x: REPORT_MARGIN + 12, y: cursor, size: 9, font: fonts.body, color: INK });
    cursor -= 13;
  }
  return top - height - 18;
};

/** The footer band: a hairline, the issuer line, and the folio. */
export const drawReportFooter = (
  page: PDFPage,
  fonts: ReportFonts,
  options: { issuer: string; pageNumber: number; totalPages: number },
): void => {
  const { width } = REPORT_PAGE;
  const ruleY = 46;

  page.drawLine({
    start: { x: REPORT_MARGIN, y: ruleY },
    end: { x: width - REPORT_MARGIN, y: ruleY },
    thickness: 0.5,
    color: RULE,
  });

  drawTracked(page, options.issuer.toUpperCase(), {
    x: REPORT_MARGIN,
    y: ruleY - 12,
    size: 6,
    font: fonts.mono,
    color: SOFT,
    tracking: 0.8,
  });

  const current = String(options.pageNumber).padStart(2, "0");
  const total = ` / ${String(options.totalPages).padStart(2, "0")}`;
  const totalWidth = fonts.monoBold.widthOfTextAtSize(total, 7.5);
  const currentWidth = fonts.monoBold.widthOfTextAtSize(current, 7.5);

  page.drawText(current, {
    x: width - REPORT_MARGIN - totalWidth - currentWidth,
    y: ruleY - 12,
    size: 7.5,
    font: fonts.monoBold,
    color: INK,
  });
  page.drawText(total, {
    x: width - REPORT_MARGIN - totalWidth,
    y: ruleY - 12,
    size: 7.5,
    font: fonts.monoBold,
    color: FAINT,
  });
};

/** Fixed application assets, read through the service client. */
const ISSUER_MARK_CANDIDATES = [
  { bucket: "public logos", path: "sectorpro.png" },
  { bucket: "company-assets", path: "sector-pro-logo.png" },
] as const;

/**
 * Only what the mark needs: a structural type rather than the Supabase client
 * generic, which resolves its rows to `never` when instantiated with defaults.
 */
export interface StorageClient {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: unknown }>;
    };
  };
}

export const embedIssuerMark = async (
  pdf: PDFDocument,
  supabase: StorageClient,
): Promise<PDFImage | null> => {
  for (const candidate of ISSUER_MARK_CANDIDATES) {
    const { data, error } = await supabase.storage.from(candidate.bucket).download(candidate.path);
    if (error || !data) continue;
    try {
      return await pdf.embedPng(new Uint8Array(await data.arrayBuffer()));
    } catch {
      logEvent("warn", "report.issuer_mark_embed_failed", { bucket: candidate.bucket });
    }
  }
  return null;
};
