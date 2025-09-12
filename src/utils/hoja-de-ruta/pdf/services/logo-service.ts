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
        const path = festivalData[0].file_path;
        try {
          // Prefer authenticated download for private buckets
          const { data, error } = await supabase.storage
            .from('festival-logos')
            .download(path);
          if (!error && data) {
            return await this.blobToDataURL(data);
          }
        } catch (error) {
          console.warn('Festival logo download failed, falling back to signed URL:', error);
        }

        try {
          const { data: signedUrlData, error: signedErr } = await supabase.storage
            .from('festival-logos')
            .createSignedUrl(path, 60);
          if (!signedErr && signedUrlData?.signedUrl) {
            const response = await fetch(signedUrlData.signedUrl);
            if (response.ok) {
              const blob = await response.blob();
              return await this.blobToDataURL(blob);
            }
          }
        } catch (error) {
          console.warn('Festival logo signed URL fetch failed:', error);
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
          const path = tourData[0].file_path;
          try {
            const { data, error } = await supabase.storage
              .from('tour-logos')
              .download(path);
            if (!error && data) {
              return await this.blobToDataURL(data);
            }
          } catch (error) {
            console.warn('Tour logo download failed, falling back to signed URL:', error);
          }

          try {
            const { data: signedUrlData, error: signedErr } = await supabase.storage
              .from('tour-logos')
              .createSignedUrl(path, 60);
            if (!signedErr && signedUrlData?.signedUrl) {
              const response = await fetch(signedUrlData.signedUrl);
              if (response.ok) {
                const blob = await response.blob();
                return await this.blobToDataURL(blob);
              }
            }
          } catch (error) {
            console.error('Tour logo signed URL fetch failed:', error);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error in loadJobLogo:', error);
      return null;
    }
  }

  private static async blobToDataURL(blob: Blob): Promise<string> {
    // If already PNG or JPEG, return as data URL directly
    const type = (blob.type || '').toLowerCase();
    const isSupported = type.includes('image/png') || type.includes('image/jpeg') || type.includes('image/jpg');
    if (isSupported) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Convert other formats (e.g., WebP) to PNG using a canvas
    return new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(url);
              return reject(new Error('Canvas not supported'));
            }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            resolve(dataUrl);
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      } catch (e) {
        reject(e);
      }
    });
  }
}
