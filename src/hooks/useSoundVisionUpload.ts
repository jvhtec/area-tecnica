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
}

export const useSoundVisionUpload = () => {
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const upsertVenue = useUpsertVenue();

  const upload = useMutation({
    mutationFn: async ({ file, venueData, notes }: UploadData) => {
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
      const { error: dbError } = await supabase.from('soundvision_files').insert({
        venue_id: venueId,
        file_name: file.name,
        file_path: storagePath,
        file_type: file.name.split('.').pop()?.toLowerCase() || '',
        file_size: file.size,
        uploaded_by: user.id,
        notes: notes || null,
      });

      if (dbError) throw dbError;
      setProgress(100);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soundvision-files'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Archivo subido correctamente');
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
