import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRecalcTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (timesheetId: string) => {
      const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      if (!base) throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not set')
      const url = `${base}/recalc-timesheet-amount`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheet_id: timesheetId })
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: (_data, timesheetId) => {
      qc.invalidateQueries({ queryKey: ['timesheet', timesheetId] })
      qc.invalidateQueries({ queryKey: ['timesheets'] })
    }
  })
}

