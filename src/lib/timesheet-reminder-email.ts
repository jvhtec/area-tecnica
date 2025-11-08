import { supabase } from '@/integrations/supabase/client';

export interface SendTimesheetReminderResult {
  success: boolean;
  messageId?: string;
  sentTo?: string;
  error?: string;
}

/**
 * Sends a reminder email to a technician to complete their pending timesheet
 * Only callable by admin and management roles
 *
 * @param timesheetId - The ID of the timesheet to send a reminder for
 * @returns Result object with success status and details
 */
export async function sendTimesheetReminder(
  timesheetId: string
): Promise<SendTimesheetReminderResult> {
  try {
    // Ensure user is authenticated before calling the function
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('No active session:', sessionError);
      return {
        success: false,
        error: 'You must be logged in to send reminder emails',
      };
    }

    // Call the edge function - Supabase client handles authentication automatically
    const { data, error } = await supabase.functions.invoke('send-timesheet-reminder', {
      body: { timesheetId },
    });

    if (error) {
      console.error('Error invoking send-timesheet-reminder function:', {
        error,
        status: error.status,
        message: error.message,
      });
      return {
        success: false,
        error: error.message || 'Failed to send reminder email',
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to send reminder email',
      };
    }

    return {
      success: true,
      messageId: data.messageId,
      sentTo: data.sentTo,
    };
  } catch (err) {
    console.error('Unexpected error sending timesheet reminder:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}
