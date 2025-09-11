
import { supabase } from '@/lib/supabase';
import { logoUrlCache } from '@/lib/logo-url-cache';

const inflight = new Map<string, Promise<string | undefined>>();
const withInflight = (bucket: string, path: string, fn: () => Promise<string | undefined>) => {
  const key = `${bucket}:${path}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
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
