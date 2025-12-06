import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { expenseCopy } from './expenseCopy';
import { cn } from '@/lib/utils';

interface ReceiptUploadFieldProps {
  value?: string | null;
  isRequired?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
  onChange: (file: File | null) => void;
  onRemove?: () => void;
  onView?: () => void;
  disabled?: boolean;
}

export const ReceiptUploadField: React.FC<ReceiptUploadFieldProps> = ({
  value,
  isRequired = false,
  isUploading = false,
  uploadProgress = 0,
  error,
  onChange,
  onRemove,
  onView,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      // Only accept images and PDFs
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        onChange(file);
      }
    }
  }, [disabled, isUploading, onChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onChange(files[0]);
    }
  }, [onChange]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    }
  }, [onRemove]);

  const handleView = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onView) {
      onView();
    }
  }, [onView]);

  return (
    <div className="space-y-2">
      <Label>
        {expenseCopy.labels.receipt}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {/* Upload area */}
      {!value && (
        <>
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              isDragging && 'border-primary bg-primary/5',
              !isDragging && 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600',
              disabled && 'opacity-50 cursor-not-allowed',
              error && 'border-red-500',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || isUploading}
            />

            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">{expenseCopy.info.uploading}</p>
                {uploadProgress > 0 && (
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">{expenseCopy.actions.uploadReceipt}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Arrastra una imagen o PDF aquí, o haz clic para seleccionar
                  </p>
                </div>
              </div>
            )}
          </div>

          {!isRequired && !error && (
            <p className="text-xs text-muted-foreground">{expenseCopy.info.receiptOptional}</p>
          )}
          {isRequired && !error && (
            <p className="text-xs text-orange-600 dark:text-orange-400">{expenseCopy.info.receiptRequired}</p>
          )}
        </>
      )}

      {/* Preview when file is uploaded */}
      {value && !isUploading && (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {value.split('/').pop() || 'Recibo'}
            </p>
            <p className="text-xs text-muted-foreground">Subido</p>
          </div>
          <div className="flex gap-1">
            {onView && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleView}
                className="h-8 w-8 p-0"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {onRemove && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
