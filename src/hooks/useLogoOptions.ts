
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface LogoOption {
  value: string;
  label: string;
  url: string;
  type: "job" | "tour";
}

// Define interfaces for the Supabase query results
interface FestivalLogoResult {
  id: string;
  file_path: string;
  job_id: string | null;
  jobs: {
    title: string;
  } | null;
}

interface TourLogoResult {
  id: string;
  file_path: string;
  tour_id: string | null;
  tours: {
    name: string;
  } | null;
}

export const useLogoOptions = (jobId?: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [logoOptions, setLogoOptions] = useState<LogoOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogoOptions = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch festival logos with job titles
        const { data: festivalLogos, error: festivalLogoError } = await supabase
          .from('festival_logos')
          .select(`
            id,
            file_path,
            job_id,
            jobs:jobs(title)
          `)
          .order('uploaded_at', { ascending: false });
          
        if (festivalLogoError) throw festivalLogoError;

        // Fetch tour logos with tour names
        const { data: tourLogos, error: tourLogoError } = await supabase
          .from('tour_logos')
          .select(`
            id, 
            file_path,
            tour_id,
            tours:tours(name)
          `)
          .order('uploaded_at', { ascending: false });
          
        if (tourLogoError) throw tourLogoError;

        // Format festival logos for dropdown
        const festivalOptions: LogoOption[] = (festivalLogos || [])
          .filter(logo => logo.jobs !== null)
          .map((logo: any) => {
            // Handle different possible shapes of the jobs object
            let jobTitle = 'Unknown Job';
            
            if (logo.jobs) {
              if (Array.isArray(logo.jobs)) {
                // If it's an array with contents, get the first item's title
                jobTitle = logo.jobs.length > 0 && logo.jobs[0] && typeof logo.jobs[0].title === 'string' 
                  ? logo.jobs[0].title 
                  : 'Unknown Job';
              } else if (typeof logo.jobs === 'object') {
                // If it's an object, get the title directly
                jobTitle = logo.jobs.title || 'Unknown Job';
              }
            }
              
            return {
              value: `job-${logo.id}`,
              label: `Job: ${jobTitle}`,
              url: supabase.storage.from('festival-logos').getPublicUrl(logo.file_path).data.publicUrl,
              type: "job" as const
            };
          });

        // Format tour logos for dropdown
        const tourOptions: LogoOption[] = (tourLogos || [])
          .filter(logo => logo.tours !== null)
          .map((logo: any) => {
            // Handle different possible shapes of the tours object
            let tourName = 'Unknown Tour';
            
            if (logo.tours) {
              if (Array.isArray(logo.tours)) {
                // If it's an array with contents, get the first item's name
                tourName = logo.tours.length > 0 && logo.tours[0] && typeof logo.tours[0].name === 'string' 
                  ? logo.tours[0].name 
                  : 'Unknown Tour';
              } else if (typeof logo.tours === 'object') {
                // If it's an object, get the name directly
                tourName = logo.tours.name || 'Unknown Tour';
              }
            }
              
            return {
              value: `tour-${logo.id}`,
              label: `Tour: ${tourName}`,
              url: supabase.storage.from('tour-logos').getPublicUrl(logo.file_path).data.publicUrl,
              type: "tour" as const
            };
          });
        
        // Combine and set options
        setLogoOptions([...festivalOptions, ...tourOptions]);
      } catch (error) {
        console.error("Error fetching logo options:", error);
        setError("Failed to load logo options");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogoOptions();
  }, [jobId]);

  return { logoOptions, isLoading, error };
};
