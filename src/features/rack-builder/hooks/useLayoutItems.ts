import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import type { DeviceFacing, LayoutItemWithDevice } from '../types'
import { useConnectors } from './useConnectors'
import { isWithinBounds } from '../lib/overlap'

function isLayoutItemStartUConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : ''
  const details = 'details' in error && typeof error.details === 'string' ? error.details.toLowerCase() : ''
  const text = `${message} ${details}`
  const mentionsLayoutItems = text.includes('layout_items')
  const mentionsStartU = text.includes('start_u') || text.includes('start-u')
  return (code === '23505' || code === '23P01') && (mentionsLayoutItems || mentionsStartU)
}

function layoutSemanticErrorPrefix(message: string): 'RB_BOUNDS' | 'RB_SLOT' | 'RB_DEPTH' | null {
  if (message.startsWith('RB_BOUNDS:')) return 'RB_BOUNDS'
  if (message.startsWith('RB_SLOT:')) return 'RB_SLOT'
  if (message.startsWith('RB_DEPTH:')) return 'RB_DEPTH'
  return null
}

function toPlacementError(error: unknown): Error {
  if (error && typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
    const prefix = layoutSemanticErrorPrefix(message)
    if (prefix) return new Error(message)
  }
  if (isLayoutItemStartUConstraintError(error)) {
    return new Error('Backend placement rule rejected this position.')
  }
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : null
    if (message) return new Error(message)
  }
  return new Error('Unknown layout placement error.')
}

export function useLayoutItems(layoutId: string | undefined, totalRackUnits: number) {
  const { connectorById } = useConnectors()
  const [items, setItems] = useState<LayoutItemWithDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!layoutId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_layout_items')
      .select(LAYOUT_ITEM_SELECT)
      .eq('layout_id', layoutId)

    if (err) {
      setError(err.message)
    } else {
      const rows = (data ?? []) as unknown as LayoutItemRow[]
      setItems(mapLayoutItemRows(rows, connectorById))
      setError(null)
    }
    setLoading(false)
  }, [connectorById, layoutId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchItems()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchItems])

  const insertLayoutItem = async (
    startU: number,
    facing: DeviceFacing,
    rackUnits: number,
    ids: { device_id: string | null; panel_layout_id: string | null },
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => {
    if (!layoutId) throw new Error('Missing layout id')

    if (!isWithinBounds(startU, rackUnits, totalRackUnits)) {
      throw new Error('Item exceeds rack bounds')
    }

    const payload = {
      layout_id: layoutId,
      ...ids,
      start_u: startU,
      facing,
      preferred_lane: preferredLane ?? null,
      preferred_sub_lane: preferredSubLane ?? null,
    }
    const { data, error: err } = await supabase
      .from('rack_builder_layout_items')
      .insert(payload)
      .select('id')
      .single()

    if (err) throw toPlacementError(err)
    const createdId = (data as { id: string }).id
    await fetchItems()
    return createdId
  }

  const addItem = async (
    deviceId: string,
    startU: number,
    facing: DeviceFacing,
    deviceRackUnits: number,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) =>
    insertLayoutItem(startU, facing, deviceRackUnits, { device_id: deviceId, panel_layout_id: null }, preferredLane, preferredSubLane)

  const addPanelLayoutItem = async (
    panelLayoutId: string,
    startU: number,
    facing: DeviceFacing,
    panelRackUnits: number,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) =>
    insertLayoutItem(startU, facing, panelRackUnits, { device_id: null, panel_layout_id: panelLayoutId }, preferredLane, preferredSubLane)

  const removeItem = async (itemId: string) => {
    const { error: err } = await supabase.from('rack_builder_layout_items').delete().eq('id', itemId)
    if (err) throw toPlacementError(err)
    await fetchItems()
  }

  const moveItem = async (
    itemId: string,
    newStartU: number,
    facing: DeviceFacing,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    if (!isWithinBounds(newStartU, item.device.rack_units, totalRackUnits)) {
      throw new Error('Device exceeds rack bounds')
    }

    const { error: err } = await supabase
      .from('rack_builder_layout_items')
      .update({
        start_u: newStartU,
        facing,
        preferred_lane: preferredLane ?? null,
        preferred_sub_lane: preferredSubLane ?? null,
      })
      .eq('id', itemId)

    if (err) throw toPlacementError(err)
    await fetchItems()
  }

  const updateItemDetails = async (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => {
    const { error: err } = await supabase
      .from('rack_builder_layout_items')
      .update(updates)
      .eq('id', itemId)

    if (err) throw err
    await fetchItems()
  }

  return {
    items,
    loading,
    error,
    addItem,
    addPanelLayoutItem,
    removeItem,
    moveItem,
    updateItemDetails,
    refetch: fetchItems,
  }
}
