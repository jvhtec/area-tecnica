
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface LogoOption {
  id: string;
  name: string;
  url: string;
  type: 'festival' | 'tour';
}

export function useLogoList() {
  const [logos, setLogos] = useState<LogoOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogos() {
      try {
        setIsLoading(true);
        
        // Fetch festival logos
        const { data: festivalLogos, error: festivalError } = await supabase
          .from('festival_logos')
          .select(`
            id,
            file_path,
            jobs:job_id(title)
          `)
          .order('uploaded_at', { ascending: false });

        if (festivalError) throw festivalError;

        // Fetch tour logos
        const { data: tourLogos, error: tourError } = await supabase
          .from('tour_logos')
          .select(`
            id, 
            file_path, 
            tours:tour_id(name)
          `)
          .order('uploaded_at', { ascending: false });

        if (tourError) throw tourError;

        // Format festival logos
        const formattedFestivalLogos: LogoOption[] = (festivalLogos || [])
          .filter(logo => logo.jobs?.title)
          .map(logo => {
            const publicUrl = supabase.storage
              .from('festival-logos')
              .getPublicUrl(logo.file_path).data.publicUrl;
              
            return {
              id: `festival-${logo.id}`,
              name: `Festival: ${logo.jobs?.title || 'Unknown'}`,
              url: publicUrl,
              type: 'festival'
            };
          });

        // Format tour logos
        const formattedTourLogos: LogoOption[] = (tourLogos || [])
          .filter(logo => logo.tours?.name)
          .map(logo => {
            const publicUrl = supabase.storage
              .from('tour-logos')
              .getPublicUrl(logo.file_path).data.publicUrl;
              
            return {
              id: `tour-${logo.id}`,
              name: `Tour: ${logo.tours?.name || 'Unknown'}`,
              url: publicUrl,
              type: 'tour'
            };
          });

        // Combine and set logos
        setLogos([...formattedFestivalLogos, ...formattedTourLogos]);
      } catch (err) {
        console.error("Error fetching logos:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch logos");
      } finally {
        setIsLoading(false);
      }
    }

    fetchLogos();
  }, []);

  return { logos, isLoading, error };
}
