
import { supabase } from "@/lib/supabase";

export interface SecurityAuditLog {
  user_id: string;
  action: string;
  resource: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Logs security-related events for audit purposes
 */
export async function logSecurityEvent(event: SecurityAuditLog): Promise<void> {
  try {
    console.log("Security audit log:", event);
    
    // In a production environment, you would store these logs in a secure audit table
    // For now, we'll just log to console and could extend to send to external security service
    
    const auditEntry = {
      ...event,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
    };

    // TODO: Implement secure audit log storage
    // This could be stored in a separate audit database or sent to a SIEM system
    console.warn(`[SECURITY AUDIT] ${event.severity.toUpperCase()}: ${event.action} on ${event.resource} by user ${event.user_id}`);
    
  } catch (error) {
    console.error("Failed to log security event:", error);
    // Don't throw error to avoid breaking the main application flow
  }
}

/**
 * Logs API key usage attempts
 */
export async function logApiKeyUsage(userId: string, endpoint: string, success: boolean): Promise<void> {
  await logSecurityEvent({
    user_id: userId,
    action: 'api_key_usage',
    resource: `flex_api${endpoint}`,
    metadata: { success, endpoint },
    severity: success ? 'low' : 'medium'
  });
}

/**
 * Logs authentication events
 */
export async function logAuthEvent(userId: string, action: string, success: boolean): Promise<void> {
  await logSecurityEvent({
    user_id: userId,
    action: `auth_${action}`,
    resource: 'authentication',
    metadata: { success },
    severity: success ? 'low' : 'high'
  });
}

/**
 * Logs suspicious activity
 */
export async function logSuspiciousActivity(userId: string, activity: string, metadata?: Record<string, any>): Promise<void> {
  await logSecurityEvent({
    user_id: userId,
    action: 'suspicious_activity',
    resource: 'system',
    metadata,
    severity: 'critical'
  });
}
