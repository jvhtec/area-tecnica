import type jsPDF from 'jspdf';
import type { PdfRgb } from '@/utils/pdf/exportHelpers';

/**
 * Design tokens for the festival documentation set.
 *
 * These mirror the system already shipped for the Soundvision report and the
 * power/weight reports: a warm near-black for copy, one accent that only ever
 * rules or marks, and hairline dividers instead of filled bands. Geometry is
 * declared in millimetres and scaled to the document's own unit at draw time.
 */

export const FESTIVAL_INK: PdfRgb = [23, 20, 15];
export const FESTIVAL_SOFT: PdfRgb = [122, 115, 106];
export const FESTIVAL_FAINT: PdfRgb = [183, 176, 166];
export const FESTIVAL_ACCENT: PdfRgb = [125, 1, 1];
export const FESTIVAL_ACCENT_BRIGHT: PdfRgb = [188, 58, 58];
export const FESTIVAL_RULE: PdfRgb = [228, 223, 214];
export const FESTIVAL_TRACK: PdfRgb = [237, 233, 225];
export const FESTIVAL_PAPER_TINT: PdfRgb = [250, 248, 244];
export const FESTIVAL_COVER: PdfRgb = [10, 10, 9];
export const FESTIVAL_PAPER: PdfRgb = [255, 255, 255];

/** Flag boxes — one border, one ground, one label colour, three labels. */
export const FESTIVAL_FLAG_BORDER: PdfRgb = [223, 203, 154];
export const FESTIVAL_FLAG_GROUND: PdfRgb = [251, 247, 238];
export const FESTIVAL_FLAG_LABEL: PdfRgb = [122, 90, 22];

/** Soundcheck bars on the day programme sit behind the show bars. */
export const FESTIVAL_TIMELINE_SOUNDCHECK: PdfRgb = [207, 200, 187];

/** Points per millimetre — jsPDF's own scale factor for a document in mm. */
const POINTS_PER_MM = 2.834645669291339;

/**
 * Millimetres per document unit. Every geometry constant here is declared in
 * millimetres and multiplied by this factor, so the same numbers lay out a
 * document whatever unit it was created in.
 *
 * The unit is read from jsPDF's own scale factor — points per user unit, so 1
 * for a points document and 2.83 for a millimetre one. Inferring it from the
 * page width instead put every A3 sheet in millimetres (420 mm wide) on the
 * points branch, and drew its chrome 2.83 times too large.
 */
export const festivalUnitScale = (doc: jsPDF): number => {
  const scaleFactor = doc.internal.scaleFactor;
  if (typeof scaleFactor !== 'number' || !Number.isFinite(scaleFactor)) {
    return doc.internal.pageSize.getWidth() > 400 ? POINTS_PER_MM : 1;
  }
  // A points document reports 1 point per unit; its geometry needs scaling up.
  return scaleFactor < 1.5 ? POINTS_PER_MM : 1;
};

export interface FestivalGeometry {
  /** Millimetres-to-unit scale factor for the document. */
  mm: number;
  pageWidth: number;
  pageHeight: number;
  landscape: boolean;
  /** Left content edge. */
  left: number;
  /** Right content edge. */
  right: number;
  contentWidth: number;
  /** Baseline of the hairline rule that closes the header. */
  headerRuleY: number;
  /** First usable Y for body content. */
  contentTop: number;
  /** Last usable Y for body content before the footer rule. */
  contentBottom: number;
  footerRuleY: number;
  footerTextY: number;
  /** X of the vertical rail (portrait only). */
  railX: number;
}

/**
 * Bottom-edge values are insets from the foot of the sheet, not absolute Ys:
 * an A3 page is 87 mm taller than A4, and pinning the footer to A4's height
 * floated it in the middle of the sheet with content running underneath.
 */
const PORTRAIT = {
  left: 25.4,
  rightInset: 16.4,
  headerRuleY: 26,
  contentTop: 40,
  contentBottomInset: 25,
  footerRuleInset: 18.5,
  footerTextInset: 15,
  railX: 13.2,
} as const;

const LANDSCAPE = {
  left: 22,
  rightInset: 16,
  headerRuleY: 22,
  contentTop: 33,
  contentBottomInset: 24,
  footerRuleInset: 18,
  footerTextInset: 14.5,
  railX: 12,
} as const;

/**
 * Resolves the page geometry for a document in its own units. Landscape sheets
 * take tighter margins and drop the vertical rail, which has no room on a page
 * already identified by its running head.
 */
export const festivalGeometry = (doc: jsPDF): FestivalGeometry => {
  const mm = festivalUnitScale(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const landscape = pageWidth > pageHeight;
  const spec = landscape ? LANDSCAPE : PORTRAIT;

  return {
    mm,
    pageWidth,
    pageHeight,
    landscape,
    left: spec.left * mm,
    right: pageWidth - spec.rightInset * mm,
    contentWidth: pageWidth - (spec.left + spec.rightInset) * mm,
    headerRuleY: spec.headerRuleY * mm,
    contentTop: spec.contentTop * mm,
    contentBottom: pageHeight - spec.contentBottomInset * mm,
    footerRuleY: pageHeight - spec.footerRuleInset * mm,
    footerTextY: pageHeight - spec.footerTextInset * mm,
    railX: spec.railX * mm,
  };
};

/** Hairline weights. Nothing in this system is heavier than the totals rule. */
export const FESTIVAL_HAIRLINE = 0.25;
export const FESTIVAL_RULE_WEIGHT = 0.35;
export const FESTIVAL_TOTALS_WEIGHT = 0.55;

export const setFestivalSans = (doc: jsPDF, style: 'normal' | 'bold' = 'normal'): void => {
  doc.setFont('helvetica', style);
};

/** Mono carries everything measured, counted or indexed. Never prose. */
export const setFestivalMono = (doc: jsPDF, style: 'normal' | 'bold' = 'normal'): void => {
  doc.setFont('courier', style);
};

export const setFestivalText = (
  doc: jsPDF,
  color: PdfRgb,
  size: number,
  style: 'normal' | 'bold' = 'normal',
): void => {
  setFestivalSans(doc, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

export const setFestivalMonoText = (
  doc: jsPDF,
  color: PdfRgb,
  size: number,
  style: 'normal' | 'bold' = 'normal',
): void => {
  setFestivalMono(doc, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};
