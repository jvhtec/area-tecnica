import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import { mapPanelLayout, type PanelLayoutRecord } from '../lib/panelLayoutMapper'
import type { ConnectorDefinition, Layout, LayoutItemWithDevice, PanelLayout, Project, Rack } from '../types'

export interface PrintLayoutModel {
  layout: Layout
  rack: Rack
  items: LayoutItemWithDevice[]
  totalWeightKg: number
  totalPowerW: number
}

export function useProjectPrintData(projectId: string | undefined, connectorById: Map<string, ConnectorDefinition>) {
  const [project, setProject] = useState<Project | null>(null)
  const [layoutModels, setLayoutModels] = useState<PrintLayoutModel[]>([])
  const [panelModels, setPanelModels] = useState<PanelLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!projectId) {
      setError('Missing project id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setLayoutModels([])
    setPanelModels([])

    const { data: projectData, error: projectError } = await supabase
      .from('rack_builder_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !projectData) {
      setError('Project not found')
      setLoading(false)
      return
    }
    setProject(projectData as Project)

    const { data: layoutData, error: layoutError } = await supabase
      .from('rack_builder_layouts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (layoutError) {
      setError(layoutError.message)
      setLoading(false)
      return
    }

    const typedLayouts = (layoutData as Layout[]) ?? []

    const models: PrintLayoutModel[] = []
    if (typedLayouts.length > 0) {
      const rackIds = Array.from(new Set(typedLayouts.map((layout) => layout.rack_id)))
      const { data: rackData, error: rackError } = await supabase
        .from('rack_builder_racks')
        .select('*')
        .in('id', rackIds)

      if (rackError) {
        setError(rackError.message)
        setLoading(false)
        return
      }

      const rackMap = new Map(((rackData as Rack[]) ?? []).map((rack) => [rack.id, rack]))

      const layoutIds = typedLayouts.map((layout) => layout.id)
      const { data: itemData, error: itemError } = await supabase
        .from('rack_builder_layout_items')
        .select(LAYOUT_ITEM_SELECT)
        .in('layout_id', layoutIds)

      if (itemError) {
        setError(itemError.message)
        setLoading(false)
        return
      }

      const rows = (itemData ?? []) as unknown as LayoutItemRow[]
      const mappedItems: LayoutItemWithDevice[] = mapLayoutItemRows(rows, connectorById)

      const itemsByLayout = mappedItems.reduce<Map<string, LayoutItemWithDevice[]>>((acc, item) => {
        const existing = acc.get(item.layout_id) ?? []
        existing.push(item)
        acc.set(item.layout_id, existing)
        return acc
      }, new Map())

      for (const layout of typedLayouts) {
        const rack = rackMap.get(layout.rack_id)
        if (!rack) continue
        const items = itemsByLayout.get(layout.id) ?? []
        const totals = items.reduce(
          (acc, item) => ({
            totalWeightKg: acc.totalWeightKg + item.device.weight_kg,
            totalPowerW: acc.totalPowerW + item.device.power_w,
          }),
          { totalWeightKg: 0, totalPowerW: 0 },
        )
        models.push({
          layout,
          rack,
          items,
          totalWeightKg: totals.totalWeightKg,
          totalPowerW: totals.totalPowerW,
        })
      }
    }

    const { data: panelData, error: panelError } = await supabase
      .from('rack_builder_panel_layouts')
      .select('*, rows:rack_builder_panel_layout_rows(*), ports:rack_builder_panel_layout_ports(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (panelError) {
      setError(panelError.message)
      setLoading(false)
      return
    }

    setLayoutModels(models)
    setPanelModels(((panelData ?? []) as unknown as PanelLayoutRecord[]).map(mapPanelLayout))
    setLoading(false)
  }, [connectorById, projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return { project, layoutModels, panelModels, loading, error }
}
