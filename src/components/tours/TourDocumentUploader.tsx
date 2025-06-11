
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText } from "lucide-react";
import { useTourDocuments } from "@/hooks/useTourDocuments";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument } = useTourDocuments(tourId);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploadProgress(25);
      await uploadDocument.mutateAsync({
        file: selectedFile,
        fileName: fileName.trim() || selectedFile.name
      });
      setUploadProgress(100);
      onSuccess();
    } catch (error) {
      setUploadProgress(0);
      console.error('Upload failed:', error);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileName("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {!selectedFile ? (
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
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileName">Document Name (Optional)</Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Enter custom document name"
            />
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={uploadDocument.isPending || uploadProgress > 0}
            >
              {uploadDocument.isPending ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
