import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function usePanelLayoutCounts() {
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('rack_builder_panel_layouts')
        .select('project_id')

      if (!active) return

      if (error || !data) {
        setLoading(false)
        return
      }

      const map = new Map<string, number>()
      for (const row of data) {
        map.set(row.project_id, (map.get(row.project_id) ?? 0) + 1)
      }
      setCounts(map)
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [])

  return { counts, loading }
}
