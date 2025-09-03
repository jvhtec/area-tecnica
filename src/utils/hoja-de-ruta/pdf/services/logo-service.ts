import { supabase } from '@/lib/supabase';

export class LogoService {
  static async loadJobLogo(jobId: string): Promise<string | null> {
    try {
      // First check for job logo
      const { data: jobData } = await supabase
        .from('jobs')
        .select('logo_url')
        .eq('id', jobId)
        .single();
      
      if (jobData?.logo_url) {
        const logoResponse = await fetch(jobData.logo_url);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          return await this.blobToDataURL(logoBlob);
        }
      }

      // If no job logo, try festival logos
      const { data: festivalLogos } = await supabase
        .from('festival_logos')
        .select('file_path, job_id')
        .eq('job_id', jobId)
        .order('uploaded_at', { ascending: false })
        .limit(1);
      
      if (festivalLogos && festivalLogos.length > 0) {
        const logoUrl = supabase.storage.from('festival-logos').getPublicUrl(festivalLogos[0].file_path).data.publicUrl;
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          return await this.blobToDataURL(logoBlob);
        }
      }

      // Try tour logos by joining with jobs table
      const { data: jobWithTour } = await supabase
        .from('jobs')
        .select('tour_id')
        .eq('id', jobId)
        .single();
      
      if (jobWithTour?.tour_id) {
        const { data: tourLogos } = await supabase
          .from('tour_logos')
          .select('file_path')
          .eq('tour_id', jobWithTour.tour_id)
          .order('uploaded_at', { ascending: false })
          .limit(1);
        
        if (tourLogos && tourLogos.length > 0) {
          const logoUrl = supabase.storage.from('tour-logos').getPublicUrl(tourLogos[0].file_path).data.publicUrl;
          const logoResponse = await fetch(logoUrl);
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob();
            return await this.blobToDataURL(logoBlob);
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error loading logos:", error);
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