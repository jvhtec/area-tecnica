import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  venue?: {
    name: string;
    city: string;
    country: string;
    state_region: string | null;
  };
  uploader?: {
    first_name: string;
    last_name: string;
  };
}

export interface SoundVisionFileFilters {
  searchTerm?: string;
  city?: string;
  country?: string;
  stateRegion?: string;
}

export const useSoundVisionFiles = (filters?: SoundVisionFileFilters) => {
  return useQuery({
    queryKey: ['soundvision-files', filters],
    queryFn: async () => {
      // First get the files with venue data
      let query = supabase
        .from('soundvision_files')
        .select(`
          *,
          venue:venues(name, city, country, state_region)
        `)
        .order('uploaded_at', { ascending: false });

      const { data: filesData, error } = await query;
      if (error) throw error;

      // Get uploader info separately since uploaded_by references auth.users
      const uploaderIds = [...new Set(filesData.map(f => f.uploaded_by))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', uploaderIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );

      // Combine data
      const filesWithUploaders = filesData.map(file => ({
        ...file,
        uploader: profilesMap.get(file.uploaded_by) || { first_name: '', last_name: '' },
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
      toast.success('File deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    },
  });
};

export const useDownloadSoundVisionFile = () => {
  return useMutation({
    mutationFn: async (file: SoundVisionFile) => {
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
    },
    onError: (error) => {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    },
  });
};
