import type jsPDF from 'jspdf';
import { SECTOR_PRO_RED, type PdfRgb } from '@/utils/pdf/exportHelpers';
import { fetchJobLogo, fetchTourLogo } from '@/utils/pdf/logoUtils';
import { buildReadableFilename, sanitizeFilenamePart as sanitizeFileNamePart } from '@/utils/fileName';

export type { PdfRgb };
export type PdfImageFormat = 'PNG' | 'JPEG';

/**
 * A logo accepted by the shared header/footer builders. jsPDF's `addImage`
 * handles both an `HTMLImageElement` (intrinsic dimensions available for
 * aspect-ratio sizing) and a data-URL/`string` source, so both flavours are
 * supported through a single API.
 */
export type PdfLogo = HTMLImageElement | string | null | undefined;

const logoAspectRatio = (logo: PdfLogo): number => {
  if (logo && typeof logo !== 'string' && logo.width > 0 && logo.height > 0) {
    return logo.width / logo.height;
  }
  return 1.25; // default ratio used when intrinsic dimensions are unavailable
};

// ---------------------------------------------------------------------------
// Shared corporate palette
// ---------------------------------------------------------------------------

export const CORPORATE_RED: PdfRgb = SECTOR_PRO_RED;
export const TEXT_PRIMARY: PdfRgb = [31, 41, 55];
export const TEXT_MUTED: PdfRgb = [100, 116, 139];
export const TEXT_DARK: PdfRgb = [51, 51, 51];
export const TABLE_STRIPE_COLOR: PdfRgb = [248, 248, 248];
export const SUMMARY_BACKGROUND: PdfRgb = [250, 250, 250];

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Height of the corporate (rates-style) header band. */
export const CORPORATE_HEADER_HEIGHT = 44;
/** Y offset at which content starts below the corporate header. */
export const CORPORATE_HEADER_CONTENT_OFFSET = CORPORATE_HEADER_HEIGHT + 18;
/** Reserved space at the bottom for the corporate footer so tables/text never collide with it. */
export const CORPORATE_FOOTER_RESERVED = 38; // px, keep enough room for logo + page text

/** Height of the festival (artist-style) header band. */
export const FESTIVAL_HEADER_BAND_HEIGHT = 30;

// ---------------------------------------------------------------------------
// Logo asset paths
// ---------------------------------------------------------------------------

export const SECTOR_PRO_LOGO_PATH = '/sector pro logo.png';
export const FALLBACK_BRAND_LOGO_PATH = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

export const sanitizeFilenamePart = (value: string | null | undefined): string =>
  sanitizeFileNamePart(value, '');

export const buildPdfFilename = (
  parts: Array<string | null | undefined>,
  fallback = 'Documento',
): string => {
  const safeParts = parts.map((part) => sanitizeFilenamePart(part)).filter(Boolean);
  return buildReadableFilename(safeParts.length ? safeParts : [fallback], 'pdf');
};

// ---------------------------------------------------------------------------
// Image loading (HTMLImageElement onload promises)
// ---------------------------------------------------------------------------

/**
 * Quiet image loader: resolves to null when the source is missing, the Image
 * API is unavailable, or loading fails (logging a single warning).
 */
export const loadImageSilently = (
  src: string,
  description: string,
): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load ${description} from`, src);
      resolve(null);
    };
    img.src = src;
  });
};

/**
 * Verbose image loader with a 10 second timeout, used by the festival/artist
 * exporters. Resolves to null on timeout or load failure.
 */
export const loadImageWithTimeout = async (
  src: string,
  description: string,
): Promise<HTMLImageElement | null> => {
  console.log(`Loading ${description} from:`, src);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      console.warn(`Timeout loading ${description} from:`, src);
      resolve(null);
    }, 10000); // 10 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      console.log(`Successfully loaded ${description}`);
      resolve(img);
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`Failed to load ${description} from:`, src, error);
      resolve(null);
    };

    img.src = src;
  });
};

/** Loads the Sector Pro footer logo, falling back to the alternative asset. */
export const loadSectorProFooterLogo = async (): Promise<HTMLImageElement | null> =>
  (await loadImageWithTimeout(SECTOR_PRO_LOGO_PATH, 'Sector Pro logo')) ||
  (await loadImageWithTimeout(FALLBACK_BRAND_LOGO_PATH, 'alternative Sector Pro logo'));

export const inferPdfImageFormat = (
  source: string | HTMLImageElement | null | undefined,
  fallback: PdfImageFormat = 'PNG',
): PdfImageFormat => {
  const src = (
    typeof source === 'string' ? source : source?.currentSrc || source?.src || ''
  ).toLowerCase();

  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) {
    return 'JPEG';
  }
  if (src.startsWith('data:image/png')) return 'PNG';
  if (/\.jpe?g(?:[?#]|$)/.test(src)) return 'JPEG';
  if (/\.png(?:[?#]|$)/.test(src)) return 'PNG';
  return fallback;
};

/**
 * Resolves the branding logo (tour logo first, then job/festival logo) for the
 * corporate header and loads it as an image element.
 */
export const resolveHeaderLogo = async ({
  jobId,
  tourId,
}: {
  jobId?: string;
  tourId?: string | null;
}): Promise<HTMLImageElement | null> => {
  const [tourLogoUrl, jobLogoUrl] = await Promise.all([
    tourId ? fetchTourLogo(tourId) : Promise.resolve(undefined),
    jobId ? fetchJobLogo(jobId) : Promise.resolve(undefined),
  ]);

  const brandingUrl = tourLogoUrl || jobLogoUrl;
  if (!brandingUrl) {
    return null;
  }

  return loadImageSilently(brandingUrl, 'tour or job logo');
};

// ---------------------------------------------------------------------------
// Logo placement
// ---------------------------------------------------------------------------

/**
 * Adds a logo constrained to a maximum height while preserving aspect ratio.
 * Errors from jsPDF propagate to the caller.
 */
export const addLogoConstrainedToHeight = (
  doc: jsPDF,
  image: PdfLogo,
  format: 'PNG' | 'JPEG',
  x: number,
  y: number,
  maxHeight: number,
): void => {
  if (!image) return;
  const intrinsicHeight = typeof image === 'string' ? maxHeight : image.height || maxHeight;
  const logoHeight = Math.min(maxHeight, intrinsicHeight);
  const logoWidth = logoHeight * logoAspectRatio(image);
  doc.addImage(image, format, x, y, logoWidth, logoHeight);
};

// ---------------------------------------------------------------------------
// Corporate (rates-style) header & footer
// ---------------------------------------------------------------------------

export interface CorporateHeaderOptions {
  title: string;
  subtitle?: string;
  metadata?: string;
  logo?: PdfLogo;
}

/**
 * Draws the 44px corporate header band with optional logo, subtitle and
 * right-aligned metadata. Returns the Y offset where content should start.
 */
export const drawCorporateHeader = (
  doc: jsPDF,
  { title, subtitle, metadata, logo }: CorporateHeaderOptions,
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...CORPORATE_RED);
  doc.rect(0, 0, pageWidth, CORPORATE_HEADER_HEIGHT, 'F');

  if (logo) {
    try {
      const logoHeight = 26;
      const logoWidth = logoHeight * logoAspectRatio(logo);
      doc.addImage(logo, inferPdfImageFormat(logo), 16, 9, logoWidth, logoHeight);
    } catch (error) {
      console.error('Error adding logo to PDF header:', error);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(subtitle, pageWidth / 2, 31, { align: 'center' });
  }

  if (metadata) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(metadata, pageWidth - 18, CORPORATE_HEADER_HEIGHT - 10, { align: 'right' });
  }

  doc.setTextColor(...TEXT_PRIMARY);

  return CORPORATE_HEADER_CONTENT_OFFSET;
};

/**
 * Draws the corporate footer (centered logo, "Sector-Pro" label and
 * "Página X de Y" page numbers) on every page of the document.
 */
export const drawCorporateFooter = (doc: jsPDF, logo: PdfLogo): void => {
  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    doc.setPage(pageNumber);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const footerY = pageHeight - 12;

    if (logo) {
      try {
        const logoHeight = 12;
        const logoWidth = logoHeight * logoAspectRatio(logo);
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(
          logo,
          inferPdfImageFormat(logo),
          logoX,
          footerY - logoHeight - 3,
          logoWidth,
          logoHeight,
        );
      } catch (error) {
        console.error('Error adding logo to PDF footer:', error);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);

    doc.text('Sector-Pro', 18, footerY);

    const pageText = `Página ${pageNumber} de ${pageCount}`;
    doc.text(pageText, pageWidth - 18, footerY, { align: 'right' });
  }

  doc.setTextColor(...TEXT_PRIMARY);
};

/**
 * Shared autotable defaults for corporate (rates-style) documents: grid theme,
 * corporate head styles, striped rows, standard margins and header redraw on
 * page breaks.
 */
export const corporateTableDefaults = (
  doc: jsPDF,
  headerOptions: CorporateHeaderOptions,
  topMargin: number,
) => ({
  theme: 'grid' as const,
  headStyles: { fillColor: CORPORATE_RED, textColor: 255, fontStyle: 'bold' as const },
  alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
  margin: { left: 14, right: 14, top: topMargin, bottom: CORPORATE_FOOTER_RESERVED },
  didDrawPage: (data: { pageNumber: number }) => {
    if (data.pageNumber > 1) {
      drawCorporateHeader(doc, headerOptions);
    }
  },
});

// ---------------------------------------------------------------------------
// Festival (artist-style) header & footer
// ---------------------------------------------------------------------------

/** Fills the 30px festival header band in corporate red. */
export const drawFestivalHeaderBand = (doc: jsPDF): void => {
  const pageWidth = doc.internal.pageSize.width;
  doc.setFillColor(...CORPORATE_RED);
  doc.rect(0, 0, pageWidth, FESTIVAL_HEADER_BAND_HEIGHT, 'F');
};

/** Draws the centered white title and second line over the festival header band. */
export const drawFestivalHeaderText = (
  doc: jsPDF,
  title: string,
  secondLine: string,
): void => {
  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text(secondLine, pageWidth / 2, 25, { align: 'center' });
};

/**
 * Draws a horizontally centered footer logo (20px wide, aspect preserved) at
 * `bottomOffset` above the page bottom edge.
 */
export const drawCenteredFooterLogo = (
  doc: jsPDF,
  logo: PdfLogo,
  pageWidth: number,
  pageHeight: number,
  bottomOffset: number,
  errorMessage = 'Error adding footer logo to PDF:',
): void => {
  if (!logo) return;
  if (typeof logo !== 'string' && (!(logo.width > 0) || !(logo.height > 0))) return;

  try {
    const logoWidth = 20;
    const logoHeight = logoWidth / logoAspectRatio(logo);
    doc.addImage(
      logo,
      inferPdfImageFormat(logo),
      pageWidth / 2 - logoWidth / 2,
      pageHeight - logoHeight - bottomOffset,
      logoWidth,
      logoHeight,
    );
  } catch (error) {
    console.error(errorMessage, error);
  }
};

/**
 * Draws the small footer meta text (left-aligned text plus optional
 * right-aligned text) in dark gray, 8pt.
 */
export const drawFooterMetaText = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  leftText: string,
  rightText?: string,
): void => {
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  doc.text(leftText, 10, pageHeight - 10);
  if (rightText) {
    doc.text(rightText, pageWidth - 10, pageHeight - 10, { align: 'right' });
  }
};

/** Shared head styles for festival/artist autotables. */
export const FESTIVAL_TABLE_HEAD_STYLES = {
  fillColor: CORPORATE_RED,
  textColor: [255, 255, 255] as PdfRgb,
};

/** Shared body styles for festival/artist autotables. */
export const FESTIVAL_TABLE_BODY_STYLES = {
  fontSize: 9,
  cellPadding: 3,
};
