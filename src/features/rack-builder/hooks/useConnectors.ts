import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { ConnectorCategory, ConnectorDefinition, ConnectorMounting } from '../types'

export const CONNECTOR_CATEGORY_ORDER: ConnectorCategory[] = ['audio', 'data', 'power', 'multipin', 'other']

function normalizeConnector(connector: ConnectorDefinition): ConnectorDefinition {
  return {
    ...connector,
    id: connector.id.trim(),
    name: connector.name.trim(),
    is_d_size: connector.is_d_size === true,
    notes: connector.notes?.trim() ?? '',
    grid_width: Math.max(1, Math.round(connector.grid_width)),
    grid_height: Math.max(1, Math.round(connector.grid_height)),
    weight_kg: Number.isFinite(connector.weight_kg) ? Math.max(0, connector.weight_kg) : 0,
  }
}

function sanitizeConnectorInput(input: {
  id: string
  name: string
  category: ConnectorCategory
  image_path: string
  is_d_size: boolean
  grid_width: number
  grid_height: number
  mounting: ConnectorMounting
  notes: string
  weight_kg: number
}) {
  const normalized = normalizeConnector(input)
  if (!normalized.id) throw new Error('Connector id is required')
  if (!normalized.name) throw new Error('Connector name is required')
  if (!normalized.image_path?.trim()) throw new Error('Connector image is required')
  return normalized
}

export function useConnectors() {
  const [connectors, setConnectors] = useState<ConnectorDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConnectors = useCallback(async () => {
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('rack_builder_connectors')
      .select('*')
      .order('name', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    const mapped = ((data ?? []) as ConnectorDefinition[]).map(normalizeConnector)
    setConnectors(mapped)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchConnectors()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchConnectors])

  const createConnector = async (input: {
    id: string
    name: string
    category: ConnectorCategory
    image_path: string
    is_d_size: boolean
    grid_width: number
    grid_height: number
    mounting: ConnectorMounting
    notes: string
    weight_kg: number
  }) => {
    const payload = sanitizeConnectorInput(input)
    const { error: insertError } = await supabase.from('rack_builder_connectors').insert(payload)
    if (insertError) throw insertError
    await fetchConnectors()
  }

  const updateConnector = async (
    id: string,
    updates: Partial<{
      name: string
      category: ConnectorCategory
      image_path: string
      is_d_size: boolean
      grid_width: number
      grid_height: number
      mounting: ConnectorMounting
      notes: string
      weight_kg: number
    }>,
  ) => {
    const safeUpdates = {
      ...updates,
      is_d_size: updates.is_d_size == null ? undefined : updates.is_d_size === true,
      grid_width: updates.grid_width == null ? undefined : Math.max(1, Math.round(updates.grid_width)),
      grid_height: updates.grid_height == null ? undefined : Math.max(1, Math.round(updates.grid_height)),
      weight_kg: updates.weight_kg == null ? undefined : Math.max(0, updates.weight_kg),
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('rack_builder_connectors')
      .update(safeUpdates)
      .eq('id', id)

    if (updateError) throw updateError
    await fetchConnectors()
  }

  const deleteConnector = async (id: string) => {
    const { count, error: usageError } = await supabase
      .from('rack_builder_panel_layout_ports')
      .select('id', { head: true, count: 'exact' })
      .eq('connector_id', id)

    if (usageError) throw usageError
    if ((count ?? 0) > 0) {
      throw new Error('Connector is currently used in one or more panel layouts.')
    }

    const { error: deleteError } = await supabase
      .from('rack_builder_connectors')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    await fetchConnectors()
  }

  const connectorById = useMemo(() => new Map(connectors.map((connector) => [connector.id, connector])), [connectors])

  const grouped = useMemo(
    () => CONNECTOR_CATEGORY_ORDER
      .map((category) => ({
        category,
        items: connectors.filter((item) => item.category === category),
      }))
      .filter((entry) => entry.items.length > 0),
    [connectors],
  )

  return {
    connectors,
    connectorById,
    grouped,
    loading,
    error,
    createConnector,
    updateConnector,
    deleteConnector,
    refetch: fetchConnectors,
  }
}
