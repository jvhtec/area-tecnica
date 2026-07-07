import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { normalizeActiveColumnMap, toHoleCount } from '../lib/panelGrid'
import type { PanelLayoutRow } from '../types'

interface PanelLayoutRowRecord {
  id: string
  panel_layout_id: string
  row_index: number
  hole_count: number
  active_column_map: unknown
  created_at: string
  updated_at: string
}

function mapRow(row: PanelLayoutRowRecord): PanelLayoutRow {
  const holeCount = toHoleCount(row.hole_count)
  return {
    id: row.id,
    panel_layout_id: row.panel_layout_id,
    row_index: row.row_index,
    hole_count: holeCount,
    active_column_map: normalizeActiveColumnMap(row.active_column_map, holeCount),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function usePanelLayoutRows(panelLayoutId: string | undefined) {
  const [rows, setRows] = useState<PanelLayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchRows = useCallback(async () => {
    if (!panelLayoutId) {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    const requestId = ++requestIdRef.current
    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_panel_layout_rows')
      .select('*')
      .eq('panel_layout_id', panelLayoutId)
      .order('row_index', { ascending: true })
    if (requestId !== requestIdRef.current) return
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setRows(((data ?? []) as PanelLayoutRowRecord[]).map(mapRow))
    setError(null)
    setLoading(false)
  }, [panelLayoutId])

  useEffect(() => {
    const ref = requestIdRef
    const timeoutId = window.setTimeout(() => {
      void fetchRows()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
      ref.current++
    }
  }, [fetchRows])

  return { rows, loading, error, refetch: fetchRows }
}
