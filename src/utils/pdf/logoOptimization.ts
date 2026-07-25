import { blobToDataUrl } from '@/utils/pdf/exportHelpers';
import { fetchJobLogo, fetchLogoUrl } from '@/utils/pdf/logoUtils';

/**
 * Ships the festival logo at the size it is actually placed.
 *
 * The largest placement in the set is the cover mark at roughly 41 mm wide,
 * which at 300 dpi needs about 490 px of source. Festival logos are routinely
 * uploaded at 1500 px or more, and every document in the bundle embeds the
 * full-resolution bitmap — so this is where most of the bundle's weight comes
 * from, before any deduplication.
 *
 * Downscaling happens once and the result is reused by every generator.
 */

const DEFAULT_MAX_WIDTH = 560;

const cache = new Map<string, Promise<string | undefined>>();

const canDownscale = (): boolean =>
  typeof document !== 'undefined' && typeof Image !== 'undefined';

const loadImage = (source: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });

const downscale = async (
  dataUrl: string,
  maxWidth: number,
): Promise<string | undefined> => {
  const image = await loadImage(dataUrl);
  if (!image) return undefined;

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return undefined;
  // Already small enough — re-encoding would only risk making it larger.
  if (width <= maxWidth) return dataUrl;

  const scale = maxWidth / width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // PNG keeps the transparency logos rely on; a JPEG would put a black box
  // behind every mark on the cover.
  return canvas.toDataURL('image/png');
};

/**
 * Returns a logo URL suitable for embedding: the original when it is already
 * modest or cannot be processed, a downscaled data URL otherwise.
 *
 * Never throws — a logo that cannot be prepared falls back to the original URL
 * so the documents still carry the client's mark.
 */
export const prepareFestivalLogo = async (
  logoUrl?: string | null,
  maxWidth = DEFAULT_MAX_WIDTH,
): Promise<string | undefined> => {
  if (!logoUrl) return undefined;

  const cacheKey = `${maxWidth}|${logoUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const pending = (async (): Promise<string | undefined> => {
    try {
      if (!canDownscale()) return logoUrl;

      const response = await fetch(logoUrl);
      if (!response.ok) return logoUrl;

      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      return (await downscale(dataUrl, maxWidth)) ?? logoUrl;
    } catch (error) {
      console.warn('No se pudo optimizar el logotipo del festival:', error);
      return logoUrl;
    }
  })();

  cache.set(cacheKey, pending);
  const result = await pending;
  // A failed preparation should not be cached as the final answer.
  if (result === logoUrl) cache.delete(cacheKey);
  return result;
};

/** Clears the prepared-logo cache. Exposed for tests. */
export const clearPreparedLogoCache = (): void => {
  cache.clear();
};

/**
 * Resolves a job's festival logo and prepares it for embedding, in one step.
 *
 * Every festival document reaches for the same logo, so going through here
 * means the download and the downscale happen once for a whole bundle rather
 * than once per document.
 */
export const fetchPreparedFestivalLogo = async (
  jobId: string,
): Promise<string | undefined> => {
  const sourceUrl = (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));
  if (!sourceUrl) return undefined;
  return (await prepareFestivalLogo(sourceUrl)) || sourceUrl;
};
