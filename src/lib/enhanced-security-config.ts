
/**
 * Enhanced security configuration for the application
 * Builds upon the base security config with additional protections
 */

import { VALIDATION_PATTERNS, sanitizeInput, validateFolderName } from './security-config';

// Enhanced rate limiting with progressive penalties
export const ENHANCED_RATE_LIMITS = {
  // Standard API limits
  FLEX_API_PER_MINUTE: 60,
  FLEX_API_PER_HOUR: 1000,
  
  // Progressive penalty system
  FIRST_VIOLATION_PENALTY: 30000, // 30 seconds
  SECOND_VIOLATION_PENALTY: 300000, // 5 minutes
  THIRD_VIOLATION_PENALTY: 1800000, // 30 minutes
  
  // Document upload limits
  DOCUMENT_UPLOAD_PER_MINUTE: 10,
  DOCUMENT_UPLOAD_PER_HOUR: 100,
  MAX_DOCUMENT_SIZE: 50 * 1024 * 1024, // 50MB
  
  // User action limits
  USER_CREATION_PER_HOUR: 5,
  PASSWORD_RESET_PER_HOUR: 3,
} as const;

// Enhanced validation patterns with more comprehensive checks
export const ENHANCED_VALIDATION_PATTERNS = {
  ...VALIDATION_PATTERNS,
  
  // Email validation with common attack patterns blocked
  SECURE_EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  
  // Phone number validation (international format)
  PHONE_NUMBER: /^\+?[1-9]\d{1,14}$/,
  
  // Strong password requirements
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  
  // File name validation (prevent path traversal)
  SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
  
  // URL validation for external links
  SAFE_URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
} as const;

// Content Security Policy headers
export const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'SectorPro-WebApp/1.0',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

// Sensitive data patterns to detect and prevent logging
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /credential/i,
  /api.?key/i,
];

/**
 * Enhanced input sanitization with XSS protection
 */
export function enhancedSanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes that could break JSON
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: URLs
    .trim()
    .slice(0, 1000); // Limit length to prevent DoS
}

/**
 * Validate email with enhanced security checks
 */
export function validateSecureEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  
  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(email))) {
    return false;
  }
  
  return ENHANCED_VALIDATION_PATTERNS.SECURE_EMAIL.test(email);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (!password) {
    return { isValid: false, score: 0, feedback: ['Password is required'] };
  }
  
  if (password.length >= 8) score += 1;
  else feedback.push('Password must be at least 8 characters long');
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Password must contain lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Password must contain uppercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Password must contain numbers');
  
  if (/[@$!%*?&]/.test(password)) score += 1;
  else feedback.push('Password must contain special characters');
  
  if (password.length >= 12) score += 1;
  
  // Check for common patterns
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
  ];
  
  if (commonPatterns.some(pattern => pattern.test(password))) {
    score -= 2;
    feedback.push('Password contains common patterns');
  }
  
  const isValid = score >= 5;
  return { isValid, score: Math.max(0, score), feedback };
}

/**
 * Validate file upload with security checks
 */
export function validateFileUpload(file: File): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check file size
  if (file.size > ENHANCED_RATE_LIMITS.MAX_DOCUMENT_SIZE) {
    errors.push(`File size exceeds ${ENHANCED_RATE_LIMITS.MAX_DOCUMENT_SIZE / 1024 / 1024}MB limit`);
  }
  
  // Check filename
  if (!ENHANCED_VALIDATION_PATTERNS.SAFE_FILENAME.test(file.name)) {
    errors.push('File name contains invalid characters');
  }
  
  // Check for double extensions (e.g., file.txt.exe)
  const nameParts = file.name.split('.');
  if (nameParts.length > 2) {
    errors.push('File name cannot contain multiple extensions');
  }
  
  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  if (!allowedTypes.includes(file.type)) {
    errors.push('File type not allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Detect and redact sensitive information from logs
 */
export function sanitizeLogData(data: any): any {
  if (typeof data === 'string') {
    // Check if string contains sensitive patterns
    const containsSensitive = SENSITIVE_PATTERNS.some(pattern => 
      pattern.test(data)
    );
    
    if (containsSensitive) {
      return '[REDACTED]';
    }
    
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    
    Object.keys(data).forEach(key => {
      const keyContainsSensitive = SENSITIVE_PATTERNS.some(pattern => 
        pattern.test(key)
      );
      
      if (keyContainsSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(data[key]);
      }
    });
    
    return sanitized;
  }
  
  return data;
}

/**
 * Enhanced environment validation
 */
export function validateEnvironmentSecurity(): {
  isSecure: boolean;
  warnings: string[];
  criticalIssues: string[];
} {
  const warnings: string[] = [];
  const criticalIssues: string[] = [];
  
  // Check for required environment variables
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      criticalIssues.push(`Missing required environment variable: ${varName}`);
    } else if (value.includes('localhost') || value.includes('127.0.0.1')) {
      warnings.push(`${varName} points to localhost - ensure this is intentional`);
    }
  });
  
  // Check for development indicators in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SUPABASE_URL?.includes('localhost')) {
      criticalIssues.push('Production environment using localhost Supabase URL');
    }
  }
  
  return {
    isSecure: criticalIssues.length === 0,
    warnings,
    criticalIssues
  };
}

export {
  sanitizeInput,
  validateFolderName,
  // Re-export enhanced versions
  enhancedSanitizeInput as sanitizeInput,
  validateSecureEmail as validateEmail,
};
