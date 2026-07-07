import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { HoleCount } from '../lib/panelGrid'
import { mapPanelLayout, type PanelLayoutRecord } from '../lib/panelLayoutMapper'
import type { DeviceFacing, DrawingState, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'

export function usePanelLayouts(projectId: string | undefined) {
  const [panelLayouts, setPanelLayouts] = useState<PanelLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchPanelLayouts = useCallback(async () => {
    if (!projectId) {
      setPanelLayouts([])
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_panel_layouts')
      .select('*, rows:rack_builder_panel_layout_rows(*), ports:rack_builder_panel_layout_ports(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (requestId !== requestIdRef.current) return

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const mapped = ((data ?? []) as unknown as PanelLayoutRecord[]).map(mapPanelLayout)
    setPanelLayouts(mapped)
    setError(null)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    const ref = requestIdRef
    const timeoutId = window.setTimeout(() => {
      void fetchPanelLayouts()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      ref.current++
    }
  }, [fetchPanelLayouts])

  const createPanelLayout = async (payload: {
    name: string
    height_ru: number
    drawing_state: DrawingState
    facing: DeviceFacing
    has_lacing_bar: boolean
    notes?: string | null
    weight_kg?: number
    default_hole_count?: HoleCount
  }) => {
    if (!projectId) throw new Error('Missing project id')
    const safeHeight = Math.max(1, Math.min(6, Math.round(payload.height_ru)))
    const holeCount = payload.default_hole_count ?? 16

    const { data, error: rpcError } = await supabase.rpc('rack_builder_rpc_create_panel_layout', {
      p_project_id: projectId,
      p_name: payload.name.trim(),
      p_drawing_state: payload.drawing_state,
      p_height_ru: safeHeight,
      p_facing: payload.facing,
      p_has_lacing_bar: payload.has_lacing_bar,
      p_notes: payload.notes ?? null,
      p_weight_kg: payload.weight_kg ?? 0,
      p_default_hole_count: holeCount,
    })

    if (rpcError) throw rpcError
    const newId = data as string

    await fetchPanelLayouts()
    return newId
  }

  const updatePanelLayout = async (
    id: string,
    updates: Partial<Pick<PanelLayout, 'name' | 'drawing_state' | 'facing' | 'has_lacing_bar' | 'notes' | 'weight_kg'>>,
  ) => {
    const { error: updateError } = await supabase
      .from('rack_builder_panel_layouts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (updateError) throw updateError
    await fetchPanelLayouts()
  }

  const savePanelLayout = async (
    id: string,
    meta: { name: string; drawing_state: DrawingState; facing: DeviceFacing; has_lacing_bar: boolean; notes: string | null },
    rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>,
    ports: Array<Pick<PanelLayoutPort, 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label' | 'color'>>,
  ) => {
    const { error: rpcError } = await supabase.rpc('rack_builder_rpc_save_panel_layout', {
      p_id: id,
      p_name: meta.name,
      p_drawing_state: meta.drawing_state,
      p_facing: meta.facing,
      p_has_lacing_bar: meta.has_lacing_bar,
      p_notes: meta.notes,
      p_rows: rows.map((row) => ({
        row_index: row.row_index,
        hole_count: row.hole_count,
        active_column_map: row.active_column_map,
      })),
      p_ports: ports.map((port) => ({
        connector_id: port.connector_id,
        row_index: port.row_index,
        hole_index: port.hole_index,
        span_w: port.span_w,
        span_h: port.span_h,
        label: port.label ?? null,
        color: port.color ?? null,
      })),
    })
    if (rpcError) throw rpcError
    await fetchPanelLayouts()
  }

  const replaceRows = async (
    panelLayoutId: string,
    rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>,
  ) => {
    const { error: rpcError } = await supabase.rpc('rack_builder_rpc_replace_panel_layout_rows', {
      p_panel_layout_id: panelLayoutId,
      p_rows: rows.map((row) => ({
        row_index: row.row_index,
        hole_count: row.hole_count,
        active_column_map: row.active_column_map,
      })),
    })
    if (rpcError) throw rpcError

    await fetchPanelLayouts()
  }

  const replacePorts = async (
    panelLayoutId: string,
    ports: Array<Pick<PanelLayoutPort, 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label' | 'color'>>,
  ) => {
    const { error: rpcError } = await supabase.rpc('rack_builder_rpc_replace_panel_layout_ports', {
      p_panel_layout_id: panelLayoutId,
      p_ports: ports.map((port) => ({
        connector_id: port.connector_id,
        row_index: port.row_index,
        hole_index: port.hole_index,
        span_w: port.span_w,
        span_h: port.span_h,
        label: port.label ?? null,
        color: port.color ?? null,
      })),
    })
    if (rpcError) throw rpcError

    await fetchPanelLayouts()
  }

  const duplicatePanelLayout = async (layout: PanelLayout) => {
    if (!projectId) throw new Error('Missing project id')

    const { data, error: rpcError } = await supabase.rpc('rack_builder_rpc_duplicate_panel_layout', {
      p_source_id: layout.id,
      p_project_id: projectId,
      p_new_name: `${layout.name} Copy`,
    })

    if (rpcError) throw rpcError
    const newId = data as string

    await fetchPanelLayouts()
    return newId
  }

  const deletePanelLayout = async (id: string) => {
    const { count, error: usageError } = await supabase
      .from('rack_builder_layout_items')
      .select('id', { count: 'exact', head: true })
      .eq('panel_layout_id', id)
    if (usageError) throw usageError
    if ((count ?? 0) > 0) {
      throw new Error('Panel layout is currently used in one or more rack layouts.')
    }

    const { error: deleteError } = await supabase
      .from('rack_builder_panel_layouts')
      .delete()
      .eq('id', id)
    if (deleteError) throw deleteError

    await fetchPanelLayouts()
  }

  return {
    panelLayouts,
    loading,
    error,
    createPanelLayout,
    updatePanelLayout,
    savePanelLayout,
    replaceRows,
    replacePorts,
    duplicatePanelLayout,
    deletePanelLayout,
    refetch: fetchPanelLayouts,
  }
}
