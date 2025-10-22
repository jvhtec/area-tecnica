
import React from 'react';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { resolveJobDocBucket } from "@/utils/jobDocuments";

export interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  visible_to_tech?: boolean;
  read_only?: boolean;
  template_type?: string | null;
}

interface JobCardDocumentsProps {
  documents: JobDocument[];
  userRole: string | null;
  onDeleteDocument: (doc: JobDocument) => void;
  showTitle?: boolean;
}

export const JobCardDocuments: React.FC<JobCardDocumentsProps> = ({
  documents,
  userRole,
  onDeleteDocument,
  showTitle = true,
}) => {
  if (documents.length === 0) {
    return null;
  }

  const handleViewDocument = async (doc: JobDocument) => {
    try {
      console.log("Attempting to view document:", doc);
      const bucket = resolveJobDocBucket(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.file_path, 60);

      if (error || !data?.signedUrl) {
        console.error("Error creating signed URL:", error || 'No signedUrl returned', { bucket, path: doc.file_path });
        throw error || new Error('Failed to generate signed URL');
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

      const bucket = resolveJobDocBucket(doc.file_path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.file_path, 60);
      
      if (error || !data?.signedUrl) {
        console.error('Error creating signed URL for download:', error || 'No signedUrl returned', { bucket, path: doc.file_path });
        throw error || new Error('Failed to generate download URL');
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

  const handleToggleVisibility = async (doc: JobDocument) => {
    if (doc.read_only) {
      return;
    }
    try {
      const next = !Boolean(doc.visible_to_tech);
      const { error } = await supabase
        .from('job_documents')
        .update({ visible_to_tech: next })
        .eq('id', doc.id);
      if (error) throw error;
      // Realtime subscription in parent hook will refresh the list
      if (next) {
        try {
          // Notify assigned technicians about new tech-visible document
          void supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'document.tech_visible.enabled',
              doc_id: doc.id,
              file_name: doc.file_name,
            }
          });
        } catch {}
      }
    } catch (err: any) {
      console.error('Error toggling document visibility:', err);
      alert(`Error updating visibility: ${err.message}`);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {showTitle && <div className="text-sm font-medium">Documents</div>}
      <div className="space-y-2">
        {documents.map((doc) => {
          const isTemplate = doc.template_type === 'soundvision';
          const isReadOnly = Boolean(doc.read_only);
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex flex-col">
              <span className="text-sm font-medium flex items-center gap-2">
                {doc.file_name}
                {isTemplate && (
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                    Template SoundVision File
                  </Badge>
                )}
                {['admin','management'].includes(userRole || '') && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${doc.visible_to_tech ? 'bg-green-500/20 text-green-800 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>
                    {doc.visible_to_tech ? 'Tech-visible' : 'Hidden from tech'}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                {isReadOnly && (
                  <span className="ml-2 italic">Read-only</span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              {['admin','management'].includes(userRole || '') && (
                <div className="flex items-center gap-2 pr-2">
                  <span className="text-xs text-muted-foreground select-none">Tech can view</span>
                  <Switch
                    checked={Boolean(doc.visible_to_tech)}
                    onCheckedChange={() => handleToggleVisibility(doc)}
                    disabled={isReadOnly}
                  />
                </div>
              )}
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
              {['admin', 'management'].includes(userRole || '') && !isReadOnly && (
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
          );
        })}
      </div>
    </div>
  );
};
