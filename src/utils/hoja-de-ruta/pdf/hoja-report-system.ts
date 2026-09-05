import type jsPDF from 'jspdf';
import {
  REPORT_INK,
  REPORT_SOFT,
  distributeColumnWidths,
  drawReportChrome,
  reportGeometry,
  reportTableDefaults,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';

/**
 * The hoja de ruta on the platform's document system.
 *
 * The engine predates the system and carries its own `PDFDocument` wrapper, so
 * rather than rewrite it this module adapts the two things that made it look
 * like a different product: the page chrome and the table styling.
 */

export const HOJA_DOC_KIND = 'schedule' as const;

export interface HojaChromeContext {
  /** Document title in the running head — "Hoja de Ruta" or a section export. */
  title: string;
  jobName: string;
  /** Section the page belongs to, carried by the rail. */
  contextLabel?: string;
}

export const hojaChrome = (context: HojaChromeContext): ReportChromeOptions => ({
  kind: HOJA_DOC_KIND,
  kindLabel: context.title,
  eventTitle: context.jobName,
  contextLabel: context.contextLabel,
});

/** Draws the running head and footer band of the current page. */
export const drawHojaChrome = (
  doc: jsPDF,
  context: HojaChromeContext,
  folio?: { pageNumber: number; totalPages: number },
): ReportGeometry =>
  drawReportChrome(doc, {
    ...hojaChrome(context),
    pageNumber: folio?.pageNumber,
    totalPages: folio?.totalPages,
    paginate: folio !== undefined,
  });

export const hojaGeometry = (doc: jsPDF): ReportGeometry => reportGeometry(doc);

/**
 * Ledger table options for the engine's `PDFDocument.addTable`.
 *
 * `weights` are relative column widths; pass them so the table lays out fixed
 * rather than guessing, which is what breaks words inside narrow cells.
 */
export const hojaTable = (
  geo: ReportGeometry,
  options: {
    fontSize?: number;
    numericColumns?: number[];
    weights?: number[];
  } = {},
) => ({
  ...reportTableDefaults(geo, {
    fontSize: options.fontSize ?? 7.2,
    numericColumns: options.numericColumns,
  }),
  ...(options.weights
    ? { columnStyles: distributeColumnWidths(options.weights, geo.contentWidth) }
    : {}),
});

/**
 * Subheadings inside a section are set in ink, not the accent.
 *
 * The engine used the corporate red for every heading level, so a page of
 * "Detalles de Carga:", "Detalles de Descarga:", "Hotel", "Programa" all
 * competed at the same volume. In this system the accent only rules or marks;
 * heading level is carried by size and position.
 */
export const HOJA_HEADING: [number, number, number] = [...REPORT_INK];

/** Label columns in a two-column definition table. */
export const HOJA_LABEL: [number, number, number] = [...REPORT_SOFT];

/**
 * Which section each page belongs to, so the final chrome pass can put the
 * right label on the rail of a page a section spilled onto.
 *
 * The chrome is drawn once, at the end — drawing it as sections open would
 * double-print it on those pages, because a PDF page only ever accumulates.
 */
export class HojaPageLabels {
  private labels = new Map<number, string>();

  record(pageNumber: number, label: string): void {
    this.labels.set(pageNumber, label);
  }

  /** The label for `pageNumber`, or the last one recorded before it. */
  resolve(pageNumber: number): string | undefined {
    for (let page = pageNumber; page >= 1; page -= 1) {
      const label = this.labels.get(page);
      if (label) return label;
    }
    return undefined;
  }
}
