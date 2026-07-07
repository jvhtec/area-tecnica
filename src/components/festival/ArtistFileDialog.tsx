import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { FileText, Loader2, Trash2, Upload, Eye, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ViewFileDialog } from "./ViewFileDialog";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  getDocumentUploadValidationError,
} from "@/utils/documentUploadValidation";
import { optimizeImageForUpload } from "@/utils/imageOptimization";
import { getStorageUploadErrorMessage, uploadStorageObject } from "@/utils/storageUpload";

interface ArtistFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string;
}

export const ArtistFileDialog = ({ open, onOpenChange, artistId }: ArtistFileDialogProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<any>(null);
  const [viewFileUrl, setViewFileUrl] = useState<string>("");

  const fetchFiles = async () => {
    try {
      const { data, error } = await dataLayerClient.from("festival_artist_files")
        .select("*")
        .eq("artist_id", artistId);

      if (error) {
        console.error("Error fetching files:", error);
        toast({
          title: "Error",
          description: "No se pudieron obtener los archivos",
          variant: "destructive",
        });
        return;
      }

      setFiles(data || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los archivos",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open && artistId) {
      fetchFiles();
    }
  }, [open, artistId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const validationError = getDocumentUploadValidationError(selectedFiles);
    if (validationError) {
      toast({
        title: "Archivo no permitido",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    const uploadedPaths: string[] = [];
    const insertedIds: string[] = [];
    setIsUploading(true);
    try {
      for (const file of selectedFiles) {
        const uploadFile = await optimizeImageForUpload(file, {
          maxWidth: 1800,
          maxHeight: 1800,
          quality: 0.82,
          outputFormat: 'image/webp',
        });
        const fileExt = uploadFile.name.split('.').pop();
        const filePath = `${artistId}/${crypto.randomUUID()}.${fileExt}`;

        // First upload the file to storage. Large CAD/rider files use resumable chunks.
        try {
          await uploadStorageObject(dataLayerClient, {
            bucket: 'festival_artist_files',
            path: filePath,
            file: uploadFile,
            contentType: uploadFile.type || file.type || 'application/octet-stream',
          });
        } catch (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(getStorageUploadErrorMessage(uploadError, uploadFile));
        }
        uploadedPaths.push(filePath);

        // Then create the database record
        const { data: insertedFile, error: dbError } = await dataLayerClient.from('festival_artist_files')
          .insert({
            artist_id: artistId,
            file_name: file.name,
            file_path: filePath,
            file_type: uploadFile.type || file.type,
            file_size: uploadFile.size,
          })
          .select("id")
          .single();

        if (dbError) {
          console.error("Database insert error:", dbError);
          throw dbError;
        }

        if (insertedFile?.id) {
          insertedIds.push(insertedFile.id);
        }
      }

      const { error: artistUpdateError } = await dataLayerClient
        .from("festival_artists")
        .update({
          rider_missing: false,
          rider_outdated: false,
          rider_copied_from_date: null,
          rider_outdated_dismissed: false,
        })
        .eq("id", artistId);

      if (artistUpdateError) {
        console.error("Artist rider state update error:", artistUpdateError);
      }

      const uploadSuccessDescription =
        selectedFiles.length === 1
          ? "Archivo cargado correctamente"
          : `${selectedFiles.length} archivos cargados correctamente`;

      toast({
        title: artistUpdateError ? "Carga completada con aviso" : "Éxito",
        description: artistUpdateError
          ? `${uploadSuccessDescription}, pero no se pudo actualizar el estado del rider.`
          : uploadSuccessDescription,
      });

      fetchFiles();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      const uploadErrorMessage = error instanceof Error ? error.message : "";
      try {
        if (insertedIds.length > 0) {
          await dataLayerClient.from('festival_artist_files').delete().in('id', insertedIds);
        }
        if (uploadedPaths.length > 0) {
          await dataLayerClient.storage.from('festival_artist_files').remove(uploadedPaths);
        }
      } catch (cleanupError) {
        console.error("Error rolling back artist file upload batch:", cleanupError);
      }
      toast({
        title: "Error",
        description: uploadErrorMessage || "No se pudo completar la carga. Se han revertido los archivos de esta tanda.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDelete = async () => {
    if (!selectedFile) return;

    try {
      const { data: deleteRows, error: dbError } = await dataLayerClient
        .rpc("delete_festival_artist_file_reference", {
          p_file_id: selectedFile.id,
        });

      if (dbError) {
        console.error("Database delete error:", dbError);
        throw dbError;
      }

      const deleteResult = deleteRows?.[0];
      if (!deleteResult) {
        throw new Error("No se recibió confirmación de eliminación.");
      }

      if (deleteResult.should_delete_storage && deleteResult.file_path) {
        const { error: storageError } = await dataLayerClient.storage
          .from('festival_artist_files')
          .remove([deleteResult.file_path]);

        if (storageError) {
          console.error("Storage delete error:", storageError);
        }
      }

      toast({
        title: "Éxito",
        description: "Archivo eliminado correctamente",
      });

      fetchFiles();
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el archivo",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedFile(null);
    }
  };

  const downloadFile = async (file: any) => {
    try {
      const { data, error } = await dataLayerClient.storage
        .from('festival_artist_files')
        .download(file.file_path);

      if (error) {
        console.error("Download error:", error);
        throw error;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const handleViewFile = async (file: any) => {
    try {
      const { data } = await dataLayerClient.storage
        .from('festival_artist_files')
        .createSignedUrl(file.file_path, 3600); // URL valid for 1 hour

      if (data?.signedUrl) {
        setViewFileUrl(data.signedUrl);
        setViewingFile(file);
        setViewDialogOpen(true);
      }
    } catch (error) {
      console.error("Error getting file URL:", error);
      toast({
        title: "Error",
        description: "No se pudo ver el archivo",
        variant: "destructive",
      });
    }
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
                  onChange={handleFileUpload}
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
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(file.file_type.startsWith('image/') || file.file_type === 'application/pdf') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewFile(file)}
                            title="Ver archivo"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file)}
                          title="Descargar archivo"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(file);
                            setDeleteDialogOpen(true);
                          }}
                          title="Eliminar archivo"
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Archivo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea eliminar este archivo? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFileDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewFileDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        file={viewingFile}
        url={viewFileUrl}
      />
    </>
  );
};
