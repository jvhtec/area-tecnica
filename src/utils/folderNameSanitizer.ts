/**
 * Comprehensive folder name sanitization utility
 * Handles all edge cases for File System Access API folder creation
 */

// Windows reserved names (case-insensitive)
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

// Characters that are invalid in folder names
const INVALID_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1f\x7f-\x9f]/g;

// Additional problematic characters for cross-platform compatibility
const PROBLEMATIC_CHARS_REGEX = /[^\w\s\-_.()[\]{}]/g;

/**
 * Sanitizes a folder name to be compatible with the File System Access API
 */
export function sanitizeFolderName(
  name: string, 
  options: { 
    maxLength?: number; 
    strict?: boolean; 
    fallbackPrefix?: string;
  } = {}
): string {
  const { maxLength = 200, strict = false, fallbackPrefix = 'Folder' } = options;

  if (!name || typeof name !== 'string') {
    return `${fallbackPrefix}_${Date.now()}`;
  }

  let sanitized = name;

  // Normalize Unicode
  sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remove or replace invalid characters
  if (strict) {
    // Strict mode: only allow alphanumeric, spaces, hyphens, underscores, parentheses, brackets
    sanitized = sanitized.replace(PROBLEMATIC_CHARS_REGEX, '_');
  } else {
    // Standard mode: just remove filesystem-invalid characters
    sanitized = sanitized.replace(INVALID_CHARS_REGEX, '_');
  }

  // Replace multiple consecutive spaces/underscores with single ones
  sanitized = sanitized.replace(/[\s_]+/g, '_');

  // Trim whitespace and dots from start/end
  sanitized = sanitized.replace(/^[.\s_]+|[.\s_]+$/g, '');

  // Check for reserved names (case-insensitive)
  const upperName = sanitized.toUpperCase();
  if (RESERVED_NAMES.includes(upperName) || RESERVED_NAMES.some(reserved => upperName.startsWith(reserved + '.'))) {
    sanitized = `${fallbackPrefix}_${sanitized}`;
  }

  // Ensure it's not empty after sanitization
  if (!sanitized) {
    sanitized = `${fallbackPrefix}_${Date.now()}`;
  }

  // Enforce length limit
  if (sanitized.length > maxLength) {
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const availableLength = maxLength - timestamp.length - 1; // -1 for underscore
    sanitized = sanitized.substring(0, availableLength) + '_' + timestamp;
  }

  return sanitized;
}

/**
 * Validates if a folder name would be accepted by the File System Access API
 */
export function validateFolderName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (name.length > 255) {
    return { valid: false, error: 'Name is too long (max 255 characters)' };
  }

  if (INVALID_CHARS_REGEX.test(name)) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  if (/^[.\s]+$/.test(name)) {
    return { valid: false, error: 'Name cannot consist only of dots or spaces' };
  }

  if (/^[.\s]/.test(name) || /[.\s]$/.test(name)) {
    return { valid: false, error: 'Name cannot start or end with dots or spaces' };
  }

  const upperName = name.toUpperCase();
  if (RESERVED_NAMES.includes(upperName)) {
    return { valid: false, error: 'Name is a reserved system name' };
  }

  return { valid: true };
}

/**
 * Creates a safe folder name with fallback options
 */
export function createSafeFolderName(
  baseName: string, 
  datePrefix?: string, 
  options?: { maxLength?: number; strict?: boolean }
): { name: string; wasSanitized: boolean } {
  const originalName = datePrefix ? `${datePrefix} - ${baseName}` : baseName;
  const sanitizedName = sanitizeFolderName(originalName, options);
  
  return {
    name: sanitizedName,
    wasSanitized: originalName !== sanitizedName
  };
}