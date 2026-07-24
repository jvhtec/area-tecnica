import type jsPDF from 'jspdf';
import type { PdfRgb } from '@/utils/pdf/exportHelpers';
import {
  FESTIVAL_ACCENT,
  FESTIVAL_FAINT,
  FESTIVAL_HAIRLINE,
  FESTIVAL_INK,
  FESTIVAL_RULE,
  FESTIVAL_RULE_WEIGHT,
  FESTIVAL_SOFT,
  festivalGeometry,
  setFestivalMonoText,
  setFestivalText,
  type FestivalGeometry,
} from './tokens';

/**
 * Document types in the festival set. Each one gets its own line mark in the
 * header so the document identifies itself before anyone reads the title —
 * wayfinding for a bundle where a dozen report types reach the same crew.
 */
export type FestivalDocKind =
  | 'set'
  | 'programme'
  | 'artist'
  | 'rf'
  | 'infra'
  | 'mics'
  | 'gear'
  | 'shifts'
  | 'riders'
  | 'weather';

export const FESTIVAL_DOC_LABELS: Record<FestivalDocKind, string> = {
  set: 'Documentación del festival',
  programme: 'Programa del día',
  artist: 'Ficha de artista',
  rf: 'RF e IEM',
  infra: 'Infraestructura',
  mics: 'Microfonía cableada',
  gear: 'Dotación de escenario',
  shifts: 'Turnos de personal',
  riders: 'Riders pendientes',
  weather: 'Previsión meteorológica',
};

/**
 * Draws the document-type mark: a line drawing, never filled, in the accent.
 * `sizeMm` is expressed in millimetres and scaled by the caller's unit.
 */
export const drawFestivalTypeMark = (
  doc: jsPDF,
  kind: FestivalDocKind,
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
    case 'programme':
    case 'set':
      doc.line(x, y + s * 0.22, x + s * 0.72, y + s * 0.22);
      doc.line(x, y + s * 0.5, x + s, y + s * 0.5);
      doc.line(x, y + s * 0.78, x + s * 0.46, y + s * 0.78);
      break;
    case 'rf':
      doc.line(x + s * 0.5, y + s * 0.1, x + s * 0.5, y + s);
      doc.line(x + s * 0.5, y + s * 0.32, x + s * 0.06, y + s * 0.06);
      doc.line(x + s * 0.5, y + s * 0.32, x + s * 0.94, y + s * 0.06);
      break;
    case 'infra':
      doc.circle(x + s * 0.2, y + s * 0.28, s * 0.13, 'S');
      doc.circle(x + s * 0.8, y + s * 0.28, s * 0.13, 'S');
      doc.line(x + s * 0.2, y + s * 0.41, x + s * 0.2, y + s * 0.86);
      doc.line(x + s * 0.2, y + s * 0.86, x + s * 0.8, y + s * 0.86);
      doc.line(x + s * 0.8, y + s * 0.86, x + s * 0.8, y + s * 0.41);
      break;
    case 'mics':
      doc.roundedRect(x + s * 0.32, y, s * 0.36, s * 0.5, s * 0.18, s * 0.18, 'S');
      doc.line(x + s * 0.5, y + s * 0.5, x + s * 0.5, y + s * 0.86);
      doc.line(x + s * 0.24, y + s * 0.86, x + s * 0.76, y + s * 0.86);
      break;
    case 'gear':
      doc.rect(x + s * 0.16, y, s * 0.68, s, 'S');
      doc.circle(x + s * 0.5, y + s * 0.3, s * 0.12, 'S');
      doc.circle(x + s * 0.5, y + s * 0.7, s * 0.19, 'S');
      break;
    case 'shifts':
      doc.circle(x + s * 0.5, y + s * 0.5, s * 0.46, 'S');
      doc.line(x + s * 0.5, y + s * 0.22, x + s * 0.5, y + s * 0.52);
      doc.line(x + s * 0.5, y + s * 0.52, x + s * 0.76, y + s * 0.62);
      break;
    case 'riders':
      doc.line(x + s * 0.16, y, x + s * 0.68, y);
      doc.line(x + s * 0.16, y, x + s * 0.16, y + s);
      doc.line(x + s * 0.16, y + s, x + s * 0.84, y + s);
      doc.line(x + s * 0.84, y + s, x + s * 0.84, y + s * 0.18);
      doc.line(x + s * 0.68, y, x + s * 0.84, y + s * 0.18);
      break;
    case 'weather':
      doc.circle(x + s * 0.34, y + s * 0.36, s * 0.2, 'S');
      doc.line(x + s * 0.2, y + s * 0.78, x + s * 0.86, y + s * 0.78);
      doc.line(x + s * 0.3, y + s * 0.96, x + s * 0.76, y + s * 0.96);
      break;
    case 'artist':
    default:
      doc.line(x, y + s, x + s, y + s);
      doc.line(x + s * 0.5, y, x + s * 0.5, y + s * 0.62);
      doc.circle(x + s * 0.5, y + s * 0.62, s * 0.16, 'S');
      break;
  }
};

export interface FestivalChromeOptions {
  kind: FestivalDocKind;
  /** Overrides the default label for the document type. */
  kindLabel?: string;
  /** Event/festival name — carried by the rail so a single printed page still identifies itself. */
  eventTitle?: string;
  /** Second rail segment: stage, date or department. */
  contextLabel?: string;
  /** Issuer line in the footer. */
  issuer?: string;
  /**
   * Page numbering. `self` stamps `NN / NN` for a standalone document; `none`
   * leaves the slot empty because the merged set stamps continuous numbers.
   */
  pageNumber?: number;
  totalPages?: number;
  paginate?: boolean;
}

/**
 * Draws the running head, the vertical rail and the footer on the current page.
 * Everything the chrome needs is typographic — no filled bands, no logo repeats.
 */
export const drawFestivalChrome = (
  doc: jsPDF,
  options: FestivalChromeOptions,
): FestivalGeometry => {
  const geo = festivalGeometry(doc);
  const { mm } = geo;
  const label = (options.kindLabel ?? FESTIVAL_DOC_LABELS[options.kind]).toUpperCase();

  setFestivalText(doc, FESTIVAL_INK, 8.5, 'bold');
  doc.text('SECTOR-PRO', geo.left, geo.headerRuleY - 6.4 * mm, { charSpace: 0.35 * mm });

  // The mark sits to the right of its label, both resting on the same baseline.
  // The label is measured and placed from the left because jsPDF's right
  // alignment ignores `charSpace`, which would run the type into the mark.
  const markSize = 6;
  const markX = geo.right - markSize * mm;
  const labelBaseline = geo.headerRuleY - 6.4 * mm;
  drawFestivalTypeMark(
    doc,
    options.kind,
    markX,
    labelBaseline - markSize * mm,
    mm,
    FESTIVAL_ACCENT,
    markSize,
  );

  setFestivalMonoText(doc, FESTIVAL_SOFT, 5.6, 'bold');
  const labelTracking = 0.18 * mm;
  const labelWidth = doc.getTextWidth(label) + Math.max(0, label.length - 1) * labelTracking;
  doc.text(label, markX - 4 * mm - labelWidth, labelBaseline, { charSpace: labelTracking });

  doc.setDrawColor(...FESTIVAL_ACCENT);
  doc.setLineWidth(FESTIVAL_RULE_WEIGHT * mm);
  doc.line(geo.left, geo.headerRuleY, geo.right, geo.headerRuleY);

  if (!geo.landscape) {
    const rail = [options.eventTitle, options.contextLabel]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join('  ·  ')
      .toUpperCase();
    if (rail) {
      setFestivalMonoText(doc, FESTIVAL_FAINT, 5.6);
      doc.text(truncateToWidth(doc, rail, geo.contentBottom - geo.contentTop), geo.railX, geo.contentBottom, {
        angle: 90,
        charSpace: 0.2 * mm,
      });
    }
  }

  doc.setDrawColor(...FESTIVAL_RULE);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  doc.line(geo.left, geo.footerRuleY, geo.right, geo.footerRuleY);

  setFestivalMonoText(doc, FESTIVAL_SOFT, 5.6);
  const issuer = (options.issuer ?? `Sector-Pro  ·  ${label}`).toUpperCase();
  doc.text(truncateToWidth(doc, issuer, geo.contentWidth * 0.7), geo.left, geo.footerTextY, {
    charSpace: 0.18 * mm,
  });

  if (options.paginate !== false && options.pageNumber && options.totalPages) {
    setFestivalMonoText(doc, FESTIVAL_INK, 7.5, 'bold');
    const total = ` / ${String(options.totalPages).padStart(2, '0')}`;
    const totalWidth = doc.getTextWidth(total);
    doc.text(String(options.pageNumber).padStart(2, '0'), geo.right - totalWidth, geo.footerTextY, {
      align: 'right',
    });
    setFestivalMonoText(doc, FESTIVAL_FAINT, 7.5, 'bold');
    doc.text(total, geo.right, geo.footerTextY, { align: 'right' });
  }

  return geo;
};

/** Trims a string with an ellipsis so it never runs past `maxWidth`. */
export const truncateToWidth = (doc: jsPDF, value: string, maxWidth: number): string => {
  if (!value) return '';
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && doc.getTextWidth(`${text}…`) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text.trimEnd()}…`;
};

export interface FestivalTitleBlockOptions {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Optional client mark, already loaded. Placed once, top right. */
  clientLogo?: HTMLImageElement | null;
  clientLogoFormat?: 'PNG' | 'JPEG';
}

/**
 * Typographic title block: accent eyebrow, tight display title, soft subtitle.
 * Returns the Y at which the next block may start.
 */
export const drawFestivalTitleBlock = (
  doc: jsPDF,
  geo: FestivalGeometry,
  options: FestivalTitleBlockOptions,
): number => {
  const { mm } = geo;
  let y = geo.contentTop;

  if (options.eyebrow) {
    setFestivalMonoText(doc, FESTIVAL_ACCENT, 6.2, 'bold');
    doc.text(options.eyebrow.toUpperCase(), geo.left, y, { charSpace: 0.35 * mm });
    y += 8 * mm;
  } else {
    y += 4 * mm;
  }

  const logoWidth = options.clientLogo ? 26 * mm : 0;
  const titleWidth = geo.contentWidth - (logoWidth ? logoWidth + 8 * mm : 0);

  let size = geo.landscape ? 20 : 22;
  let lines: string[] = [];
  do {
    setFestivalText(doc, FESTIVAL_INK, size, 'bold');
    lines = doc.splitTextToSize(options.title, titleWidth) as string[];
    if (lines.length > 2) size -= 1.5;
  } while (lines.length > 2 && size > 12);
  lines = lines.slice(0, 2);

  doc.text(lines, geo.left, y, { lineHeightFactor: 0.94, charSpace: -0.06 * mm });
  y += (lines.length - 1) * size * 0.94 * 0.3528 * mm + 6 * mm;

  if (options.subtitle) {
    setFestivalText(doc, FESTIVAL_SOFT, 9);
    doc.text(truncateToWidth(doc, options.subtitle, titleWidth), geo.left, y);
    y += 5 * mm;
  }

  if (options.clientLogo && options.clientLogo.width > 0 && options.clientLogo.height > 0) {
    try {
      const ratio = options.clientLogo.width / options.clientLogo.height;
      const maxHeight = 12 * mm;
      const width = Math.min(logoWidth, maxHeight * ratio);
      const height = width / Math.max(ratio, 0.01);
      doc.addImage(
        options.clientLogo,
        options.clientLogoFormat ?? 'PNG',
        geo.right - width,
        geo.contentTop - 1 * mm,
        width,
        height,
      );
    } catch (error) {
      console.warn('No se pudo añadir el logotipo del cliente:', error);
    }
  }

  return y + 4 * mm;
};

export interface FestivalMetaItem {
  label: string;
  value: string;
}

/**
 * Equal-width meta cells between two hairlines. Conditions travel with the
 * page rather than living only on the first one.
 */
export const drawFestivalMetaGrid = (
  doc: jsPDF,
  geo: FestivalGeometry,
  items: FestivalMetaItem[],
  y: number,
): number => {
  if (items.length === 0) return y;
  const { mm } = geo;
  const columnWidth = geo.contentWidth / items.length;

  doc.setDrawColor(...FESTIVAL_RULE);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  doc.line(geo.left, y, geo.right, y);

  items.forEach((item, index) => {
    const x = geo.left + columnWidth * index;
    setFestivalMonoText(doc, FESTIVAL_SOFT, 5.4, 'bold');
    doc.text(item.label.toUpperCase(), x, y + 4.6 * mm, { charSpace: 0.22 * mm });
    setFestivalText(doc, FESTIVAL_INK, 8, 'bold');
    doc.text(truncateToWidth(doc, item.value, columnWidth - 3 * mm), x, y + 10 * mm);
  });

  const bottom = y + 13.5 * mm;
  doc.setDrawColor(...FESTIVAL_RULE);
  doc.line(geo.left, bottom, geo.right, bottom);
  return bottom + 8 * mm;
};

/**
 * Numbered section mark: accent number, caps heading, then a hairline filling
 * the remaining width. Only number things that are genuinely a sequence.
 */
export const drawFestivalSectionHeading = (
  doc: jsPDF,
  geo: FestivalGeometry,
  title: string,
  y: number,
  number?: number | string,
): number => {
  const { mm } = geo;
  const heading = title.toUpperCase();
  let headingX = geo.left;

  if (number !== undefined) {
    const label = typeof number === 'number' ? String(number).padStart(2, '0') : number;
    setFestivalMonoText(doc, FESTIVAL_ACCENT, 6.5, 'bold');
    doc.text(label, geo.left, y);
    headingX = geo.left + 8 * mm;
  }

  setFestivalText(doc, FESTIVAL_INK, 8.5, 'bold');
  doc.text(heading, headingX, y, { charSpace: 0.35 * mm });
  const headingWidth =
    doc.getTextWidth(heading) + Math.max(0, heading.length - 1) * 0.35 * mm;

  doc.setDrawColor(...FESTIVAL_RULE);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  const ruleStart = Math.min(geo.right - 6 * mm, headingX + headingWidth + 5 * mm);
  doc.line(ruleStart, y - 1 * mm, geo.right, y - 1 * mm);

  return y + 6.5 * mm;
};
