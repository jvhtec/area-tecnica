
import { supabase } from '@/lib/supabase';
import { logoUrlCache } from '@/lib/logo-url-cache';

const COMPANY_LOGO_BUCKET = 'company-assets';
const COMPANY_LOGO_PATH = 'sector-pro-logo.png';
const COMPANY_LOGO_FALLBACK_PATHS = [
  '/sector pro logo.png',
  '/sector-pro-logo.png',
  '/sector%20pro%20logo.png',
  '/media/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png',
];

const inflight = new Map<string, Promise<string | undefined>>();
const withInflight = (bucket: string, path: string, fn: () => Promise<string | undefined>) => {
  const key = `${bucket}:${path}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

const parseSupabaseStoragePath = (value: string, bucket: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decodeSafe = (input: string) => {
    try {
      return decodeURIComponent(input);
    } catch {
      return input;
    }
  };

  const normalize = (input: string) => {
    let normalized = decodeSafe(input).trim();
    normalized = normalized.split('?')[0].split('#')[0];
    normalized = normalized.replace(/^\/+/, '');
    const bucketPrefix = `${bucket}/`;
    if (normalized.startsWith(bucketPrefix)) {
      normalized = normalized.slice(bucketPrefix.length);
    }
    return normalized;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const segments = decodeSafe(url.pathname).split('/').filter(Boolean);
      const bucketIndex = segments.indexOf(bucket);
      if (bucketIndex >= 0 && bucketIndex < segments.length - 1) {
        return normalize(segments.slice(bucketIndex + 1).join('/'));
      }
      return null;
    } catch {
      return null;
    }
  }

  return normalize(trimmed);
};

export const resolveTourLogoPath = async (tourId: string): Promise<string | null> => {
  try {
    const { data: tourLogo, error: tourLogoError } = await supabase
      .from("tour_logos")
      .select("file_path")
      .eq("tour_id", tourId)
      .maybeSingle();

    if (tourLogo?.file_path) {
      return tourLogo.file_path;
    }

    if (tourLogoError) {
      console.warn("Error fetching tour logo record, falling back to storage search:", tourLogoError);
    }
  } catch (err) {
    console.error("Unexpected error fetching tour logo record:", err);
  }

  try {
    const { data: storageFiles, error: listError } = await supabase.storage
      .from('tour-logos')
      .list('', {
        search: tourId,
        limit: 1,
      });

    if (listError) {
      console.error("Error searching tour logo in storage:", listError);
      return null;
    }

    const match = (storageFiles || []).find(file =>
      file.name?.toLowerCase().includes(tourId.toLowerCase())
    ) || storageFiles?.[0];

    return match?.name ?? null;
  } catch (storageErr) {
    console.error("Error listing tour logo files:", storageErr);
    return null;
  }
};

/**
 * Display URL of a festival logo stored at `filePath` (as saved in `festival_logos`): an external
 * URL as is, otherwise a one-hour signed URL for the private bucket, else its public URL.
 * Results are cached, and concurrent requests for the same file share one call.
 */
export const resolveFestivalLogoUrl = async (filePath: string): Promise<string | undefined> => {
  const rawPath = filePath.trim();
  if (!rawPath) return undefined;

  const normalizedPath = parseSupabaseStoragePath(rawPath, 'festival-logos');
  if (!normalizedPath) {
    // Not a path inside our bucket: an external URL stored directly in the DB is used as is.
    return /^https?:\/\//i.test(rawPath) ? rawPath : undefined;
  }

  const cached = logoUrlCache.get('festival-logos', normalizedPath);
  if (cached) return cached;

  try {
    return await withInflight('festival-logos', normalizedPath, async () => {
      const { data: signedUrlData } = await supabase.storage
        .from('festival-logos')
        .createSignedUrl(normalizedPath, 60 * 60); // 1 hour expiry

      if (signedUrlData?.signedUrl) {
        // Cached for 45 minutes, shorter than the URL's hour of validity.
        logoUrlCache.set('festival-logos', normalizedPath, signedUrlData.signedUrl, 45 * 60 * 1000);
        return signedUrlData.signedUrl;
      }

      const { data: publicUrlData } = supabase.storage.from('festival-logos').getPublicUrl(normalizedPath);
      if (publicUrlData?.publicUrl) {
        logoUrlCache.set('festival-logos', normalizedPath, publicUrlData.publicUrl, 15 * 60 * 1000);
        return publicUrlData.publicUrl;
      }
      return undefined;
    });
  } catch (storageErr) {
    console.error("Error getting logo URLs:", storageErr);
    return undefined;
  }
};

export const fetchLogoUrl = async (jobId: string): Promise<string | undefined> => {
  try {
    const { data: logoData, error: logoError } = await supabase
      .from("festival_logos")
      .select("file_path, file_name, uploaded_at")
      .eq("job_id", jobId)
      .maybeSingle();

    if (logoError) {
      console.error("Error fetching festival logo:", logoError);
      return undefined;
    }

    return logoData?.file_path ? await resolveFestivalLogoUrl(logoData.file_path) : undefined;
  } catch (err) {
    console.error("Error in logo fetch:", err);
    return undefined;
  }
};

/** Display URL of a tour logo stored at `logoPath` (see {@link resolveFestivalLogoUrl}). */
export const resolveTourLogoUrl = async (logoPath: string): Promise<string | undefined> => {
  let normalizedPath = logoPath.trim();
  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.slice(1);
  }
  if (normalizedPath.startsWith('tour-logos/')) {
    normalizedPath = normalizedPath.slice('tour-logos/'.length);
  }
  if (!normalizedPath) return undefined;

  const cached = logoUrlCache.get('tour-logos', normalizedPath);
  if (cached) return cached;

  if (normalizedPath.startsWith('http')) {
    logoUrlCache.set('tour-logos', normalizedPath, normalizedPath, 45 * 60 * 1000);
    return normalizedPath;
  }

  return await withInflight('tour-logos', normalizedPath, async () => {
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('tour-logos')
      .createSignedUrl(normalizedPath, 60 * 60); // 1 hour expiry

    if (signedUrlError) {
      console.error("Error creating tour logo signed URL:", signedUrlError);
    }

    if (signedUrlData?.signedUrl) {
      logoUrlCache.set('tour-logos', normalizedPath, signedUrlData.signedUrl, 45 * 60 * 1000);
      return signedUrlData.signedUrl;
    }

    const { data: publicUrlData } = supabase.storage.from('tour-logos').getPublicUrl(normalizedPath);
    if (publicUrlData?.publicUrl) {
      logoUrlCache.set('tour-logos', normalizedPath, publicUrlData.publicUrl, 15 * 60 * 1000);
      return publicUrlData.publicUrl;
    }

    return undefined;
  });
};

export const fetchTourLogo = async (tourId: string): Promise<string | undefined> => {
  try {
    const logoPath = await resolveTourLogoPath(tourId);
    return logoPath ? await resolveTourLogoUrl(logoPath) : undefined;
  } catch (err) {
    console.error("Error in tour logo fetch:", err);
    return undefined;
  }
};

export const fetchJobLogo = async (jobId: string): Promise<string | undefined> => {
  try {
    // First try to get a festival logo
    const festivalLogo = await fetchLogoUrl(jobId);
    if (festivalLogo) {
      return festivalLogo;
    }

    // If no festival logo, check if it's a tour date job and get the tour logo
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("tour_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("Error fetching job data:", jobError);
      return undefined;
    }

    if (jobData?.tour_id) {
      // Fetch the tour logo
      return await fetchTourLogo(jobData.tour_id);
    }

    return undefined;
  } catch (err) {
    console.error("Error in job logo fetch:", err);
    return undefined;
  }
};

const loadImageElement = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.warn('Failed to load company logo from', src, error);
      resolve(null);
    };
    img.src = src;
  });
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
};

let companyLogoPromise: Promise<HTMLImageElement | null> | null = null;

const fetchCompanyLogoFromStorage = async (): Promise<HTMLImageElement | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(COMPANY_LOGO_BUCKET)
      .download(COMPANY_LOGO_PATH);

    if (!error && data) {
      const dataUrl = await blobToDataUrl(data);
      const image = await loadImageElement(dataUrl);
      if (image) return image;
    }
  } catch (error) {
    console.warn('Error downloading company logo:', error);
  }

  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(COMPANY_LOGO_BUCKET)
      .createSignedUrl(COMPANY_LOGO_PATH, 60 * 60);

    if (!signedError && signedData?.signedUrl) {
      const image = await loadImageElement(signedData.signedUrl);
      if (image) return image;
    }
  } catch (error) {
    console.warn('Error fetching signed URL for company logo:', error);
  }

  return null;
};

export const getCompanyLogo = async (): Promise<HTMLImageElement | null> => {
  if (companyLogoPromise) return companyLogoPromise;

  companyLogoPromise = (async () => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return null;
    }

    const storageLogo = await fetchCompanyLogoFromStorage();
    if (storageLogo) return storageLogo;

    for (const path of COMPANY_LOGO_FALLBACK_PATHS) {
      const image = await loadImageElement(path);
      if (image) return image;
    }

    return null;
  })();

  companyLogoPromise.catch(() => {
    companyLogoPromise = null;
  });

  return companyLogoPromise;
};
