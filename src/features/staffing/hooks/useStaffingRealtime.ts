import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function useStaffingRealtime() {
  const qc = useQueryClient()
  
  useEffect(() => {
    // Listen to both staffing_requests and assignment_matrix_staffing tables
    const staffingRequestsChannel = supabase.channel('staffing-requests')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'staffing_requests' 
      }, (payload) => {
        console.log('Staffing requests realtime update:', payload)
        handleStaffingUpdate(payload)
      })
      .subscribe()

    const matrixStaffingChannel = supabase.channel('assignment-matrix-staffing')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'assignment_matrix_staffing' 
      }, (payload) => {
        console.log('Assignment matrix staffing realtime update:', payload)
        handleStaffingUpdate(payload)
      })
      .subscribe()

    function handleStaffingUpdate(payload: any) {
      // Invalidate specific staffing queries
      const record = payload.new || payload.old
      if (record && typeof record === 'object' && 'job_id' in record && 'profile_id' in record) {
        qc.invalidateQueries({ 
          queryKey: ['staffing', record.job_id, record.profile_id] 
        })
      }
      // Invalidate broader matrix queries
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
    }
      
    return () => { 
      supabase.removeChannel(staffingRequestsChannel)
      supabase.removeChannel(matrixStaffingChannel)
    }
  }, [qc])
}