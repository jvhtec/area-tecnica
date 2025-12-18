import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  optimizeProfilePicture,
  validateImageFile,
  generateProfilePictureFileName,
  getProfilePictureUrl,
} from '@/utils/imageOptimization';

interface ProfilePictureUploadProps {
  userId: string;
  currentPictureUrl?: string | null;
  userInitials: string;
  onUploadComplete?: (url: string) => void;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCameraIcon?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
  xl: 'h-40 w-40',
};

const iconSizes = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export function ProfilePictureUpload({
  userId,
  currentPictureUrl,
  userInitials,
  onUploadComplete,
  onRemove,
  size = 'lg',
  showCameraIcon = true,
  className = '',
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPictureUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Optimize image
      const optimizedFile = await optimizeProfilePicture(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
        outputFormat: 'image/webp',
      });

      // Generate unique filename
      const fileName = generateProfilePictureFileName(userId, optimizedFile.name);

      // Delete old profile picture if exists
      if (currentPictureUrl) {
        const oldPath = currentPictureUrl.split('/profile-pictures/')[1];
        if (oldPath) {
          await supabase.storage.from('profile-pictures').remove([oldPath]);
        }
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, optimizedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const publicUrl = getProfilePictureUrl(supabaseUrl, fileName);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Update preview
      setPreviewUrl(publicUrl);

      toast({
        title: 'Success',
        description: 'Profile picture updated successfully',
      });

      // Notify parent component
      onUploadComplete?.(publicUrl);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload profile picture',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!currentPictureUrl) return;

    setUploading(true);

    try {
      // Delete from storage
      const filePath = currentPictureUrl.split('/profile-pictures/')[1];
      if (filePath) {
        const { error: deleteError } = await supabase.storage
          .from('profile-pictures')
          .remove([filePath]);

        if (deleteError) {
          throw deleteError;
        }
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: null })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setPreviewUrl(null);

      toast({
        title: 'Success',
        description: 'Profile picture removed',
      });

      onRemove?.();
    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove profile picture',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <Avatar className={sizeClasses[size]}>
        {previewUrl ? (
          <AvatarImage src={previewUrl} alt="Profile picture" />
        ) : null}
        <AvatarFallback className="text-lg font-semibold">
          {userInitials}
        </AvatarFallback>
      </Avatar>

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
          <Loader2 className="animate-spin text-white" size={iconSizes[size]} />
        </div>
      )}

      {showCameraIcon && !uploading && (
        <Button
          size="icon"
          className="absolute bottom-0 right-0 rounded-full shadow-lg h-8 w-8"
          onClick={handleClick}
          disabled={uploading}
        >
          <Camera size={iconSizes[size]} />
        </Button>
      )}

      {previewUrl && !uploading && (
        <Button
          size="icon"
          variant="destructive"
          className="absolute top-0 right-0 rounded-full shadow-lg h-6 w-6"
          onClick={handleRemove}
          disabled={uploading}
        >
          <X size={12} />
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
