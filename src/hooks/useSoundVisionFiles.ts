import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PostgrestError } from '@supabase/supabase-js';

export interface SoundVisionFile {
  id: string;
  venue_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
  metadata: any;
  average_rating: number | null;
  ratings_count: number;
  rating_total: number;
  last_reviewed_at: string | null;
  hasReviewed: boolean;
  hasDownloaded: boolean;
  lastDownloadedAt: string | null;
  current_user_review: SoundVisionReviewSummary | null;
  venue?: {
    id: string;
    name: string;
    city: string;
    country: string;
    state_region: string | null;
    coordinates: { lat: number; lng: number } | null;
  };
  uploader?: {
    first_name: string;
    last_name: string;
  };
}

export interface SoundVisionReviewSummary {
  id: string;
  rating: number;
  review: string | null;
  is_initial: boolean;
  updated_at: string;
}

export interface SoundVisionFileFilters {
  searchTerm?: string;
  city?: string;
  country?: string;
  stateRegion?: string;
  fileType?: string;
}

export const useSoundVisionFiles = (filters?: SoundVisionFileFilters) => {
  return useQuery({
    queryKey: ['soundvision-files', filters],
    queryFn: async () => {
      // First get the files with venue data
      const query = supabase
        .from('soundvision_files')
        .select(`
          *,
          venue:venues(id, name, city, country, state_region, coordinates)
        `)
        .order('uploaded_at', { ascending: false });

      const { data: filesData, error } = await query;
      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentUserId = user?.id ?? null;

      // Get uploader info separately since uploaded_by references auth.users
      const uploaderIds = [...new Set(filesData.map(f => f.uploaded_by))];
      let profilesData: { id: string; first_name: string; last_name: string }[] = [];

      if (uploaderIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', uploaderIds);

        profilesData = data || [];
      }

      const profilesMap = new Map(
        profilesData.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }])
      );

      let userReviewsMap = new Map<string, SoundVisionReviewSummary>();
      let userDownloadsMap = new Map<string, string>();

      if (currentUserId && filesData.length > 0) {
        const { data: reviewData, error: reviewError } = await supabase
          .from('soundvision_file_reviews')
          .select('id, file_id, rating, review, is_initial, updated_at')
          .eq('reviewer_id', currentUserId)
          .in('file_id', filesData.map((file) => file.id));

        if (reviewError) throw reviewError;

        userReviewsMap = new Map(
          (reviewData || []).map(review => [
            review.file_id,
            {
              id: review.id,
              rating: review.rating,
              review: review.review,
              is_initial: review.is_initial,
              updated_at: review.updated_at,
            } as SoundVisionReviewSummary,
          ])
        );

        const { data: downloadData, error: downloadError } = await (supabase as any)
          .from('soundvision_file_downloads')
          .select('file_id, downloaded_at')
          .eq('profile_id', currentUserId)
          .in('file_id', filesData.map((file) => file.id));

        // Don't throw if table doesn't exist (42P01 is "undefined_table")
        if (downloadError && downloadError.code !== '42P01') {
          throw downloadError;
        }

        userDownloadsMap = new Map(
          (downloadData || []).map(download => [download.file_id, download.downloaded_at])
        );
      }

      // Combine data
      const filesWithUploaders = filesData.map(file => ({
        ...file,
        uploader: profilesMap.get(file.uploaded_by) || { first_name: '', last_name: '' },
        hasReviewed: userReviewsMap.has(file.id),
        hasDownloaded: userDownloadsMap.has(file.id),
        lastDownloadedAt: userDownloadsMap.get(file.id) ?? null,
        current_user_review: userReviewsMap.get(file.id) || null,
      })) as SoundVisionFile[];

      // Apply client-side filters
      let filteredData = filesWithUploaders;

      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          file =>
            file.file_name.toLowerCase().includes(searchLower) ||
            file.venue?.name.toLowerCase().includes(searchLower)
        );
      }

      if (filters?.city) {
        filteredData = filteredData.filter((file) => file.venue?.city === filters.city);
      }

      if (filters?.country) {
        filteredData = filteredData.filter((file) => file.venue?.country === filters.country);
      }

      if (filters?.stateRegion) {
        filteredData = filteredData.filter(
          (file) => file.venue?.state_region === filters.stateRegion
        );
      }

      if (filters?.fileType) {
        filteredData = filteredData.filter(
          (file) => file.file_type === filters.fileType.replace('.', '')
        );
      }

      return filteredData;
    },
  });
};

export const useDeleteSoundVisionFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      // Get file info first
      const { data: fileData, error: fetchError } = await supabase
        .from('soundvision_files')
        .select('file_path')
        .eq('id', fileId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('soundvision-files')
        .remove([fileData.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('soundvision_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soundvision-files'] });
      toast.success('Archivo eliminado correctamente');
    },
    onError: (error) => {
      console.error('Error deleting file:', error);
      toast.error('No se pudo eliminar el archivo');
    },
  });
};

export const useDownloadSoundVisionFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: SoundVisionFile) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Debes iniciar sesión para descargar este archivo.');
      }

      const { data, error } = await supabase.storage
        .from('soundvision-files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      let downloadRecordError: PostgrestError | null = null;

      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

      const { error: recordError } = await (supabase as any)
        .from('soundvision_file_downloads')
        .upsert(
          {
            file_id: file.id,
            profile_id: user.id,
            downloaded_at: new Date().toISOString(),
            user_agent: userAgent,
          },
          { onConflict: 'file_id,profile_id' }
        );

      if (recordError) {
        console.error('Error recording SoundVision download:', recordError);
        downloadRecordError = recordError;
      }

      // Invoke push notification for file download
      let pushNotificationResult: { success: boolean; error?: string } = { success: true };
      try {
        // Get venue_name from populated venue or fallback to metadata
        const venueName = file.venue?.name || file.metadata?.venue_name || null;

        const { error: pushError } = await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'soundvision.file.downloaded',
            file_id: file.id,
            venue_id: file.venue_id,
            venue_name: venueName,
            url: '/soundvision-files',
          },
        });

        if (pushError) {
          console.error('Push notification error:', pushError);
          pushNotificationResult = {
            success: false,
            error: pushError.message || 'Error al enviar notificación',
          };
        }
      } catch (pushErr) {
        console.error('Failed to send push notification:', pushErr);
        pushNotificationResult = {
          success: false,
          error: pushErr instanceof Error ? pushErr.message : 'Error desconocido al notificar',
        };
      }

      return { downloadRecordError, pushNotificationResult };
    },
    onSuccess: ({ downloadRecordError, pushNotificationResult }) => {
      queryClient.invalidateQueries({ queryKey: ['soundvision-files'] });

      const hasRecordError = !!downloadRecordError;
      const hasPushError = !pushNotificationResult.success;

      if (!hasRecordError && !hasPushError) {
        // Full success
        toast.success('Descarga iniciada correctamente.');
      } else if (hasRecordError && !hasPushError) {
        // Download worked but couldn't record it
        toast.warning('La descarga se realizó, pero no se pudo registrar el evento.');
      } else if (!hasRecordError && hasPushError) {
        // Download and record worked but notification failed
        toast.success('Descarga iniciada correctamente.', {
          description: 'Sin embargo, no se pudo notificar a todos los usuarios.',
        });
        console.warn('Notification issue:', pushNotificationResult.error);
      } else {
        // Both record and push failed
        toast.warning('La descarga se realizó, pero no se pudo registrar el evento ni notificar.');
        console.warn('Notification issue:', pushNotificationResult.error);
      }
    },
    onError: (error) => {
      console.error('Error downloading file:', error);
      toast.error('No se pudo descargar el archivo');
    },
  });
};
