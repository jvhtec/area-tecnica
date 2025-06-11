
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
