
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Department } from "@/types/department";
import { SubscriptionIndicator } from "../ui/subscription-indicator";
import { useEffect, useState } from "react";
import { useTableSubscription } from "@/hooks/useSubscription";

interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

interface JobDocumentsProps {
  jobId: string;
  documents: JobDocument[];
  department?: Department;
  onDeleteDocument: (jobId: string, document: JobDocument) => void;
}

export const JobDocuments = ({ 
  jobId, 
  documents, 
  department,
  onDeleteDocument 
}: JobDocumentsProps) => {
  const { toast } = useToast();
  const [localDocuments, setLocalDocuments] = useState<JobDocument[]>(documents);
  
  // Set up real-time subscription
  useTableSubscription('job_documents', ['job_documents', jobId]);
  
  // Update local documents when the prop changes
  useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  const handleDownload = async (jobDocument: JobDocument) => {
    try {
      console.log('Starting download for document:', jobDocument.file_name);
      
      const { data, error } = await supabase.storage
        .from('job_documents')
        .download(jobDocument.file_path);

      if (error) {
        console.error('Download error:', error);
        throw error;
      }

      const url = window.URL.createObjectURL(data);
      const downloadLink = window.document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = jobDocument.file_name;
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      window.document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "Your file download has started.",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = async (jobDocument: JobDocument) => {
    try {
      console.log('Starting view for document:', jobDocument.file_name);
      
      const { data: { signedUrl }, error } = await supabase.storage
        .from('job_documents')
        .createSignedUrl(jobDocument.file_path, 60);

      if (error) {
        console.error('View error:', error);
        throw error;
      }

      window.open(signedUrl, '_blank');
    } catch (error: any) {
      console.error('View error:', error);
      toast({
        title: "View failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = (document: JobDocument) => {
    // Update local documents optimistically
    setLocalDocuments(current => current.filter(doc => doc.id !== document.id));
    
    // Call the actual delete handler
    onDeleteDocument(jobId, document);
  };

  if (!localDocuments?.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Documents</div>
        <SubscriptionIndicator tables={['job_documents']} variant="compact" />
      </div>
      <div className="space-y-2">
        {localDocuments.map((doc) => (
          <div 
            key={doc.id} 
            className="flex items-center justify-between p-2 rounded-md bg-accent/20"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{doc.file_name}</span>
              <span className="text-xs text-muted-foreground">
                Uploaded {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleView(doc);
                }}
                title="View"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(doc);
                }}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
