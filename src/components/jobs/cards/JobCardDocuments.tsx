
import React from 'react';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, Download, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

interface JobCardDocumentsProps {
  documents: JobDocument[];
  userRole: string | null;
  onDeleteDocument: (doc: JobDocument) => void;
}

export const JobCardDocuments: React.FC<JobCardDocumentsProps> = ({
  documents,
  userRole,
  onDeleteDocument
}) => {
  if (documents.length === 0) {
    return null;
  }

  const resolveBucket = (path: string) =>
    path.startsWith('hojas-de-ruta/') ? 'job-documents' : 'job_documents';

  const handleViewDocument = async (doc: JobDocument) => {
    try {
      console.log("Attempting to view document:", doc);
      const bucket = resolveBucket(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        console.error("Error creating signed URL:", error);
        throw error;
      }

      console.log("Signed URL created:", data.signedUrl);
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      console.error("Error in handleViewDocument:", err);
      alert(`Error viewing document: ${err.message}`);
    }
  };
  
  const handleDownload = async (doc: JobDocument) => {
    try {
      console.log('Starting download for document:', doc.file_name);
      
      const bucket = resolveBucket(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.file_path, 60);
      
      if (error) {
        console.error('Error creating signed URL for download:', error);
        throw error;
      }
      
      if (!data?.signedUrl) {
        throw new Error('Failed to generate download URL');
      }
      
      console.log('Download URL created:', data.signedUrl);
      
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err: any) {
      console.error('Error in handleDownload:', err);
      alert(`Error downloading document: ${err.message}`);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="text-sm font-medium">Documents</div>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{doc.file_name}</span>
              <span className="text-xs text-muted-foreground">
                Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleViewDocument(doc)}
                title="View"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(doc)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              {['admin', 'management'].includes(userRole || '') && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteDocument(doc)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
