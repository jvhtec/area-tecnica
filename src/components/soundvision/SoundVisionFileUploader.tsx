import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Upload, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { VenueMetadataForm, VenueFormData } from './VenueMetadataForm';
import { useSoundVisionUpload } from '@/hooks/useSoundVisionUpload';
import { validateFile, ALLOWED_FILE_TYPES } from '@/utils/soundvisionFileValidation';

interface SoundVisionFileUploaderProps {
  onUploadComplete?: () => void;
}

export const SoundVisionFileUploader = ({ onUploadComplete }: SoundVisionFileUploaderProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const { upload, isUploading, progress } = useSoundVisionUpload();

  const form = useForm<VenueFormData>({
    defaultValues: {
      venueName: '',
      venueCity: '',
      venueStateRegion: '',
      venueCountry: '',
      venueAddress: '',
      venueCapacity: '',
      venueNotes: '',
      googlePlaceId: '',
      coordinates: null,
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    setSelectedFile(file);
  };

  const onSubmit = (data: VenueFormData) => {
    if (!selectedFile) {
      alert('Por favor, selecciona un archivo');
      return;
    }

    upload(
      {
        file: selectedFile,
        venueData: {
          name: data.venueName,
          google_place_id: data.googlePlaceId || null,
          city: data.venueCity,
          state_region: data.venueStateRegion || null,
          country: data.venueCountry,
          full_address: data.venueAddress || null,
          coordinates: data.coordinates,
          capacity: data.venueCapacity ? parseInt(data.venueCapacity) : null,
        },
        notes: data.venueNotes || undefined,
      },
      {
        onSuccess: () => {
          setSelectedFile(null);
          form.reset();
          onUploadComplete?.();
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* File Selection Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <File className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
            >
              Quitar
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Arrastra y suelta aquí tu archivo de SoundVision
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Formatos admitidos: {ALLOWED_FILE_TYPES.join(', ')} (Máx. 100 MB)
            </p>
            <label htmlFor="file-input">
              <Button variant="outline" asChild>
                <span>Buscar archivos</span>
              </Button>
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept={ALLOWED_FILE_TYPES.join(',')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                disabled={isUploading}
              />
            </label>
          </>
        )}
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subiendo...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* Venue Metadata Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <VenueMetadataForm form={form} />

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedFile || isUploading}
          >
            Subir archivo
          </Button>
        </form>
      </Form>
    </div>
  );
};
