// L-Acoustics SoundVision file validation utilities

// L-Acoustics Soundvision file types:
// .xmlp - Project file (full Soundvision project)
// .xmls - Scene file (venue/geometry context)
// .xmlc - Configuration file (exports like speaker positions)
export const ALLOWED_FILE_TYPES = ['.xmlp', '.xmls', '.xmlc'];
export const ALLOWED_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/octet-stream', // Some systems may report XML files as octet-stream
];
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const validateFile = (file: File): FileValidationResult => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 100MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  // Check file extension
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension || !ALLOWED_FILE_TYPES.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
    };
  }

  // Check MIME type (if available)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid MIME type: ${file.type}`,
    };
  }

  return { valid: true };
};

export const sanitizeFileName = (fileName: string): string => {
  // Remove path traversal attempts
  const sanitized = fileName
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  
  return sanitized;
};

export const generateStoragePath = (venueId: string, fileName: string): string => {
  const timestamp = Date.now();
  const sanitizedName = sanitizeFileName(fileName);
  return `${venueId}/${timestamp}_${sanitizedName}`;
};
