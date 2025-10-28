
import { supabase } from '@/lib/supabase';
import { logoUrlCache } from '@/lib/logo-url-cache';

const COMPANY_LOGO_BUCKET = 'company-assets';
const COMPANY_LOGO_PATH = 'sector-pro-logo.png';
const COMPANY_LOGO_FALLBACK_PATHS = [
  '/sector pro logo.png',
  '/sector-pro-logo.png',
  '/sector%20pro%20logo.png',
  '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png',
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

export const fetchLogoUrl = async (jobId: string): Promise<string | undefined> => {
  try {
    console.log("Fetching logo for job ID:", jobId);
    
    const { data: logoData, error: logoError } = await supabase
      .from("festival_logos")
      .select("file_path, file_name, uploaded_at")
      .eq("job_id", jobId)
      .maybeSingle();
      
    if (logoError) {
      console.error("Error fetching festival logo:", logoError);
      return undefined;
    }
    
    if (!logoData) {
      console.log("No logo found for job ID:", jobId);
      return undefined;
    }

    console.log("Found logo data:", logoData);
    
    if (logoData?.file_path) {
      try {
        // Use cache if available
        const cached = logoUrlCache.get('festival-logos', logoData.file_path);
        if (cached) return cached;

        return await withInflight('festival-logos', logoData.file_path, async () => {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('festival-logos')
          .createSignedUrl(logoData.file_path, 60 * 60); // 1 hour expiry
          
        if (signedUrlError) {
          console.error("Error creating signed URL:", signedUrlError);
          // Try fallback to public URL if signed URL fails
          const { data: publicUrlData } = supabase.storage
            .from('festival-logos')
            .getPublicUrl(logoData.file_path);
            
          if (publicUrlData?.publicUrl) {
            console.log("Generated logo public URL (fallback):", publicUrlData.publicUrl);
            // cache for 15 minutes
            logoUrlCache.set('festival-logos', logoData.file_path, publicUrlData.publicUrl, 15 * 60 * 1000);
            return publicUrlData.publicUrl;
          }
          return undefined;
        }

        if (signedUrlData?.signedUrl) {
          console.log("Generated festival logo signed URL:", signedUrlData.signedUrl);
          // cache for 45 minutes (shorter than 1h expiry)
          logoUrlCache.set('festival-logos', logoData.file_path, signedUrlData.signedUrl, 45 * 60 * 1000);
          return signedUrlData.signedUrl;
        }
        
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('festival-logos')
          .getPublicUrl(logoData.file_path);
          
        if (publicUrlData?.publicUrl) {
          console.log("Generated logo public URL:", publicUrlData.publicUrl);
          logoUrlCache.set('festival-logos', logoData.file_path, publicUrlData.publicUrl, 15 * 60 * 1000);
          return publicUrlData.publicUrl;
        }
        return undefined;
        });
      } catch (storageErr) {
        console.error("Error getting logo URLs:", storageErr);
      }
    }
    
    console.log("No valid logo URL found for job ID:", jobId);
    return undefined;
  } catch (err) {
    console.error("Error in logo fetch:", err);
    return undefined;
  }
};

export const fetchTourLogo = async (tourId: string): Promise<string | undefined> => {
  try {
    // Fetch the tour logo
    const { data: tourLogo, error: tourLogoError } = await supabase
      .from("tour_logos")
      .select("file_path")
      .eq("tour_id", tourId)
      .maybeSingle();
      
    if (tourLogoError) {
      console.error("Error fetching tour logo:", tourLogoError);
      return undefined;
    }
    
    if (tourLogo?.file_path) {
      try {
        const cached = logoUrlCache.get('tour-logos', tourLogo.file_path);
        if (cached) return cached;

        return await withInflight('tour-logos', tourLogo.file_path, async () => {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('tour-logos')
          .createSignedUrl(tourLogo.file_path, 60 * 60); // 1 hour expiry
          
        if (signedUrlError) {
          console.error("Error creating tour logo signed URL:", signedUrlError);
          // Try fallback to public URL if signed URL fails
          const { data: publicUrlData } = supabase.storage
            .from('tour-logos')
            .getPublicUrl(tourLogo.file_path);
            
          if (publicUrlData?.publicUrl) {
            console.log("Generated tour logo public URL (fallback):", publicUrlData.publicUrl);
            logoUrlCache.set('tour-logos', tourLogo.file_path, publicUrlData.publicUrl, 15 * 60 * 1000);
            return publicUrlData.publicUrl;
          }
          return undefined;
        }
          
        if (signedUrlData?.signedUrl) {
          console.log("Generated tour logo signed URL:", signedUrlData.signedUrl);
          logoUrlCache.set('tour-logos', tourLogo.file_path, signedUrlData.signedUrl, 45 * 60 * 1000);
          return signedUrlData.signedUrl;
        }
        
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('tour-logos')
          .getPublicUrl(tourLogo.file_path);
          
        if (publicUrlData?.publicUrl) {
          console.log("Generated tour logo public URL:", publicUrlData.publicUrl);
          logoUrlCache.set('tour-logos', tourLogo.file_path, publicUrlData.publicUrl, 15 * 60 * 1000);
          return publicUrlData.publicUrl;
        }
        return undefined;
        });
      } catch (storageErr) {
        console.error("Error getting tour logo public URL:", storageErr);
      }
    }
    
    return undefined;
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
      console.log("Found festival logo for job:", jobId);
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
