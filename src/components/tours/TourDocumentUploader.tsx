
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText } from "lucide-react";
import { useTourDocuments } from "@/hooks/useTourDocuments";
import { toast } from "sonner";

interface TourDocumentUploaderProps {
  tourId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TourDocumentUploader = ({
  tourId,
  onSuccess,
  onCancel
}: TourDocumentUploaderProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument } = useTourDocuments(tourId);

  const queueFiles = (files: File[]) => {
    if (files.length === 0) return;

    setSelectedFiles((currentFiles) => {
      const nextFiles = [...currentFiles, ...files];
      setFileName(nextFiles.length === 1 ? nextFiles[0].name : "");
      return nextFiles;
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    queueFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    queueFiles(Array.from(event.dataTransfer.files));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploadProgress(0);
      for (const [index, file] of selectedFiles.entries()) {
        await uploadDocument.mutateAsync({
          file,
          fileName: selectedFiles.length === 1 ? fileName.trim() || file.name : file.name,
          suppressToast: selectedFiles.length > 1
        });
        setUploadProgress(Math.round(((index + 1) / selectedFiles.length) * 100));
      }
      if (selectedFiles.length > 1) {
        toast.success(`${selectedFiles.length} documents uploaded successfully`);
      }
      setUploadProgress(100);
      onSuccess();
    } catch (error) {
      setUploadProgress(0);
      console.error('Upload failed:', error);
      if (selectedFiles.length > 1) {
        toast.error('Failed to upload document queue');
      }
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setFileName("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileIndex: number) => {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, index) => index !== fileIndex);
      setFileName(nextFiles.length === 1 ? nextFiles[0].name : "");
      return nextFiles;
    });
  };

  const totalSizeMb = selectedFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024;
  const isUploading = uploadDocument.isPending || (uploadProgress > 0 && uploadProgress < 100);

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
      />

      {selectedFiles.length === 0 ? (
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} queued · {totalSizeMb.toFixed(2)} MB
              </p>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                Add more
              </Button>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 p-4 border rounded-lg">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(index)} disabled={isUploading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {selectedFiles.length === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="fileName">Document Name (Optional)</Label>
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter custom document name"
                disabled={isUploading}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Queued uploads use each file&apos;s original name. Custom naming is available for single-file uploads.
            </p>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={isUploading}>
              Cancel
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={isUploading}>
              Clear
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
            >
              {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length === 1 ? 'Document' : `${selectedFiles.length} Documents`}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
