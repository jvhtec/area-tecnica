/**
 * The platform-wide PDF document system.
 *
 * The design was introduced with the Soundvision report, extended to the power
 * and weight reports and then to the festival documentation set. Its rules are
 * short: a warm near-black for copy, one accent that only ever rules or marks,
 * hairlines instead of filled bands, mono for anything measured or counted, and
 * a running head that names the document before anyone reads the title.
 *
 * The implementation lives in `@/utils/pdf/festival-report`, which was the
 * first place it was generalised. This module is the neutral doorway into it
 * for the administrative, crew, operations and technical documents — nothing
 * outside the festival set should import a symbol called `Festival…`.
 */
import type jsPDF from 'jspdf';
import {
  FESTIVAL_ACCENT,
  FESTIVAL_ACCENT_BRIGHT,
  FESTIVAL_COVER,
  FESTIVAL_FAINT,
  FESTIVAL_FLAG_BORDER,
  FESTIVAL_FLAG_GROUND,
  FESTIVAL_FLAG_LABEL,
  FESTIVAL_HAIRLINE,
  FESTIVAL_INK,
  FESTIVAL_PAPER,
  FESTIVAL_PAPER_TINT,
  FESTIVAL_RULE,
  FESTIVAL_RULE_WEIGHT,
  FESTIVAL_SOFT,
  FESTIVAL_TOTALS_WEIGHT,
  FESTIVAL_TRACK,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalFlag,
  drawFestivalGauge,
  drawFestivalHatch,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  drawFestivalTotalsRule,
  festivalGeometry,
  festivalTableTheme,
  festivalUnitScale,
  formatFestivalNumber,
  loadFestivalIssuerMark,
  setFestivalMono,
  setFestivalMonoText,
  setFestivalSans,
  setFestivalText,
  truncateToWidth,
  type FestivalFlagLabel,
  type FestivalGeometry,
  type FestivalMetaItem,
} from '@/utils/pdf/festival-report';
import { REPORT_DOC_LABELS, reportMark, type ReportDocKind } from './marks';

export { REPORT_DOC_LABELS, drawReportTypeMark, reportMark, type ReportDocKind } from './marks';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const REPORT_INK = FESTIVAL_INK;
export const REPORT_SOFT = FESTIVAL_SOFT;
export const REPORT_FAINT = FESTIVAL_FAINT;
export const REPORT_ACCENT = FESTIVAL_ACCENT;
export const REPORT_ACCENT_BRIGHT = FESTIVAL_ACCENT_BRIGHT;
export const REPORT_RULE = FESTIVAL_RULE;
export const REPORT_TRACK = FESTIVAL_TRACK;
export const REPORT_PAPER = FESTIVAL_PAPER;
export const REPORT_PAPER_TINT = FESTIVAL_PAPER_TINT;
export const REPORT_COVER = FESTIVAL_COVER;
export const REPORT_FLAG_BORDER = FESTIVAL_FLAG_BORDER;
export const REPORT_FLAG_GROUND = FESTIVAL_FLAG_GROUND;
export const REPORT_FLAG_LABEL = FESTIVAL_FLAG_LABEL;

export const REPORT_HAIRLINE = FESTIVAL_HAIRLINE;
export const REPORT_RULE_WEIGHT = FESTIVAL_RULE_WEIGHT;
export const REPORT_TOTALS_WEIGHT = FESTIVAL_TOTALS_WEIGHT;

// ---------------------------------------------------------------------------
// Geometry and type
// ---------------------------------------------------------------------------

export type ReportGeometry = FestivalGeometry;
export type ReportMetaItem = FestivalMetaItem;
export type ReportFlagLabel = FestivalFlagLabel;

export const reportGeometry = festivalGeometry;
export const reportUnitScale = festivalUnitScale;
export const setReportSans = setFestivalSans;
export const setReportMono = setFestivalMono;
export const setReportText = setFestivalText;
export const setReportMonoText = setFestivalMonoText;
export { truncateToWidth };

// ---------------------------------------------------------------------------
// Chrome and blocks
// ---------------------------------------------------------------------------

export const drawReportTitleBlock = drawFestivalTitleBlock;
export const drawReportMetaGrid = drawFestivalMetaGrid;
export const drawReportSectionHeading = drawFestivalSectionHeading;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const reportTableTheme = festivalTableTheme;
export const drawReportConstantsLine = drawFestivalConstantsLine;
export const drawReportFlag = drawFestivalFlag;
export const drawReportGauge = drawFestivalGauge;
export const drawReportHatch = drawFestivalHatch;
export const drawReportNilState = drawFestivalNilState;
export const drawReportTotalsRule = drawFestivalTotalsRule;
export const formatReportNumber = formatFestivalNumber;
export const loadReportIssuerMark = loadFestivalIssuerMark;
export { dropConstantColumns, distributeColumnWidths } from '@/utils/pdf/festival-report';

export interface ReportChromeOptions {
  kind: ReportDocKind;
  /** Overrides the default label for the document type. */
  kindLabel?: string;
  /** Event, job or tour name — carried by the rail so a loose page identifies itself. */
  eventTitle?: string;
  /** Second rail segment: department, date range or client. */
  contextLabel?: string;
  /** Issuer line in the footer. Defaults to `Sector-Pro · <label>`. */
  issuer?: string;
  pageNumber?: number;
  totalPages?: number;
  paginate?: boolean;
}

/** Draws the running head, rail and footer of the current page. */
export const drawReportChrome = (
  doc: jsPDF,
  options: ReportChromeOptions,
): ReportGeometry =>
  drawFestivalChrome(doc, {
    // The kind only selects the built-in festival marks, which `mark` replaces.
    kind: 'set',
    kindLabel: options.kindLabel ?? REPORT_DOC_LABELS[options.kind],
    mark: reportMark(options.kind),
    eventTitle: options.eventTitle,
    contextLabel: options.contextLabel,
    issuer: options.issuer,
    pageNumber: options.pageNumber,
    totalPages: options.totalPages,
    paginate: options.paginate,
  });

/**
 * Stamps the chrome onto every page once the content is laid out.
 *
 * Page numbers cannot be drawn while a document is still growing — the total is
 * unknown until the last page exists — so documents lay out their content
 * first, leaving the header and footer bands empty, and call this at the end.
 */
export const stampReportChrome = (
  doc: jsPDF,
  options: Omit<ReportChromeOptions, 'pageNumber' | 'totalPages'>,
  /** 1-based pages to leave untouched — a cover carries no running head. */
  skipPages: number[] = [],
): void => {
  const totalPages = doc.getNumberOfPages();
  const skip = new Set(skipPages);
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (skip.has(pageNumber)) continue;
    doc.setPage(pageNumber);
    drawReportChrome(doc, { ...options, pageNumber, totalPages });
  }
};

/**
 * Stamps only the `NN / NN` folio into the footer slot of every page.
 *
 * Documents whose running head changes from page to page — a tour book, where
 * each page names its own date — draw their chrome as they go and use this to
 * fill the one slot that cannot be written until the last page exists. Skipped
 * pages still consume a number, so the folio on the page keeps matching the
 * folio anyone counts to.
 */
export const stampReportFolios = (
  doc: jsPDF,
  { skipPages = [] }: { skipPages?: number[] } = {},
): void => {
  const totalPages = doc.getNumberOfPages();
  const skip = new Set(skipPages);

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (skip.has(pageNumber)) continue;
    doc.setPage(pageNumber);
    const geo = reportGeometry(doc);

    setReportMonoText(doc, REPORT_INK, 7.5, 'bold');
    const total = ` / ${String(totalPages).padStart(2, '0')}`;
    const totalWidth = doc.getTextWidth(total);
    doc.text(String(pageNumber).padStart(2, '0'), geo.right - totalWidth, geo.footerTextY, {
      align: 'right',
    });
    setReportMonoText(doc, REPORT_FAINT, 7.5, 'bold');
    doc.text(total, geo.right, geo.footerTextY, { align: 'right' });
  }
};

/**
 * Returns a Y at which `requiredHeight` fits, breaking the page when it does
 * not. `onNewPage` runs after the break so a document can repeat a table head
 * or a section title.
 */
export const ensureReportSpace = (
  doc: jsPDF,
  geo: ReportGeometry,
  y: number,
  requiredHeight: number,
  onNewPage?: (geo: ReportGeometry, top: number) => number,
): number => {
  if (y + requiredHeight <= geo.contentBottom) return y;
  doc.addPage();
  const top = geo.contentTop;
  return onNewPage ? onNewPage(geo, top) : top;
};

// ---------------------------------------------------------------------------
// Masthead and table defaults
// ---------------------------------------------------------------------------

export interface ReportMastheadOptions extends ReportChromeOptions {
  /** Accent line above the title. Defaults to the document-type label. */
  eyebrow?: string;
  /** The subject of the document — a job, a tour, a technician, a week. */
  title: string;
  /** One line under the title: issue date, scope, revision. */
  subtitle?: string;
  /** Conditions that travel with the document, set between two hairlines. */
  meta?: ReportMetaItem[];
  /** Client or tour mark, already loaded. Placed once, top right. */
  clientLogo?: HTMLImageElement | null;
  clientLogoFormat?: 'PNG' | 'JPEG';
}

/**
 * Page one: the running head, the title block and the conditions grid.
 *
 * Returns the geometry — which every later block needs — and the Y at which
 * content may start. Page numbers are left blank; `stampReportChrome` fills
 * them once the document knows how long it is.
 */
export const drawReportMasthead = (
  doc: jsPDF,
  options: ReportMastheadOptions,
): { geo: ReportGeometry; y: number } => {
  const geo = drawReportChrome(doc, { ...options, paginate: false });
  let y = drawReportTitleBlock(doc, geo, {
    eyebrow: options.eyebrow ?? options.kindLabel ?? REPORT_DOC_LABELS[options.kind],
    title: options.title,
    subtitle: options.subtitle,
    clientLogo: options.clientLogo,
    clientLogoFormat: options.clientLogoFormat,
  });
  if (options.meta && options.meta.length > 0) {
    y = drawReportMetaGrid(doc, geo, options.meta, y);
  }
  return { geo, y };
};

/**
 * Continuation pages carry the running head only — repeating the masthead on
 * every page costs a third of the sheet and tells the reader nothing new.
 */
export const drawReportRunningHead = (
  doc: jsPDF,
  options: ReportChromeOptions,
): ReportGeometry => drawReportChrome(doc, { ...options, paginate: false });

/**
 * `autoTable` options for a ledger table in this system: the theme plus margins
 * that keep every page inside the chrome. Merge `startY`, `head`, `body` and
 * any extra `columnStyles` into the result.
 */
export const reportTableDefaults = (
  geo: ReportGeometry,
  options: {
    fontSize?: number;
    headFontSize?: number;
    /** Columns whose figures are right-aligned in mono. */
    numericColumns?: number[];
  } = {},
) => ({
  ...reportTableTheme(geo, options),
  margin: {
    left: geo.left,
    right: geo.pageWidth - geo.right,
    top: geo.contentTop,
    bottom: geo.pageHeight - geo.contentBottom,
  },
});
