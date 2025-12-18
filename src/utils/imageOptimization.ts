/**
 * Image optimization utilities for profile pictures
 * Optimizes images client-side before upload to reduce bandwidth and storage
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.85,
  outputFormat: 'image/webp',
};

/**
 * Optimizes an image file by resizing and compressing it
 * @param file - The original image file
 * @param options - Optimization options
 * @returns Promise resolving to the optimized file
 */
export async function optimizeProfilePicture(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;

          if (width > opts.maxWidth || height > opts.maxHeight) {
            const aspectRatio = width / height;

            if (width > height) {
              width = opts.maxWidth;
              height = width / aspectRatio;
            } else {
              height = opts.maxHeight;
              width = height * aspectRatio;
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Use better image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob from canvas'));
                return;
              }

              // Create new file with optimized image
              const extension = opts.outputFormat.split('/')[1];
              const fileName = file.name.replace(/\.[^.]+$/, `.${extension}`);
              const optimizedFile = new File([blob], fileName, {
                type: opts.outputFormat,
                lastModified: Date.now(),
              });

              resolve(optimizedFile);
            },
            opts.outputFormat,
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validates that a file is an image and meets size requirements
 * @param file - The file to validate
 * @param maxSizeMB - Maximum file size in megabytes (default: 5MB)
 * @returns Object with validation result and error message if invalid
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 5
): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)',
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generates a unique filename for a profile picture
 * @param userId - The user's ID
 * @param originalFileName - Original file name
 * @returns A unique filename for storage
 */
export function generateProfilePictureFileName(
  userId: string,
  originalFileName: string
): string {
  const timestamp = Date.now();
  const extension = originalFileName.split('.').pop() || 'webp';
  return `${userId}/profile-${timestamp}.${extension}`;
}

/**
 * Gets the public URL for a profile picture
 * @param supabaseUrl - Supabase project URL
 * @param filePath - Path to the file in storage
 * @returns Public URL for the profile picture
 */
export function getProfilePictureUrl(
  supabaseUrl: string,
  filePath: string
): string {
  return `${supabaseUrl}/storage/v1/object/public/profile-pictures/${filePath}`;
}
