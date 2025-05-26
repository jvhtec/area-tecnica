
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
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
}

export const useTourDocuments = (tourId: string) => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['tour-documents', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_documents')
        .select('*')
        .eq('tour_id', tourId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as TourDocument[];
    },
    enabled: !!tourId
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ file, fileName }: { file: File; fileName?: string }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileId = crypto.randomUUID();
      const filePath = `tours/${tourId}/${fileId}.${fileExt}`;
      const finalFileName = fileName || file.name;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('tour-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save document record
      const { data, error: dbError } = await supabase
        .from('tour_documents')
        .insert({
          tour_id: tourId,
          file_name: finalFileName,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;
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

  const deleteDocument = useMutation({
    mutationFn: async (document: TourDocument) => {
      // Delete from storage
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

      if (dbError) throw dbError;
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

  const getDocumentUrl = async (document: TourDocument) => {
    try {
      // First try to get a signed URL
      const { data, error } = await supabase.storage
        .from('tour-documents')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (error) {
        console.error('Signed URL error:', error);
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('tour-documents')
          .getPublicUrl(document.file_path);
        
        return publicUrlData.publicUrl;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('URL generation error:', error);
      throw error;
    }
  };

  const canDelete = (document: TourDocument) => {
    if (!user) return false;
    
    // User can delete their own documents
    if (document.uploaded_by === user.id) return true;
    
    // Admins and management can delete any document
    return ['admin', 'management'].includes(userRole || '');
  };

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
    canDelete
  };
};
