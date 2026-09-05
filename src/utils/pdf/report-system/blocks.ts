import type jsPDF from 'jspdf';
import {
  REPORT_ACCENT,
  REPORT_HAIRLINE,
  REPORT_INK,
  REPORT_RULE,
  REPORT_SOFT,
  drawReportTotalsRule,
  setReportMonoText,
  setReportText,
  truncateToWidth,
  type ReportGeometry,
} from './index';

/**
 * A named entry inside a section — a technician, a stage, a vehicle. Set in ink
 * rather than the accent: the accent belongs to the section it sits under, and
 * repeating it once per row makes a page of headings that all shout.
 */
export const drawReportEntryHeading = (
  doc: jsPDF,
  geo: ReportGeometry,
  name: string,
  y: number,
  trailing?: string,
): number => {
  const { mm } = geo;
  setReportText(doc, REPORT_INK, 8.2, 'bold');
  doc.text(truncateToWidth(doc, name, geo.contentWidth - 36 * mm), geo.left, y);

  if (trailing) {
    setReportMonoText(doc, REPORT_SOFT, 6.4, 'bold');
    doc.text(trailing, geo.right, y, { align: 'right' });
  }

  doc.setDrawColor(...REPORT_RULE);
  doc.setLineWidth(REPORT_HAIRLINE * mm);
  doc.line(geo.left, y + 1.8 * mm, geo.right, y + 1.8 * mm);

  return y + 5.6 * mm;
};

/**
 * A bullet list of plain facts — extras, expense categories, per-day lines.
 * The label runs left, the figure is right-aligned in mono so a column of them
 * can be read down without the eye hunting for the decimal point.
 */
export const drawReportItemLine = (
  doc: jsPDF,
  geo: ReportGeometry,
  label: string,
  value: string,
  y: number,
  options: { indent?: number } = {},
): number => {
  const { mm } = geo;
  const indent = (options.indent ?? 4) * mm;
  setReportText(doc, REPORT_SOFT, 7.4);
  doc.text(
    truncateToWidth(doc, label, geo.contentWidth - indent - 34 * mm),
    geo.left + indent,
    y,
  );
  setReportMonoText(doc, REPORT_INK, 7, 'bold');
  doc.text(value, geo.right, y, { align: 'right' });
  return y + 4.4 * mm;
};

/**
 * Conditions and caveats. They are not errors, so they are not in the accent;
 * they are not decoration either, so each one is marked with an accent rule at
 * the left edge and set in ink rather than the grey the eye skips.
 */
export const drawReportNotes = (
  doc: jsPDF,
  geo: ReportGeometry,
  notes: string[],
  y: number,
): number => {
  const present = notes.map((note) => note.trim()).filter(Boolean);
  if (present.length === 0) return y;

  const { mm } = geo;
  let cursor = y + 2 * mm;

  present.forEach((note) => {
    setReportText(doc, REPORT_INK, 6.8);
    const lines = doc.splitTextToSize(note, geo.contentWidth - 5 * mm) as string[];
    const height = lines.length * 3.1 * mm;

    doc.setDrawColor(...REPORT_ACCENT);
    doc.setLineWidth(0.5 * mm);
    doc.line(geo.left, cursor - 2.4 * mm, geo.left, cursor + height - 3 * mm);

    doc.text(lines, geo.left + 3 * mm, cursor, { lineHeightFactor: 1.24 });
    cursor += height + 2.2 * mm;
  });

  return cursor + 1 * mm;
};

export interface ReportTotalsLine {
  label: string;
  value: string;
}

/**
 * The totals block: subtotals stacked in mono over a heavier ink rule, and the
 * one figure that matters set large beneath it. There is no tinted panel — the
 * rule already says "this is the bottom of the arithmetic", and a grey box
 * around it only adds a shape the reader has to look past.
 */
export const drawReportTotals = (
  doc: jsPDF,
  geo: ReportGeometry,
  y: number,
  options: {
    heading?: string;
    lines: ReportTotalsLine[];
    total: ReportTotalsLine;
  },
): number => {
  const { mm } = geo;
  let cursor = y;

  if (options.heading) {
    setReportMonoText(doc, REPORT_SOFT, 5.6, 'bold');
    doc.text(options.heading.toUpperCase(), geo.left, cursor, { charSpace: 0.22 * mm });
    cursor += 5.4 * mm;
  }

  options.lines.forEach((line) => {
    setReportText(doc, REPORT_SOFT, 7.4);
    doc.text(line.label, geo.left, cursor);
    setReportMonoText(doc, REPORT_INK, 7.4);
    doc.text(line.value, geo.right, cursor, { align: 'right' });
    cursor += 4.6 * mm;
  });

  cursor += 1.4 * mm;
  drawReportTotalsRule(doc, geo, cursor);
  cursor += 6.2 * mm;

  setReportText(doc, REPORT_INK, 8.4, 'bold');
  doc.text(options.total.label.toUpperCase(), geo.left, cursor, { charSpace: 0.3 * mm });
  setReportMonoText(doc, REPORT_ACCENT, 12, 'bold');
  doc.text(options.total.value, geo.right, cursor + 0.6 * mm, { align: 'right' });

  return cursor + 6 * mm;
};

/**
 * A single measured figure with its label above it — the one number a reader
 * should leave the page with.
 */
export const drawReportHeadlineFigure = (
  doc: jsPDF,
  geo: ReportGeometry,
  y: number,
  options: { label: string; value: string; support?: string; x?: number; width?: number },
): number => {
  const { mm } = geo;
  const x = options.x ?? geo.left;
  const width = options.width ?? geo.contentWidth;

  setReportMonoText(doc, REPORT_SOFT, 5.8, 'bold');
  doc.text(options.label.toUpperCase(), x, y, { charSpace: 0.22 * mm });

  setReportText(doc, REPORT_INK, 20, 'bold');
  doc.text(truncateToWidth(doc, options.value, width), x, y + 8.6 * mm);

  let cursor = y + 11.6 * mm;
  if (options.support) {
    setReportText(doc, REPORT_SOFT, 6.6);
    const lines = doc.splitTextToSize(options.support, width) as string[];
    doc.text(lines, x, cursor + 2.4 * mm, { lineHeightFactor: 1.2 });
    cursor += 2.4 * mm + lines.length * 3 * mm;
  }
  return cursor;
};

/**
 * A definition block: a mono label in the left column, the value beside it,
 * wrapping as needed. Used where a handful of named facts open a page and a
 * table would be three lines of chrome around two lines of content.
 */
export const drawReportFactRows = (
  doc: jsPDF,
  geo: ReportGeometry,
  rows: Array<[string, string]>,
  y: number,
  options: { labelWidthMm?: number } = {},
): number => {
  const { mm } = geo;
  const labelWidth = (options.labelWidthMm ?? 34) * mm;
  let cursor = y;

  rows.forEach(([label, value]) => {
    setReportMonoText(doc, REPORT_SOFT, 5.8, 'bold');
    doc.text(label.toUpperCase(), geo.left, cursor, { charSpace: 0.2 * mm });

    setReportText(doc, REPORT_INK, 8);
    const lines = doc.splitTextToSize(value, geo.contentWidth - labelWidth) as string[];
    doc.text(lines, geo.left + labelWidth, cursor, { lineHeightFactor: 1.25 });
    cursor += Math.max(1, lines.length) * 4.2 * mm;
  });

  return cursor + 3 * mm;
};

/**
 * Body copy: what the writer actually wrote, set in ink at reading size rather
 * than inside a tinted panel. The section heading above it already says what
 * the text is, so the panel only adds an edge to look past.
 */
export const drawReportProse = (
  doc: jsPDF,
  geo: ReportGeometry,
  text: string,
  y: number,
): number => {
  const { mm } = geo;
  const content = text?.trim();
  setReportText(doc, content ? REPORT_INK : REPORT_SOFT, 8);
  const lines = doc.splitTextToSize(content || 'Sin información.', geo.contentWidth) as string[];
  doc.text(lines, geo.left, y, { lineHeightFactor: 1.35 });
  return y + lines.length * 4 * mm + 3 * mm;
};
