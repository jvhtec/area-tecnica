/**
 * Photo optimization utilities for incident reports
 */

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_SIZE_MB = 10;
export const OPTIMIZED_MAX_DIMENSION = 1600;
export const OPTIMIZED_QUALITY = 0.85;

/**
 * Optimizes a photo file for PDF inclusion by resizing and compressing to JPEG
 * @param file - The photo file to optimize
 * @param maxDimension - Maximum width or height in pixels
 * @param quality - JPEG quality (0-1)
 * @returns Promise resolving to a base64 data URL
 */
export function optimizePhotoForPDF(file: File, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
