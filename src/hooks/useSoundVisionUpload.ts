import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateFile, generateStoragePath } from '@/utils/soundvisionFileValidation';
import { VenueMetadata, useUpsertVenue } from './useVenues';

export interface UploadData {
  file: File;
  venueData: VenueMetadata;
  notes?: string;
  initialReview?: {
    rating: number;
    review?: string;
  };
}

export const useSoundVisionUpload = () => {
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const upsertVenue = useUpsertVenue();

  const upload = useMutation({
    mutationFn: async ({ file, venueData, notes, initialReview }: UploadData) => {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setProgress(10);

      // Upsert venue first
      const venueId = await upsertVenue.mutateAsync(venueData);
      setProgress(30);

      // Generate storage path
      const storagePath = generateStoragePath(venueId, file.name);
      setProgress(40);

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('soundvision-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setProgress(70);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Create database record
      const { data: fileRecord, error: dbError } = await supabase
        .from('soundvision_files')
        .insert({
          venue_id: venueId,
          file_name: file.name,
          file_path: storagePath,
          file_type: file.name.split('.').pop()?.toLowerCase() || '',
          file_size: file.size,
          uploaded_by: user.id,
          notes: notes || null,
        })
        .select('id')
        .single();

      if (dbError) throw dbError;

      if (!fileRecord) {
        throw new Error('No se pudo registrar el archivo en la base de datos');
      }

      if (initialReview && initialReview.rating) {
        const { error: reviewError } = await supabase.from('soundvision_file_reviews').insert({
          file_id: fileRecord.id,
          reviewer_id: user.id,
          rating: initialReview.rating,
          review: initialReview.review ?? null,
          is_initial: true,
        });

        if (reviewError) throw reviewError;

        queryClient.invalidateQueries({ queryKey: ['soundvision-file-reviews', fileRecord.id] });
      }

      // Invoke push notification for file upload
      let notificationResult: { success: boolean; error?: string } = { success: true };
      try {
        const { error: pushError } = await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'soundvision.file.uploaded',
            file_id: fileRecord.id,
            venue_id: venueId,
            venue_name: venueData.name,
            url: '/soundvision-files',
          },
        });

        if (pushError) {
          console.error('Push notification error:', pushError);
          notificationResult = { 
            success: false, 
            error: pushError.message || 'Error al enviar notificación' 
          };
        }
      } catch (pushErr) {
        console.error('Failed to send push notification:', pushErr);
        notificationResult = { 
          success: false, 
          error: pushErr instanceof Error ? pushErr.message : 'Error desconocido al notificar'
        };
      }

      setProgress(100);

      return { fileRecord, notificationResult };
    },
    onSuccess: ({ notificationResult }) => {
      queryClient.invalidateQueries({ queryKey: ['soundvision-files'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      
      if (notificationResult.success) {
        toast.success('Archivo subido correctamente');
      } else {
        toast.success('Archivo subido correctamente', {
          description: 'Sin embargo, no se pudo notificar a todos los usuarios.',
        });
        console.warn('Notification issue:', notificationResult.error);
      }
      
      setProgress(0);
    },
    onError: (error) => {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'No se pudo subir el archivo');
      setProgress(0);
    },
  });

  return {
    upload: upload.mutate,
    uploadAsync: upload.mutateAsync,
    isUploading: upload.isPending,
    progress,
  };
};
