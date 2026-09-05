import type jsPDF from 'jspdf';
import type { PdfRgb } from '@/utils/pdf/exportHelpers';
import { fetchJobLogo, fetchTourLogo } from '@/utils/pdf/logoUtils';

export type { PdfRgb };
export type PdfImageFormat = 'PNG' | 'JPEG';

// ---------------------------------------------------------------------------
// Logo asset paths
// ---------------------------------------------------------------------------

export const SECTOR_PRO_LOGO_PATH = '/sector pro logo.png';
export const FALLBACK_BRAND_LOGO_PATH = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*]/g;

export const sanitizeFilenamePart = (value: string): string => {
  return value
    .replace(INVALID_FILENAME_CHARS_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
};

export const buildPdfFilename = (
  parts: Array<string | null | undefined>,
  fallback = 'Documento',
): string => {
  const safeParts = parts
    .map((part) => sanitizeFilenamePart(part ?? ''))
    .filter(Boolean);
  const baseName = safeParts.join(' - ') || fallback;
  return `${baseName}.pdf`;
};

// ---------------------------------------------------------------------------
// Image loading (HTMLImageElement onload promises)
// ---------------------------------------------------------------------------

/**
 * Quiet image loader: resolves to null when the source is missing, the Image
 * API is unavailable, or loading fails (logging a single warning).
 */
const loadImageSilently = (
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
  // Every document generator now loads the issuer mark through this helper, so
  // it has to survive a context with no DOM — a test, or server-side rendering
  // — by reporting "no image" rather than throwing on `new Image()`.
  if (!src || typeof Image === 'undefined') return null;

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
 * Resolves the client mark for a document's title block — the tour logo where
 * there is one, otherwise the job or festival logo — and loads it as an image.
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
// Font helpers
// ---------------------------------------------------------------------------

/**
 * Change only the font *style*, keeping whatever family is currently active.
 *
 * jsPDF accepts `setFont(undefined, style)` for this at runtime, but its type
 * declaration requires a font name — so resolve the current family explicitly.
 */
export const setFontStyle = (doc: jsPDF, style: 'normal' | 'bold' | 'italic' | 'bolditalic'): void => {
  doc.setFont(doc.getFont().fontName, style);
};
