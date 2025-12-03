import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadProfilePicture, deleteProfilePicture } from '@/utils/profilePicture';
import { useToast } from '@/hooks/use-toast';

interface ProfilePictureUploadProps {
  userId: string;
  currentPictureUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  buttonClassName?: string;
  iconSize?: number;
}

export function ProfilePictureUpload({
  userId,
  currentPictureUrl,
  onUploadSuccess,
  buttonClassName = "absolute bottom-0 right-0 p-2 rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-500",
  iconSize = 14,
}: ProfilePictureUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await uploadProfilePicture(selectedFile, userId);

      if (result.error) {
        toast({
          title: 'Upload failed',
          description: result.error,
          variant: 'destructive',
        });
      } else if (result.url) {
        toast({
          title: 'Success',
          description: 'Profile picture updated successfully',
        });
        onUploadSuccess(result.url);
        setIsOpen(false);
        setPreviewUrl(null);
        setSelectedFile(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload profile picture',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPictureUrl) return;

    setIsUploading(true);
    try {
      const success = await deleteProfilePicture(userId);

      if (success) {
        toast({
          title: 'Success',
          description: 'Profile picture removed successfully',
        });
        onUploadSuccess('');
        setIsOpen(false);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to remove profile picture',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove profile picture',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  return (
    <>
      <button
        className={buttonClassName}
        onClick={() => setIsOpen(true)}
        aria-label="Upload profile picture"
      >
        <Camera size={iconSize} />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile Picture</DialogTitle>
            <DialogDescription>
              Take a photo or upload an image (max 5MB)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  aria-label="Clear preview"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-32 flex flex-col items-center justify-center gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera size={32} />
                  <span>Take Photo</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-32 flex flex-col items-center justify-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={32} />
                  <span>Upload File</span>
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex gap-2">
              {selectedFile ? (
                <>
                  <Button
                    onClick={handleUpload}
                    className="flex-1"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload'
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {currentPictureUrl && (
                    <Button
                      onClick={handleDelete}
                      variant="destructive"
                      className="flex-1"
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        'Remove Current Picture'
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
