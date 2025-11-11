import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FileText, Loader2, Trash2, Upload, Eye, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ViewFileDialog } from "./ViewFileDialog";

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
      const { data, error } = await supabase
        .from("festival_artist_files")
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
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${artistId}/${crypto.randomUUID()}.${fileExt}`;

      // First upload the file to storage
      const { error: uploadError } = await supabase.storage
        .from('festival_artist_files')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      // Then create the database record
      const { error: dbError } = await supabase
        .from('festival_artist_files')
        .insert({
          artist_id: artistId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        });

      if (dbError) {
        console.error("Database insert error:", dbError);
        throw dbError;
      }

      toast({
        title: "Éxito",
        description: "Archivo cargado correctamente",
      });

      fetchFiles();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el archivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDelete = async () => {
    if (!selectedFile) return;

    try {
      // First delete from storage
      const { error: storageError } = await supabase.storage
        .from('festival_artist_files')
        .remove([selectedFile.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        throw storageError;
      }

      // Then delete the database record
      const { error: dbError } = await supabase
        .from('festival_artist_files')
        .delete()
        .eq('id', selectedFile.id);

      if (dbError) {
        console.error("Database delete error:", dbError);
        throw dbError;
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
      const { data, error } = await supabase.storage
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
      const { data } = await supabase.storage
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
