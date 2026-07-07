import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import type { ConnectorDefinition, Layout, LayoutItemWithDevice, Project, Rack } from '../types'

export function useLayoutPrintData(
  projectId: string | undefined,
  layoutId: string | undefined,
  connectorById: Map<string, ConnectorDefinition>,
) {
  const [layout, setLayout] = useState<Layout | null>(null)
  const [rack, setRack] = useState<Rack | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<LayoutItemWithDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!layoutId || !projectId) {
      setError('Missing project or layout id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: layoutData, error: layoutError } = await supabase
      .from('rack_builder_layouts')
      .select('*')
      .eq('id', layoutId)
      .eq('project_id', projectId)
      .single()

    if (layoutError) {
      setError('Layout not found in project')
      setLoading(false)
      return
    }

    const typedLayout = layoutData as Layout
    setLayout(typedLayout)

    const { data: projectData } = await supabase
      .from('rack_builder_projects')
      .select('*')
      .eq('id', projectId)
      .single()
    setProject((projectData as Project) ?? null)

    const { data: rackData, error: rackError } = await supabase
      .from('rack_builder_racks')
      .select('*')
      .eq('id', typedLayout.rack_id)
      .single()

    if (rackError) {
      setError('Rack not found')
      setLoading(false)
      return
    }

    const { data: itemData, error: itemError } = await supabase
      .from('rack_builder_layout_items')
      .select(LAYOUT_ITEM_SELECT)
      .eq('layout_id', layoutId)

    if (itemError) {
      setError(itemError.message)
      setLoading(false)
      return
    }

    const rows = (itemData ?? []) as unknown as LayoutItemRow[]
    const mapped: LayoutItemWithDevice[] = mapLayoutItemRows(rows, connectorById)

    setRack(rackData as Rack)
    setItems(mapped)
    setLoading(false)
  }, [connectorById, layoutId, projectId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadData])

  return { layout, rack, project, items, loading, error }
}
