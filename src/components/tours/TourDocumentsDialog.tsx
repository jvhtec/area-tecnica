
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X } from "lucide-react";
import { useState } from "react";
import { TourDocumentsList } from "./TourDocumentsList";
import { TourDocumentUploader } from "./TourDocumentUploader";
import { useTourDocuments } from "@/hooks/useTourDocuments";

interface TourDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
}

export const TourDocumentsDialog = ({
  open,
  onOpenChange,
  tourId,
  tourName
}: TourDocumentsDialogProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const { documents, isLoading } = useTourDocuments(tourId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] md:w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <FileText className="h-4 w-4 md:h-5 md:w-5" />
            <span className="truncate">Tour Documents - {tourName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Upload Documents</h3>
              <Button
                onClick={() => setIsUploading(!isUploading)}
                variant={isUploading ? "outline" : "default"}
              >
                {isUploading ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </>
                )}
              </Button>
            </div>

            {isUploading && (
              <TourDocumentUploader
                tourId={tourId}
                onSuccess={() => setIsUploading(false)}
                onCancel={() => setIsUploading(false)}
              />
            )}
          </div>

          {/* Documents List */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">
              Documents ({documents.length})
            </h3>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Loading documents...</p>
              </div>
            ) : (
              <TourDocumentsList tourId={tourId} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
