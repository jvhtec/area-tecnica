
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText } from "lucide-react";
import { useTourDocuments } from "@/hooks/useTourDocuments";
import { toast } from "sonner";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  getDocumentUploadValidationError,
} from "@/utils/documentUploadValidation";

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
  const { uploadDocument, refreshDocuments } = useTourDocuments(tourId);

  const queueFiles = (files: File[]) => {
    if (files.length === 0) return;

    const validationError = getDocumentUploadValidationError(files);
    if (validationError) {
      toast.error("No se pueden añadir archivos", { description: validationError });
      return;
    }

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

    const filesToUpload = selectedFiles;
    const isBatchUpload = filesToUpload.length > 1;

    try {
      setUploadProgress(0);
      for (const [index, file] of filesToUpload.entries()) {
        await uploadDocument.mutateAsync({
          file,
          fileName: filesToUpload.length === 1 ? fileName.trim() || file.name : file.name,
          suppressInvalidation: isBatchUpload,
          suppressToast: isBatchUpload
        });
        setSelectedFiles((currentFiles) => {
          const nextFiles = currentFiles.filter((candidate) => candidate !== file);
          setFileName(nextFiles.length === 1 ? nextFiles[0].name : "");
          return nextFiles;
        });
        setUploadProgress(Math.round(((index + 1) / filesToUpload.length) * 100));
      }
      if (isBatchUpload) {
        await refreshDocuments();
        toast.success(`${filesToUpload.length} documentos subidos correctamente`);
      }
      setUploadProgress(100);
      onSuccess();
    } catch (error) {
      setUploadProgress(0);
      console.error('Upload failed:', error);
      if (isBatchUpload) {
        toast.error('No se pudo completar la cola de subida');
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
        accept={DOCUMENT_UPLOAD_ACCEPT}
      />

      {selectedFiles.length === 0 ? (
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Suelta archivos aquí o haz clic para seleccionar</p>
          <p className="text-sm text-muted-foreground">
            Formatos admitidos: PDF, DOC, DOCX, JPG, PNG, GIF, TXT
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} archivo{selectedFiles.length === 1 ? "" : "s"} en cola · {totalSizeMb.toFixed(2)} MB
              </p>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                Añadir más
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
              <Label htmlFor="fileName">Nombre del documento (opcional)</Label>
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Introduce un nombre personalizado"
                disabled={isUploading}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Las subidas en cola usan el nombre original de cada archivo. El nombre personalizado solo está disponible para una subida individual.
            </p>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <Label>Progreso de subida</Label>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={isUploading}>
              Cancelar
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={isUploading}>
              Limpiar
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
            >
              {isUploading
                ? 'Subiendo...'
                : selectedFiles.length === 1
                  ? 'Subir documento'
                  : `Subir ${selectedFiles.length} documentos`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
