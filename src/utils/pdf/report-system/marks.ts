import type jsPDF from 'jspdf';
import type { PdfRgb } from '@/utils/pdf/exportHelpers';
import { FESTIVAL_ACCENT } from '@/utils/pdf/festival-report';

/**
 * Document families outside the festival set.
 *
 * Every document in the platform identifies itself in the running head with a
 * line mark and a label, so a page pulled out of a stack still says what it is.
 * The festival set keeps its own marks in `festival-report/chrome.ts`; these
 * cover the administrative, crew and technical documents.
 */
export type ReportDocKind =
  | 'rates'
  | 'payout'
  | 'timesheet'
  | 'crew'
  | 'vacation'
  | 'incident'
  | 'tour'
  | 'equipment'
  | 'amplifier'
  | 'power'
  | 'rigging'
  | 'schedule';

export const REPORT_DOC_LABELS: Record<ReportDocKind, string> = {
  rates: 'Tarifas',
  payout: 'Liquidación',
  timesheet: 'Parte de horas',
  crew: 'Personal',
  vacation: 'Vacaciones',
  incident: 'Incidencia',
  tour: 'Operativa de gira',
  equipment: 'Material',
  amplifier: 'Amplificación',
  power: 'Potencia',
  rigging: 'Rigging',
  schedule: 'Horarios',
};

/**
 * Draws the mark for `kind` as a line drawing, never filled, inside the
 * `sizeMm` square whose top-left corner is (`x`, `y`). Geometry is written as
 * fractions of that square so the same mark serves the 6 mm running head and
 * the larger cover placement without a second set of numbers.
 */
export const drawReportTypeMark = (
  doc: jsPDF,
  kind: ReportDocKind,
  x: number,
  y: number,
  mm: number,
  color: PdfRgb = FESTIVAL_ACCENT,
  sizeMm = 8,
): void => {
  const s = sizeMm * mm;
  doc.setDrawColor(...color);
  doc.setLineWidth(0.45 * mm);

  switch (kind) {
    // A ledger: two entries and a rule, the shape of every money document.
    case 'rates':
      doc.line(x, y + s * 0.2, x + s * 0.62, y + s * 0.2);
      doc.line(x, y + s * 0.5, x + s * 0.84, y + s * 0.5);
      doc.line(x, y + s * 0.86, x + s, y + s * 0.86);
      doc.line(x + s * 0.78, y + s * 0.02, x + s * 0.78, y + s * 0.72);
      break;
    // A coin, ruled once: the payout is the ledger already settled.
    case 'payout':
      doc.circle(x + s * 0.5, y + s * 0.5, s * 0.46, 'S');
      doc.line(x + s * 0.28, y + s * 0.36, x + s * 0.72, y + s * 0.36);
      doc.line(x + s * 0.28, y + s * 0.62, x + s * 0.72, y + s * 0.62);
      break;
    // A clock: hours are what the sheet counts.
    case 'timesheet':
      doc.circle(x + s * 0.5, y + s * 0.5, s * 0.46, 'S');
      doc.line(x + s * 0.5, y + s * 0.22, x + s * 0.5, y + s * 0.52);
      doc.line(x + s * 0.5, y + s * 0.52, x + s * 0.76, y + s * 0.62);
      break;
    // Two heads on one shoulder line.
    case 'crew':
      doc.circle(x + s * 0.32, y + s * 0.26, s * 0.18, 'S');
      doc.circle(x + s * 0.74, y + s * 0.3, s * 0.14, 'S');
      doc.line(x + s * 0.06, y + s * 0.88, x + s * 0.58, y + s * 0.88);
      doc.line(x + s * 0.06, y + s * 0.88, x + s * 0.14, y + s * 0.56);
      doc.line(x + s * 0.58, y + s * 0.88, x + s * 0.5, y + s * 0.56);
      doc.line(x + s * 0.66, y + s * 0.86, x + s, y + s * 0.86);
      break;
    // A calendar leaf with a span struck through it.
    case 'vacation':
      doc.rect(x + s * 0.06, y + s * 0.16, s * 0.88, s * 0.78, 'S');
      doc.line(x + s * 0.06, y + s * 0.42, x + s * 0.94, y + s * 0.42);
      doc.line(x + s * 0.28, y, x + s * 0.28, y + s * 0.28);
      doc.line(x + s * 0.72, y, x + s * 0.72, y + s * 0.28);
      doc.line(x + s * 0.22, y + s * 0.68, x + s * 0.78, y + s * 0.68);
      break;
    // The warning triangle, drawn rather than filled.
    case 'incident':
      doc.line(x + s * 0.5, y + s * 0.04, x + s * 0.02, y + s * 0.92);
      doc.line(x + s * 0.02, y + s * 0.92, x + s * 0.98, y + s * 0.92);
      doc.line(x + s * 0.98, y + s * 0.92, x + s * 0.5, y + s * 0.04);
      doc.line(x + s * 0.5, y + s * 0.38, x + s * 0.5, y + s * 0.66);
      doc.circle(x + s * 0.5, y + s * 0.79, s * 0.04, 'S');
      break;
    // Two stops joined by the leg between them.
    case 'tour':
      doc.circle(x + s * 0.18, y + s * 0.24, s * 0.16, 'S');
      doc.circle(x + s * 0.82, y + s * 0.78, s * 0.16, 'S');
      doc.line(x + s * 0.32, y + s * 0.34, x + s * 0.68, y + s * 0.68);
      break;
    // A flight case seen head-on.
    case 'equipment':
      doc.rect(x + s * 0.04, y + s * 0.18, s * 0.92, s * 0.66, 'S');
      doc.line(x + s * 0.04, y + s * 0.38, x + s * 0.96, y + s * 0.38);
      doc.line(x + s * 0.38, y + s * 0.18, x + s * 0.38, y + s * 0.84);
      break;
    // Gain: a small signal in, a large one out.
    case 'amplifier':
      doc.line(x, y + s * 0.5, x + s * 0.2, y + s * 0.5);
      doc.line(x + s * 0.2, y + s * 0.12, x + s * 0.2, y + s * 0.88);
      doc.line(x + s * 0.2, y + s * 0.12, x + s * 0.86, y + s * 0.5);
      doc.line(x + s * 0.2, y + s * 0.88, x + s * 0.86, y + s * 0.5);
      doc.line(x + s * 0.86, y + s * 0.5, x + s, y + s * 0.5);
      break;
    // A distribution box with the supply entering it.
    case 'power':
      doc.roundedRect(x + s * 0.1, y + s * 0.18, s * 0.8, s * 0.7, s * 0.07, s * 0.07, 'S');
      doc.circle(x + s * 0.34, y + s * 0.42, s * 0.06, 'S');
      doc.circle(x + s * 0.66, y + s * 0.42, s * 0.06, 'S');
      doc.line(x + s * 0.3, y + s * 0.68, x + s * 0.7, y + s * 0.68);
      doc.line(x + s * 0.5, y, x + s * 0.5, y + s * 0.18);
      break;
    // A hoist hanging from a beam: the load path the report checks.
    case 'rigging':
      doc.line(x, y + s * 0.08, x + s, y + s * 0.08);
      doc.line(x + s * 0.5, y + s * 0.08, x + s * 0.5, y + s * 0.5);
      doc.rect(x + s * 0.28, y + s * 0.5, s * 0.44, s * 0.3, 'S');
      doc.line(x + s * 0.5, y + s * 0.8, x + s * 0.5, y + s);
      break;
    // Ruled rows against a time axis.
    case 'schedule':
    default:
      doc.line(x, y + s * 0.06, x, y + s * 0.94);
      doc.line(x + s * 0.06, y + s * 0.22, x + s * 0.56, y + s * 0.22);
      doc.line(x + s * 0.06, y + s * 0.5, x + s, y + s * 0.5);
      doc.line(x + s * 0.06, y + s * 0.78, x + s * 0.74, y + s * 0.78);
      break;
  }
};

/**
 * The mark for `kind` as a drawer the chrome can call, so a document names its
 * type once and never repeats the geometry.
 */
export const reportMark =
  (kind: ReportDocKind) =>
  (doc: jsPDF, x: number, y: number, mm: number, sizeMm: number): void =>
    drawReportTypeMark(doc, kind, x, y, mm, FESTIVAL_ACCENT, sizeMm);
