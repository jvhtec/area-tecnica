
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
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
  const { documents, isLoading, canUpload } = useTourDocuments(tourId);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[90vh] w-full max-w-4xl overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <FileText className="h-4 w-4 md:h-5 md:w-5" />
            <span className="truncate">Documentos de gira — {tourName}</span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="min-w-0 space-y-4 md:space-y-6">
          {/* Upload Section */}
          {canUpload ? (
            <div className="min-w-0 rounded-lg border p-3 md:p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-medium">Subir documentos</h3>
                <Button
                  onClick={() => setIsUploading(!isUploading)}
                  variant={isUploading ? "outline" : "default"}
                >
                  {isUploading ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Subir
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
          ) : null}

          {/* Documents List */}
          <div className="min-w-0 rounded-lg border p-3 md:p-4">
            <h3 className="text-lg font-medium mb-4">
              Documentos ({documents.length})
            </h3>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Cargando documentos…</p>
              </div>
            ) : (
              <TourDocumentsList tourId={tourId} />
            )}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
