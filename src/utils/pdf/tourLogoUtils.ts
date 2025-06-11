
import { supabase } from '@/lib/supabase';

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
