import {
  FALLBACK_BRAND_LOGO_PATH,
  SECTOR_PRO_LOGO_PATH,
  loadImageWithTimeout,
} from '@/utils/pdf/shared/pdfExportShared';

/**
 * The Sector-Pro mark used in every document header.
 *
 * The mark is a drawn wordmark, not type — setting "SECTOR-PRO" in Helvetica
 * is visibly not the logo the rest of the platform uses. It is loaded once and
 * held here so the page chrome, which draws synchronously on every page, can
 * reach it without threading an image through nine document generators.
 *
 * Where it cannot be loaded at all — server-side rendering, tests — the chrome
 * falls back to the typographic wordmark rather than leaving a gap.
 */

/**
 * Widest the mark is ever placed is the cover at ~32 mm, which needs about
 * 380 px at 300 dpi. jsPDF rasterises an image element through a canvas at its
 * natural size, so shipping the 800 px source would embed four times the pixels
 * anyone can print.
 */
const MARK_MAX_WIDTH = 440;

let cachedMark: HTMLImageElement | null | undefined;
let pendingMark: Promise<HTMLImageElement | null> | null = null;
let cachedInkDataUrl: string | null = null;

const loadFromSource = (source: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });

/** Redraws the mark at print size, so every embed carries only the pixels it needs. */
const downscale = async (mark: HTMLImageElement): Promise<HTMLImageElement | null> => {
  const width = mark.naturalWidth || mark.width;
  const height = mark.naturalHeight || mark.height;
  if (!width || !height || width <= MARK_MAX_WIDTH || typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = MARK_MAX_WIDTH;
  canvas.height = Math.max(1, Math.round((height / width) * MARK_MAX_WIDTH));
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(mark, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/png');
  const scaled = await loadFromSource(dataUrl);
  if (scaled) cachedInkDataUrl = dataUrl;
  return scaled;
};

/** Loads the mark once. Await this before generating a document. */
export const loadFestivalIssuerMark = async (): Promise<HTMLImageElement | null> => {
  if (cachedMark !== undefined) return cachedMark;

  pendingMark ??= (async () => {
    const mark =
      (await loadImageWithTimeout(SECTOR_PRO_LOGO_PATH, 'Sector-Pro mark')) ||
      (await loadImageWithTimeout(FALLBACK_BRAND_LOGO_PATH, 'Sector-Pro mark (alternativo)'));
    if (!mark || !(mark.width > 0) || !(mark.height > 0)) return null;
    return (await downscale(mark)) ?? mark;
  })();

  cachedMark = await pendingMark;
  return cachedMark;
};

/** The loaded mark, or null when it is unavailable. Never triggers a load. */
export const getFestivalIssuerMark = (): HTMLImageElement | null => cachedMark ?? null;

const dataUrlCache = new Map<'ink' | 'paper', Promise<string | null>>();

/**
 * The mark as a PNG data URL for the pdf-lib pages (cover, contents, dividers).
 *
 * `paper` recolours the artwork white for the black grounds — the source mark
 * is solid black on transparency, so a straight placement would disappear.
 */
export const getFestivalIssuerMarkDataUrl = async (
  tone: 'ink' | 'paper' = 'ink',
): Promise<string | null> => {
  const cached = dataUrlCache.get(tone);
  if (cached) return cached;

  const pending = (async (): Promise<string | null> => {
    try {
      const mark = await loadFestivalIssuerMark();
      if (!mark || typeof document === 'undefined') return null;
      // The ink variant is already produced when the mark is downscaled.
      if (tone === 'ink' && cachedInkDataUrl) return cachedInkDataUrl;

      const canvas = document.createElement('canvas');
      canvas.width = mark.naturalWidth || mark.width;
      canvas.height = mark.naturalHeight || mark.height;
      const context = canvas.getContext('2d');
      if (!context) return null;

      context.drawImage(mark, 0, 0, canvas.width, canvas.height);
      if (tone === 'paper') {
        // Keep the wordmark's shape, replace its colour.
        context.globalCompositeOperation = 'source-in';
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.warn('No se pudo preparar la marca de Sector-Pro:', error);
      return null;
    }
  })();

  dataUrlCache.set(tone, pending);
  const result = await pending;
  if (!result) dataUrlCache.delete(tone);
  return result;
};

/** Clears the cached mark. Exposed for tests. */
export const clearFestivalIssuerMarkCache = (): void => {
  cachedMark = undefined;
  pendingMark = null;
  cachedInkDataUrl = null;
  dataUrlCache.clear();
};
