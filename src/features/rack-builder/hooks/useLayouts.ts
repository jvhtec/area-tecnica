import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { DrawingState, Layout } from '../types'

export function useLayouts(projectId?: string) {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLayouts = useCallback(async (targetProjectId?: string) => {
    const resolvedProjectId = targetProjectId ?? projectId
    if (!resolvedProjectId) {
      setLayouts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_layouts')
      .select('*')
      .eq('project_id', resolvedProjectId)
      .order('created_at', { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setLayouts((data as Layout[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchLayouts(projectId)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchLayouts, projectId])

  const createLayout = async (layout: { project_id?: string; rack_id: string; name: string; drawing_state: DrawingState }) => {
    const resolvedProjectId = layout.project_id ?? projectId
    if (!resolvedProjectId) throw new Error('Missing project id')

    const { data, error: err } = await supabase
      .from('rack_builder_layouts')
      .insert({ ...layout, project_id: resolvedProjectId })
      .select()
      .single()
    if (err) throw err
    await fetchLayouts(resolvedProjectId)
    return data as Layout
  }

  const updateLayout = async (
    id: string,
    updates: Partial<{ name: string; rack_id: string; project_id: string; drawing_state: DrawingState }>,
  ) => {
    const { error: err } = await supabase
      .from('rack_builder_layouts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    await fetchLayouts(updates.project_id ?? projectId)
  }

  const deleteLayout = async (id: string) => {
    const { error: err } = await supabase.from('rack_builder_layouts').delete().eq('id', id)
    if (err) throw err
    await fetchLayouts(projectId)
  }

  return { layouts, loading, error, createLayout, updateLayout, deleteLayout, refetch: fetchLayouts }
}
