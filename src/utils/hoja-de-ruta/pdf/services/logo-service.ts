import { supabase } from '@/lib/supabase';

export class LogoService {
  static async loadJobLogo(jobId: string): Promise<string | null> {
    try {
      // Try to load festival logo first
      const { data: festivalData, error: festivalError } = await supabase
        .from('festival_logos')
        .select('file_path, job_id')
        .eq('job_id', jobId)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      if (festivalData && festivalData.length > 0 && festivalData[0].file_path) {
        try {
          // Get signed URL for private bucket
          const { data: signedUrlData } = await supabase.storage
            .from('festival-logos')
            .createSignedUrl(festivalData[0].file_path, 60);
          
          if (signedUrlData?.signedUrl) {
            const response = await fetch(signedUrlData.signedUrl);
            if (response.ok) {
              const blob = await response.blob();
              return await this.blobToDataURL(blob);
            }
          }
        } catch (error) {
          console.warn('Error loading festival logo, trying tour logo:', error);
        }
      }

      // If no festival logo, try tour logo
      const { data: jobData } = await supabase
        .from('jobs')
        .select('tour_id')
        .eq('id', jobId)
        .maybeSingle();

      if (jobData?.tour_id) {
        const { data: tourData, error: tourError } = await supabase
          .from('tour_logos')
          .select('file_path')
          .eq('tour_id', jobData.tour_id)
          .order('uploaded_at', { ascending: false })
          .limit(1);

        if (tourData && tourData.length > 0 && tourData[0].file_path) {
          try {
            // Get signed URL for private bucket
            const { data: signedUrlData } = await supabase.storage
              .from('tour-logos')
              .createSignedUrl(tourData[0].file_path, 60);
            
            if (signedUrlData?.signedUrl) {
              const response = await fetch(signedUrlData.signedUrl);
              if (response.ok) {
                const blob = await response.blob();
                return await this.blobToDataURL(blob);
              }
            }
          } catch (error) {
            console.error('Error loading tour logo:', error);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error in loadJobLogo:', error);
      return null;
    }
  }

  private static blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}