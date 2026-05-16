import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { trackError } from '@/lib/errorTracking';


import { queryKeys } from "@/lib/react-query";
export function useRecalcTimesheet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (timesheetId: string) => {
      const { data, error } = await supabase.rpc('compute_timesheet_amount_2025', {
        _timesheet_id: timesheetId,
        _persist: true
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, timesheetId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('timesheet', timesheetId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('timesheets') });
    },
    onError: (error, timesheetId) => {
      void trackError(error, {
        system: 'timesheets',
        operation: 'compute_timesheet_amount_2025',
        timesheetId
      });
    }
  });
}