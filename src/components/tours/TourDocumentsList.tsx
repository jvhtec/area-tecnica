
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

  const handleView = async (document: any) => {
    try {
      const url = await getDocumentUrl(document);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to view document');
    }
  };

  const handleDownload = async (document: any) => {
    try {
      const url = await getDocumentUrl(document);
      
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = document.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const handleDelete = async (document: any) => {
    if (!canDelete(document)) {
      toast.error('You do not have permission to delete this document');
      return;
    }

    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument.mutateAsync(document);
      } catch (error) {
        console.error('Error deleting document:', error);
        toast.error('Failed to delete document');
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
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(document)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete(document) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(document)}
                    title="Delete"
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
