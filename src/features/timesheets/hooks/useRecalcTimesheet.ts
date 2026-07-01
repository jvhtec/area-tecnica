import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

import { queryKeys } from "@/lib/react-query";
export function useRecalcTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (timesheetId: string) => {
      const { data, error } = await supabase.rpc('compute_timesheet_amount_2025', {
        _timesheet_id: timesheetId,
        _persist: true
      })

      if (error) throw error
      return data
    },
    onSuccess: (_data, timesheetId) => {
      qc.invalidateQueries({ queryKey: queryKeys.scope('timesheet', timesheetId) })
      qc.invalidateQueries({ queryKey: queryKeys.scope('timesheets') })
    }
  })
}
