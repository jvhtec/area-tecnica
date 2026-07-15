
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/react-query";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { toast } from "sonner";
import {
  canDeleteTourDocuments,
  canUploadDocuments,
  canUploadTourDocuments,
  isManagementRole,
} from "@/utils/permissions";
import { getDocumentUploadErrorMessage } from "@/utils/documentUploadValidation";
import { getStorageUploadErrorMessage, uploadStorageObject } from "@/utils/storageUpload";

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
  visible_to_guest?: boolean;
}

type UploadTourDocumentVariables = {
  file: File;
  fileName?: string;
  suppressInvalidation?: boolean;
  suppressToast?: boolean;
};

export const useTourDocuments = (tourId: string) => {
  const { user, userRole } = useOptimizedAuth();
  const queryClient = useQueryClient();

  const isManager = canUploadDocuments(userRole);
  const canManageVisibility = isManagementRole(userRole);

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: queryKeys.scope('tour-documents', tourId),
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
    mutationFn: async ({ file, fileName }: UploadTourDocumentVariables) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (!canUploadTourDocuments(userRole)) throw new Error("Not allowed");

      const fileExt = file.name.split('.').pop();
      const fileId = crypto.randomUUID();
      const filePath = `tours/${tourId}/${fileId}.${fileExt}`;
      const finalFileName = fileName || file.name;

      // Technician uploads should default to visible-to-tech (otherwise they can't create a hidden doc).
      const visibleToTech = !isManager;

      console.log('Uploading file:', finalFileName, 'to path:', filePath);

      // Upload file to storage. Large CAD documents use resumable chunks.
      try {
        await uploadStorageObject(supabase, {
          bucket: 'tour-documents',
          path: filePath,
          file,
          contentType: file.type || 'application/octet-stream',
        });
      } catch (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(getStorageUploadErrorMessage(uploadError, file));
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
        const { error: cleanupError } = await supabase.storage.from('tour-documents').remove([filePath]);
        if (cleanupError) {
          console.error('Storage cleanup after failed document insert failed:', cleanupError);
        }
        throw dbError;
      }

      console.log('Document uploaded successfully:', data);
      return data;
    },
    onSuccess: (_data, variables) => {
      if (!variables.suppressInvalidation) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tourId) });
      }
      if (!variables.suppressToast) {
        toast.success('Documento subido correctamente');
      }
    },
    onError: (error: unknown, variables) => {
      console.error('Upload error:', error);
      if (!variables?.suppressToast) {
        toast.error('No se pudo subir el documento', {
          description: getDocumentUploadErrorMessage(error),
        });
      }
    }
  });

  const refreshDocuments = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tourId) });

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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tourId) });
      toast.success('Visibility updated');
    },
    onError: (error: any) => {
      console.error('Update visibility error:', error);
      toast.error('Failed to update visibility');
    },
  });

  const updateGuestVisibility = useMutation({
    mutationFn: async ({ documentId, visibleToGuest }: { documentId: string; visibleToGuest: boolean }) => {
      if (!canManageVisibility) {
        throw new Error('Not allowed');
      }

      const { error } = await supabase
        .from('tour_documents')
        .update({ visible_to_guest: visibleToGuest })
        .eq('id', documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tourId) });
      toast.success('Guest visibility updated');
    },
    onError: (error: any) => {
      console.error('Update guest visibility error:', error);
      toast.error('Failed to update guest visibility');
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: TourDocument) => {
      if (!user?.id) {
        throw new Error('Not authenticated');
      }

      const canDeleteAnyTourDocument = canDeleteTourDocuments(userRole);
      if (document.uploaded_by !== user.id && !canDeleteAnyTourDocument) {
        throw new Error('Not allowed');
      }

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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tourId) });
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
    
    return canDeleteTourDocuments(userRole);
  };

  const canUpload =
    Boolean(user?.id) &&
    canUploadTourDocuments(userRole);

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    refreshDocuments,
    updateVisibility,
    updateGuestVisibility,
    deleteDocument,
    getDocumentUrl,
    canDelete,
    canManageVisibility,
    canUpload,
  };
};
