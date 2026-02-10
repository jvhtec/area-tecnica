
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { toast } from "sonner";

export interface TourDocument {
  id: string;
  tour_id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
  visible_to_tech?: boolean;
}

export const useTourDocuments = (tourId: string) => {
  const { user, userRole } = useOptimizedAuth();
  const queryClient = useQueryClient();

  const isManager = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canManageVisibility = ['admin', 'management'].includes(userRole || '');

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['tour-documents', tourId],
    queryFn: async () => {
      console.log('Fetching tour documents for tour:', tourId);
      const { data, error } = await supabase
        .from('tour_documents')
        .select('*')
        .eq('tour_id', tourId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching tour documents:', error);
        throw error;
      }

      console.log('Fetched documents:', data);
      return data as TourDocument[];
    },
    enabled: !!tourId,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ file, fileName }: { file: File; fileName?: string }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileId = crypto.randomUUID();
      const filePath = `tours/${tourId}/${fileId}.${fileExt}`;
      const finalFileName = fileName || file.name;

      // Technician uploads should default to visible-to-tech (otherwise they can't create a hidden doc).
      const visibleToTech = !isManager;

      console.log('Uploading file:', finalFileName, 'to path:', filePath);

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('tour-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Save document record
      const { data, error: dbError } = await supabase
        .from('tour_documents')
        .insert({
          tour_id: tourId,
          file_name: finalFileName,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
          visible_to_tech: visibleToTech,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw dbError;
      }

      console.log('Document uploaded successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-documents', tourId] });
      toast.success('Document uploaded successfully');
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    }
  });

  const updateVisibility = useMutation({
    mutationFn: async ({ documentId, visibleToTech }: { documentId: string; visibleToTech: boolean }) => {
      if (!canManageVisibility) {
        throw new Error('Not allowed');
      }

      const { error } = await supabase
        .from('tour_documents')
        .update({ visible_to_tech: visibleToTech })
        .eq('id', documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-documents', tourId] });
      toast.success('Visibility updated');
    },
    onError: (error: any) => {
      console.error('Update visibility error:', error);
      toast.error('Failed to update visibility');
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: TourDocument) => {
      console.log('Deleting document:', document.file_name);
      
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('tour-documents')
        .remove([document.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('tour_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        throw dbError;
      }
      
      console.log('Document deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-documents', tourId] });
      toast.success('Document deleted successfully');
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    }
  });

  const getDocumentUrl = async (document: TourDocument): Promise<string> => {
    try {
      console.log('Generating URL for document:', document.file_name, 'at path:', document.file_path);
      
      // Always use a signed URL since the bucket is private
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('tour-documents')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error('Signed URL error:', signedUrlError);
        throw signedUrlError;
      }

      if (signedUrlData?.signedUrl) {
        console.log('Using signed URL:', signedUrlData.signedUrl);
        return signedUrlData.signedUrl;
      }

      throw new Error('Failed to generate any URL for the document');
    } catch (error) {
      console.error('URL generation error:', error);
      throw error;
    }
  };

  const canDelete = (document: TourDocument) => {
    if (!user) return false;
    
    // User can delete their own documents
    if (document.uploaded_by === user.id) return true;
    
    // Admins/management/logistics can delete any document
    return ['admin', 'management', 'logistics'].includes(userRole || '');
  };

  const canUpload =
    Boolean(user?.id) &&
    (isManager || ['technician', 'house_tech'].includes(userRole || ''));

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    updateVisibility,
    deleteDocument,
    getDocumentUrl,
    canDelete,
    canManageVisibility,
    canUpload,
  };
};
