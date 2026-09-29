import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, Trash2, Upload, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DOCUMENT_UPLOAD_ACCEPT } from "@/utils/documentUploadValidation";
import { useArtistFiles } from "@/features/festival-assets/hooks/useArtistFiles";
import type { ArtistFileRow } from "@/features/festival-assets/api";
import { ViewFileDialog } from "./ViewFileDialog";

interface ArtistFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string;
}

/** Only images and PDFs can be previewed in the browser. */
const isPreviewable = (file: Pick<ArtistFileRow, "file_type">) =>
  !!file.file_type && (file.file_type.startsWith("image/") || file.file_type === "application/pdf");

export const ArtistFileDialog = ({ open, onOpenChange, artistId }: ArtistFileDialogProps) => {
  const { files, isUploading, uploadFiles, deleteFile, downloadFile, getPreviewUrl } = useArtistFiles(artistId, open);
  const [fileToDelete, setFileToDelete] = useState<ArtistFileRow | null>(null);
  const [preview, setPreview] = useState<{ file: ArtistFileRow; url: string } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    // Reset so choosing the same files again still fires a change.
    event.target.value = "";
    uploadFiles(selected);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    const id = fileToDelete.id;
    setFileToDelete(null);
    await deleteFile(id);
  };

  const openPreview = async (file: ArtistFileRow) => {
    const url = await getPreviewUrl(file);
    if (url) setPreview({ file, url });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestionar Archivos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Cargar Archivo</Label>
              <div className="mt-1 flex items-center gap-4">
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept={DOCUMENT_UPLOAD_ACCEPT}
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Archivos</h3>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no se han cargado archivos.</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPreviewable(file) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPreview(file)}
                            title="Ver archivo"
                            aria-label="Ver archivo"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file)}
                          title="Descargar archivo"
                          aria-label="Descargar archivo"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFileToDelete(file)}
                          title="Eliminar archivo"
                          aria-label="Eliminar archivo"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fileToDelete} onOpenChange={(isOpen) => !isOpen && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Archivo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea eliminar este archivo? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewFileDialog
        open={!!preview}
        onOpenChange={(isOpen) => !isOpen && setPreview(null)}
        file={preview?.file ?? null}
        url={preview?.url ?? ""}
      />
    </>
  );
};
