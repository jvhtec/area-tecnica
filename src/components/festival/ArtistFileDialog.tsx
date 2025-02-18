
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
          description: "Failed to fetch files",
          variant: "destructive",
        });
        return;
      }

      setFiles(data || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({
        title: "Error",
        description: "Failed to fetch files",
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
        title: "Success",
        description: "File uploaded successfully",
      });

      fetchFiles();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
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
        title: "Success",
        description: "File deleted successfully",
      });

      fetchFiles();
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
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
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Files</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Upload File</Label>
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
              <h3 className="font-medium mb-2">Files</h3>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file)}
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
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFileDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

