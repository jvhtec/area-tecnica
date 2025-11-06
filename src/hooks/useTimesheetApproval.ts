import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTimesheetApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (timesheetId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('timesheets')
        .update({
          approved_by_manager: true,
          approved_by: user.user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', timesheetId)
        .select()
        .single();

      if (error) throw error;

      // Recalculate the timesheet after approval
      await supabase.rpc('compute_timesheet_amount_2025', {
        _timesheet_id: timesheetId,
        _persist: true
      });

      // Send push notification to technician (fire-and-forget, non-blocking)
      if (data?.job_id && data?.technician_id) {
        try {
          void supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'timesheet.approved',
              job_id: data.job_id,
              recipient_id: data.technician_id,
              technician_id: data.technician_id
            }
          });
        } catch (pushErr) {
          // Non-blocking: log but don't fail the approval
          console.warn('Failed to send timesheet approval notification:', pushErr);
        }
      }

      return data;
    },
    onSuccess: (_data, timesheetId) => {
      queryClient.invalidateQueries({ queryKey: ['timesheet', timesheetId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet approved and rates calculated');
    },
    onError: (error) => {
      toast.error('Failed to approve timesheet: ' + error.message);
    }
  });
}