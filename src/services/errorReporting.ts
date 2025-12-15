import { supabase } from '@/integrations/supabase/client';

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ErrorReportContext {
  severity?: ErrorSeverity;
  appVersion?: string;
  browser?: string;
  os?: string;
  screenWidth?: number;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface ErrorReport {
  system: string;
  errorType: string;
  errorMessage?: string;
  context?: ErrorReportContext;
}

/**
 * Report an error to the system_errors table
 */
export async function reportError(report: ErrorReport): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    
    // Enrich context with browser/environment info
    const enrichedContext: ErrorReportContext = {
      ...report.context,
      appVersion: report.context?.appVersion || new Date().toISOString(),
      browser: report.context?.browser || navigator.userAgent,
      os: report.context?.os || getOperatingSystem(),
      screenWidth: report.context?.screenWidth || window.screen.width,
      url: report.context?.url || window.location.href,
      userAgent: report.context?.userAgent || navigator.userAgent,
      timestamp: report.context?.timestamp || new Date().toISOString(),
    };

    const { error } = await supabase.from('system_errors').insert({
      user_id: userData.user?.id || null,
      system: report.system,
      error_type: report.errorType,
      error_message: report.errorMessage || null,
      context: enrichedContext,
    });

    if (error) {
      console.error('Failed to report error to database:', error);
      return { success: false, error };
    }

    console.log('Error report submitted successfully');
    return { success: true };
  } catch (err) {
    console.error('Exception while reporting error:', err);
    return { success: false, error: err };
  }
}

/**
 * Get operating system from user agent
 */
function getOperatingSystem(): string {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Win')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  
  return 'Unknown';
}

/**
 * Report a bug from user input
 */
export async function reportBug(
  description: string,
  severity: ErrorSeverity = 'MEDIUM',
  additionalContext?: Record<string, any>
): Promise<{ success: boolean; error?: any }> {
  return reportError({
    system: 'user_report',
    errorType: 'bug',
    errorMessage: description,
    context: {
      severity,
      ...additionalContext,
    },
  });
}

/**
 * Report an unhandled exception
 */
export async function reportException(
  error: Error,
  context?: Record<string, any>
): Promise<{ success: boolean; error?: any }> {
  return reportError({
    system: 'exception_handler',
    errorType: error.name || 'Error',
    errorMessage: error.message,
    context: {
      severity: 'HIGH',
      stack: error.stack,
      ...context,
    },
  });
}
