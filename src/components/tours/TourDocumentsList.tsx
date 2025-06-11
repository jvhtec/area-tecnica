
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText, Download, Trash2, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useTourDocuments } from "@/hooks/useTourDocuments";
import { formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

interface TourDocumentsListProps {
  tourId: string;
}

export const TourDocumentsList = ({ tourId }: TourDocumentsListProps) => {
  const { documents, deleteDocument, getDocumentUrl, canDelete } = useTourDocuments(tourId);

  const handleView = async (doc: any) => {
    try {
      console.log('Attempting to view document:', doc.file_name);
      const url = await getDocumentUrl(doc);
      console.log('Generated URL for viewing:', url);
      
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.success('Document opened in new tab');
      } else {
        throw new Error('Failed to generate document URL');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to view document. Please try again.');
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      console.log('Attempting to download document:', doc.file_name);
      const url = await getDocumentUrl(doc);
      console.log('Generated URL for download:', url);
      
      if (!url) {
        throw new Error('Failed to generate download URL');
      }

      // Use the global document object explicitly to avoid naming conflicts
      const downloadLink = globalThis.document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = doc.file_name;
      downloadLink.target = '_blank';
      downloadLink.style.display = 'none';
      
      // Append to body, click, and remove
      globalThis.document.body.appendChild(downloadLink);
      downloadLink.click();
      globalThis.document.body.removeChild(downloadLink);
      
      toast.success('Download started');
      console.log('Download initiated successfully');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document. Please try again.');
    }
  };

  const handleDelete = async (doc: any) => {
    if (!canDelete(doc)) {
      toast.error('You do not have permission to delete this document');
      return;
    }

    const confirmDelete = globalThis.confirm(`Are you sure you want to delete "${doc.file_name}"?`);
    if (confirmDelete) {
      try {
        console.log('Attempting to delete document:', doc.file_name);
        await deleteDocument.mutateAsync(doc);
        toast.success('Document deleted successfully');
      } catch (error) {
        console.error('Error deleting document:', error);
        toast.error('Failed to delete document. Please try again.');
      }
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Documents</h3>
        <p className="text-muted-foreground">
          No documents have been uploaded for this tour yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <Card key={document.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium">{document.file_name}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(document.uploaded_at), 'MMM d, yyyy')}
                    </div>
                    {document.file_size && (
                      <span>{formatFileSize(document.file_size)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(document)}
                  title="View document"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(document)}
                  title="Download document"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete(document) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(document)}
                    title="Delete document"
                    className="text-destructive hover:text-destructive"
                    disabled={deleteDocument.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};
