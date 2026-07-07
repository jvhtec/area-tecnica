import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { mapPanelLayoutPort, type PanelLayoutPortRecord } from '../lib/panelLayoutMapper'
import type { PanelLayoutPort } from '../types'

export function usePanelLayoutPorts(panelLayoutId: string | undefined) {
  const [ports, setPorts] = useState<PanelLayoutPort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchPorts = useCallback(async () => {
    if (!panelLayoutId) {
      setPorts([])
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_panel_layout_ports')
      .select('*')
      .eq('panel_layout_id', panelLayoutId)
      .order('created_at', { ascending: true })
    if (requestId !== requestIdRef.current) return
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setPorts(((data ?? []) as PanelLayoutPortRecord[]).map(mapPanelLayoutPort))
    setError(null)
    setLoading(false)
  }, [panelLayoutId])

  useEffect(() => {
    const ref = requestIdRef
    const timeoutId = window.setTimeout(() => {
      void fetchPorts()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
      ref.current++
    }
  }, [fetchPorts])

  return { ports, loading, error, refetch: fetchPorts }
}
