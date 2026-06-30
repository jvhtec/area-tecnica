/**
 * Single public entry point for PDF generation utilities.
 *
 * New code should import from `@/utils/pdf` rather than reaching into the
 * individual modules. The pieces are split as:
 *  - `lazyPdf`         — lazy jsPDF / autotable loading
 *  - `exportHelpers`   — low-level document + data-URL/image primitives
 *  - `shared/pdfExportShared` — canonical corporate/festival header, footer
 *                        and table builders (the shared "chrome")
 *  - `logoUtils`       — branding/logo fetching from Supabase storage
 *  - `pdfFileNames`    — domain filename builders
 */

export * from '@/utils/pdf/lazyPdf';

// Low-level primitives (document creation, blob/data-url, safe image add,
// the dataURL-logo corporate header/footer, palette + layout constants).
export * from '@/utils/pdf/exportHelpers';

// Canonical shared chrome + image-element helpers. `PdfRgb` and
// `CorporateHeaderOptions` are intentionally omitted here because they collide
// with the identically named exports from `exportHelpers` above; import them
// from the specific module when the precise type is required.
export {
  CORPORATE_RED,
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_DARK,
  TABLE_STRIPE_COLOR,
  SUMMARY_BACKGROUND,
  CORPORATE_HEADER_HEIGHT,
  CORPORATE_HEADER_CONTENT_OFFSET,
  CORPORATE_FOOTER_RESERVED,
  FESTIVAL_HEADER_BAND_HEIGHT,
  SECTOR_PRO_LOGO_PATH,
  FALLBACK_BRAND_LOGO_PATH,
  FESTIVAL_TABLE_HEAD_STYLES,
  FESTIVAL_TABLE_BODY_STYLES,
  sanitizeFilenamePart,
  buildPdfFilename,
  loadImageSilently,
  loadImageWithTimeout,
  loadSectorProFooterLogo,
  inferPdfImageFormat,
  resolveHeaderLogo,
  addLogoConstrainedToHeight,
  drawCorporateHeader,
  drawCorporateFooter,
  corporateTableDefaults,
  drawFestivalHeaderBand,
  drawFestivalHeaderText,
  drawCenteredFooterLogo,
  drawFooterMetaText,
} from '@/utils/pdf/shared/pdfExportShared';
export type { PdfImageFormat, PdfLogo } from '@/utils/pdf/shared/pdfExportShared';

// Branding / logo fetching.
export { fetchJobLogo, fetchTourLogo, fetchLogoUrl, getCompanyLogo } from '@/utils/pdf/logoUtils';
