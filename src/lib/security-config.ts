
/**
 * Security configuration for the application
 */

// API endpoints that are allowed for external calls
export const ALLOWED_API_ENDPOINTS = [
  '/element'
] as const;

// Rate limiting configuration
export const RATE_LIMITS = {
  // Maximum requests per minute per user for Flex API
  FLEX_API_PER_MINUTE: 60,
  // Maximum requests per hour per user for Flex API
  FLEX_API_PER_HOUR: 1000,
} as const;

// Security headers for external API calls
export const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'SectorPro-WebApp/1.0',
} as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  // Flex folder names should only contain alphanumeric, spaces, hyphens, and underscores
  FOLDER_NAME: /^[a-zA-Z0-9\s\-_À-ÿ]+$/,
  // Document numbers should follow specific format
  DOCUMENT_NUMBER: /^[0-9]{6}[A-Z]{2,6}$/,
} as const;

// Environment validation
export const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'X_AUTH_TOKEN'
] as const;

/**
 * Validates if an endpoint is allowed for external API calls
 */
export function isAllowedEndpoint(endpoint: string): boolean {
  return ALLOWED_API_ENDPOINTS.some(allowed => endpoint.startsWith(allowed));
}

/**
 * Validates folder name against security patterns
 */
export function validateFolderName(name: string): boolean {
  if (!name || name.length > 100) return false;
  return VALIDATION_PATTERNS.FOLDER_NAME.test(name);
}

/**
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes that could break JSON
    .trim();
}
