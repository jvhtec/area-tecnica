import type jsPDF from 'jspdf';
import type { CellHookData } from 'jspdf-autotable';
import type { PdfRgb } from '@/utils/pdf/exportHelpers';
import {
  FESTIVAL_ACCENT,
  FESTIVAL_FAINT,
  FESTIVAL_FLAG_BORDER,
  FESTIVAL_FLAG_GROUND,
  FESTIVAL_FLAG_LABEL,
  FESTIVAL_HAIRLINE,
  FESTIVAL_INK,
  FESTIVAL_PAPER_TINT,
  FESTIVAL_RULE,
  FESTIVAL_SOFT,
  FESTIVAL_TOTALS_WEIGHT,
  FESTIVAL_TRACK,
  setFestivalMonoText,
  setFestivalText,
  type FestivalGeometry,
} from './tokens';
import { truncateToWidth } from './chrome';

/**
 * Three flag labels only: two parts of the document disagree, demand exceeds
 * supply, or a value is missing. More labels than that and nobody learns what
 * they mean.
 */
export type FestivalFlagLabel = 'Conflicto' | 'Déficit' | 'Revisar';

/**
 * Ledger table styling for jspdf-autotable. No fills, no zebra striping, no
 * vertical rules and no outer border — rows are divided by hairlines drawn in
 * `didDrawCell`, and the header is underlined in ink.
 *
 * Spread the result into an `autoTable` call and merge extra `columnStyles`.
 */
export const festivalTableTheme = (
  geo: FestivalGeometry,
  options: {
    fontSize?: number;
    headFontSize?: number;
    cellPadding?: number;
    /** Columns whose figures are right-aligned in mono with tabular spacing. */
    numericColumns?: number[];
  } = {},
) => {
  const { mm } = geo;
  const fontSize = options.fontSize ?? 7.6;
  const numeric = new Set(options.numericColumns ?? []);

  return {
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontSize,
      cellPadding: { top: 1.9 * mm, right: 2 * mm, bottom: 1.9 * mm, left: 0 },
      textColor: FESTIVAL_INK as unknown as [number, number, number],
      valign: 'top' as const,
      overflow: 'linebreak' as const,
      lineWidth: 0,
    },
    headStyles: {
      font: 'courier',
      fontStyle: 'bold' as const,
      fontSize: options.headFontSize ?? Math.max(5.4, fontSize - 1.6),
      textColor: FESTIVAL_SOFT as unknown as [number, number, number],
      fillColor: false as unknown as [number, number, number],
      cellPadding: { top: 0, right: 2 * mm, bottom: 2.4 * mm, left: 0 },
      lineWidth: 0,
    },
    bodyStyles: { fillColor: false as unknown as [number, number, number] },
    alternateRowStyles: { fillColor: false as unknown as [number, number, number] },
    didParseCell: (data: CellHookData) => {
      if (!numeric.has(data.column.index)) return;

      // Figures are right-aligned in mono, and take extra padding on the right
      // so a right-aligned head never runs into the column beside it.
      data.cell.styles.halign = 'right';
      data.cell.styles.cellPadding = {
        top: data.section === 'head' ? 0 : 1.9 * mm,
        right: 4.5 * mm,
        bottom: data.section === 'head' ? 2.4 * mm : 1.9 * mm,
        left: 0,
      };

      if (data.section === 'body') {
        data.cell.styles.font = 'courier';
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data: CellHookData) => {
      const target = (data as unknown as { doc: jsPDF }).doc;
      if (!target) return;
      if (data.section === 'head') {
        target.setDrawColor(...FESTIVAL_INK);
        target.setLineWidth(FESTIVAL_HAIRLINE * mm);
        target.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height,
        );
        return;
      }
      if (data.section === 'body') {
        target.setDrawColor(...FESTIVAL_RULE);
        target.setLineWidth(FESTIVAL_HAIRLINE * mm);
        target.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height,
        );
      }
    },
  };
};

/**
 * A column whose value is identical in every row is not data. Lift it out of
 * the table and state it once, under the table, before reaching for landscape
 * orientation or a smaller type size.
 */
export const drawFestivalConstantsLine = (
  doc: jsPDF,
  geo: FestivalGeometry,
  constants: Array<{ label: string; value: string }>,
  y: number,
): number => {
  if (constants.length === 0) return y;
  const { mm } = geo;
  const text = constants.map(({ label, value }) => `${label}: ${value}`).join('   ·   ');
  setFestivalMonoText(doc, FESTIVAL_SOFT, 6);
  const lines = doc.splitTextToSize(text, geo.contentWidth) as string[];
  doc.text(lines, geo.left, y + 3.6 * mm, { lineHeightFactor: 1.3 });
  return y + 3.6 * mm + lines.length * 3.2 * mm;
};

/** Diagonal hatching, used wherever a value is missing or out of bounds. */
export const drawFestivalHatch = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  mm: number,
  color: PdfRgb = FESTIVAL_FAINT,
): void => {
  if (width <= 0 || height <= 0) return;
  const step = 1.8 * mm;
  doc.setDrawColor(...color);
  doc.setLineWidth(0.2 * mm);
  for (let offset = -height; offset < width; offset += step) {
    const x1 = Math.max(x, x + offset);
    const y1 = offset < 0 ? y - offset : y;
    const x2 = Math.min(x + width, x + offset + height);
    const y2 = y1 + (x2 - x1);
    if (x2 > x1 && y2 <= y + height) doc.line(x1, y1, x2, y2);
  }
};

export interface FestivalFlagOptions {
  label: FestivalFlagLabel;
  /** One sentence naming the conflict and the action required. */
  text: string;
  x?: number;
  width?: number;
}

/**
 * Flag box. It sits with the value it describes, not in a summary elsewhere —
 * a conflict visible in only one place gets missed by whoever reads the other.
 */
export const drawFestivalFlag = (
  doc: jsPDF,
  geo: FestivalGeometry,
  y: number,
  options: FestivalFlagOptions,
): number => {
  const { mm } = geo;
  const x = options.x ?? geo.left;
  const width = options.width ?? geo.contentWidth;

  setFestivalText(doc, FESTIVAL_INK, 7);
  const lines = doc.splitTextToSize(options.text, width - 8 * mm) as string[];
  const height = 9 * mm + lines.length * 3.4 * mm;

  doc.setFillColor(...FESTIVAL_FLAG_GROUND);
  doc.setDrawColor(...FESTIVAL_FLAG_BORDER);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  doc.rect(x, y, width, height, 'FD');

  setFestivalMonoText(doc, FESTIVAL_FLAG_LABEL, 5.6, 'bold');
  doc.text(options.label.toUpperCase(), x + 3 * mm, y + 4.4 * mm, { charSpace: 0.25 * mm });

  setFestivalText(doc, FESTIVAL_INK, 7);
  doc.text(lines, x + 3 * mm, y + 8.6 * mm, { lineHeightFactor: 1.25 });

  return y + height + 4 * mm;
};

/**
 * Nil state: the requirement is confirmed as nothing, not merely unknown.
 * "Nothing requested" needs no action; "not yet known" needs a phone call, and
 * a blank cell says both.
 */
export const drawFestivalNilState = (
  doc: jsPDF,
  geo: FestivalGeometry,
  y: number,
  text: string,
  options: { x?: number; width?: number } = {},
): number => {
  const { mm } = geo;
  const x = options.x ?? geo.left;
  const width = options.width ?? geo.contentWidth;

  setFestivalText(doc, FESTIVAL_SOFT, 7.4);
  const lines = doc.splitTextToSize(text, width - 8 * mm) as string[];
  const height = 7 * mm + lines.length * 3.4 * mm;

  doc.setFillColor(...FESTIVAL_PAPER_TINT);
  doc.rect(x, y, width, height, 'F');
  drawFestivalHatch(doc, x, y, width, height, mm, FESTIVAL_RULE);
  doc.setDrawColor(...FESTIVAL_RULE);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  doc.rect(x, y, width, height, 'S');

  setFestivalText(doc, FESTIVAL_SOFT, 7.4);
  doc.text(lines, x + 4 * mm, y + 5 * mm, { lineHeightFactor: 1.25 });

  return y + height + 4 * mm;
};

export interface FestivalGaugeOptions {
  label: string;
  demand: number;
  capacity: number | null;
  unit?: string;
  x?: number;
  width?: number;
}

/**
 * Capacity gauge. Demand fills the track in the accent; demand beyond capacity
 * continues as a hatched segment. This is the only place in the system where
 * the accent fills an area, and it earns the exception because the length of
 * the fill is itself the datum.
 */
export const drawFestivalGauge = (
  doc: jsPDF,
  geo: FestivalGeometry,
  y: number,
  options: FestivalGaugeOptions,
): number => {
  const { mm } = geo;
  const x = options.x ?? geo.left;
  const width = options.width ?? geo.contentWidth;
  const trackHeight = 2.4 * mm;
  const unit = options.unit ? ` ${options.unit}` : '';

  setFestivalText(doc, FESTIVAL_INK, 7.6, 'bold');
  doc.text(truncateToWidth(doc, options.label, width - 34 * mm), x, y);

  if (options.capacity === null || options.capacity <= 0) {
    setFestivalMonoText(doc, FESTIVAL_SOFT, 6.4, 'bold');
    doc.text(`${formatFestivalNumber(options.demand)}${unit}`, x + width, y, { align: 'right' });
    const trackY = y + 2.6 * mm;
    doc.setFillColor(...FESTIVAL_TRACK);
    doc.rect(x, trackY, width, trackHeight, 'F');
    drawFestivalHatch(doc, x, trackY, width, trackHeight, mm, FESTIVAL_FAINT);
    setFestivalMonoText(doc, FESTIVAL_SOFT, 5.4);
    doc.text('CAPACIDAD SIN DEFINIR', x, trackY + trackHeight + 3.2 * mm, { charSpace: 0.2 * mm });
    return trackY + trackHeight + 6 * mm;
  }

  const deficit = Math.max(0, options.demand - options.capacity);
  setFestivalMonoText(doc, deficit > 0 ? FESTIVAL_ACCENT : FESTIVAL_INK, 6.4, 'bold');
  doc.text(
    `${formatFestivalNumber(options.demand)} de ${formatFestivalNumber(options.capacity)}${unit}`,
    x + width,
    y,
    { align: 'right' },
  );

  const trackY = y + 2.6 * mm;
  const span = Math.max(options.demand, options.capacity);
  const capacityWidth = width * (options.capacity / span);
  const filledWidth = width * (Math.min(options.demand, options.capacity) / span);

  doc.setFillColor(...FESTIVAL_TRACK);
  doc.rect(x, trackY, width, trackHeight, 'F');
  doc.setFillColor(...FESTIVAL_ACCENT);
  doc.rect(x, trackY, filledWidth, trackHeight, 'F');

  if (deficit > 0) {
    const overflowWidth = width * (deficit / span);
    drawFestivalHatch(doc, x + capacityWidth, trackY, overflowWidth, trackHeight, mm, FESTIVAL_ACCENT);
    doc.setDrawColor(...FESTIVAL_ACCENT);
    doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
    doc.rect(x + capacityWidth, trackY, overflowWidth, trackHeight, 'S');
  }

  doc.setDrawColor(...FESTIVAL_INK);
  doc.setLineWidth(0.3 * mm);
  doc.line(x + capacityWidth, trackY - 0.8 * mm, x + capacityWidth, trackY + trackHeight + 0.8 * mm);

  return trackY + trackHeight + 5 * mm;
};

/** Totals rule: 1.5 px ink above the totals row, units stated once. */
export const drawFestivalTotalsRule = (
  doc: jsPDF,
  geo: FestivalGeometry,
  y: number,
): void => {
  doc.setDrawColor(...FESTIVAL_INK);
  doc.setLineWidth(FESTIVAL_TOTALS_WEIGHT * geo.mm);
  doc.line(geo.left, y, geo.right, y);
};

/** Spanish locale: decimal comma, thousands point. */
export const formatFestivalNumber = (value: number, decimals = 0): string =>
  Number.isFinite(value)
    ? value.toLocaleString('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : '—';

/**
 * Zero cells in a matrix render as a middot — present but visibly nothing,
 * which reads faster than a screen of noughts.
 */
export const FESTIVAL_MATRIX_ZERO = '·';
