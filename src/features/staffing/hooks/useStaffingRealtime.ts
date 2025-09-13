import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function useStaffingRealtime() {
  const qc = useQueryClient()
  
  useEffect(() => {
    const ch = supabase.channel('staffing-requests')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'staffing_requests' 
      }, (payload) => {
        console.log('Staffing realtime update:', payload)
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
      })
      .subscribe()
      
    return () => { 
      supabase.removeChannel(ch) 
    }
  }, [qc])
}