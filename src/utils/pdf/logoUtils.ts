
import { supabase } from '@/lib/supabase';

export const fetchLogoUrl = async (jobId: string): Promise<string | undefined> => {
  try {
    const { data: logoData, error: logoError } = await supabase
      .from("festival_logos")
      .select("file_path")
      .eq("job_id", jobId)
      .maybeSingle();
      
    if (logoError) {
      console.error("Error fetching festival logo:", logoError);
    }
    
    if (logoData?.file_path) {
      try {
        const { data: signedUrlData } = await supabase.storage
          .from('festival-logos')
          .createSignedUrl(logoData.file_path, 60 * 60); // 1 hour expiry
          
        if (signedUrlData?.signedUrl) {
          console.log("Generated festival logo signed URL:", signedUrlData.signedUrl);
          return signedUrlData.signedUrl;
        }
        
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('festival-logos')
          .getPublicUrl(logoData.file_path);
          
        if (publicUrlData?.publicUrl) {
          console.log("Generated logo public URL:", publicUrlData.publicUrl);
          return publicUrlData.publicUrl;
        }
      } catch (storageErr) {
        console.error("Error getting logo public URL:", storageErr);
      }
    }
    
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
        const { data: signedUrlData } = await supabase.storage
          .from('tour-logos')
          .createSignedUrl(tourLogo.file_path, 60 * 60); // 1 hour expiry
          
        if (signedUrlData?.signedUrl) {
          console.log("Generated tour logo signed URL:", signedUrlData.signedUrl);
          return signedUrlData.signedUrl;
        }
        
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('tour-logos')
          .getPublicUrl(tourLogo.file_path);
          
        if (publicUrlData?.publicUrl) {
          console.log("Generated tour logo public URL:", publicUrlData.publicUrl);
          return publicUrlData.publicUrl;
        }
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
