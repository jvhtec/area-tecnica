
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * A hook that fetches a tour logo based on tour ID or tour date ID
 * It checks both direct tour relationships and tour_date relationships
 */
export function useTourLogo(jobId: string | undefined, tourId?: string, tourDateId?: string) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchLogo() {
      if (!jobId && !tourId && !tourDateId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // First attempt: try to find the logo by direct tour association
        if (tourId) {
          const { data, error } = await supabase
            .from('tour_logos')
            .select('file_path')
            .eq('tour_id', tourId)
            .maybeSingle();
            
          if (error) throw error;
          
          if (data?.file_path) {
            const { data: urlData } = supabase.storage
              .from('tour-logos')
              .getPublicUrl(data.file_path);
              
            setLogoUrl(urlData.publicUrl);
            setIsLoading(false);
            return;
          }
        }
        
        // Second attempt: try to find tour ID through tour_date
        if (tourDateId && !tourId) {
          const { data: tourDateData, error: tourDateError } = await supabase
            .from('tour_dates')
            .select('tour_id')
            .eq('id', tourDateId)
            .maybeSingle();
            
          if (tourDateError) throw tourDateError;
          
          if (tourDateData?.tour_id) {
            const { data, error } = await supabase
              .from('tour_logos')
              .select('file_path')
              .eq('tour_id', tourDateData.tour_id)
              .maybeSingle();
              
            if (error) throw error;
            
            if (data?.file_path) {
              const { data: urlData } = supabase.storage
                .from('tour-logos')
                .getPublicUrl(data.file_path);
                
              setLogoUrl(urlData.publicUrl);
              setIsLoading(false);
              return;
            }
          }
        }
        
        // Third attempt: try to find tour ID through job
        if (jobId && !tourId) {
          const { data: jobData, error: jobError } = await supabase
            .from('jobs')
            .select('tour_id, tour_date_id')
            .eq('id', jobId)
            .maybeSingle();
            
          if (jobError) throw jobError;
          
          if (jobData?.tour_id) {
            const { data, error } = await supabase
              .from('tour_logos')
              .select('file_path')
              .eq('tour_id', jobData.tour_id)
              .maybeSingle();
              
            if (error) throw error;
            
            if (data?.file_path) {
              const { data: urlData } = supabase.storage
                .from('tour-logos')
                .getPublicUrl(data.file_path);
                
              setLogoUrl(urlData.publicUrl);
              setIsLoading(false);
              return;
            }
          } else if (jobData?.tour_date_id) {
            // If we have a tour_date_id but no direct tour_id, find the tour through the date
            const { data: dateData, error: dateError } = await supabase
              .from('tour_dates')
              .select('tour_id')
              .eq('id', jobData.tour_date_id)
              .maybeSingle();
              
            if (dateError) throw dateError;
            
            if (dateData?.tour_id) {
              const { data, error } = await supabase
                .from('tour_logos')
                .select('file_path')
                .eq('tour_id', dateData.tour_id)
                .maybeSingle();
                
              if (error) throw error;
              
              if (data?.file_path) {
                const { data: urlData } = supabase.storage
                  .from('tour-logos')
                  .getPublicUrl(data.file_path);
                  
                setLogoUrl(urlData.publicUrl);
                setIsLoading(false);
                return;
              }
            }
          }
        }
        
        // If we get here, no logo was found
        setLogoUrl(null);
      } catch (err) {
        console.error("Error fetching tour logo:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLogoUrl(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchLogo();
  }, [jobId, tourId, tourDateId]);
  
  return { logoUrl, isLoading, error };
}
