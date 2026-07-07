import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Rack } from '../types'

export function useRacks() {
  const [racks, setRacks] = useState<Rack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRacks = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_racks')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      const mapped = ((data as Rack[]) ?? []).map((rack) => ({
        ...rack,
        rack_units: Number(rack.rack_units),
        depth_mm: Number(rack.depth_mm),
      }))
      setRacks(mapped)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchRacks()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchRacks])

  const createRack = async (rack: {
    name: string
    rack_units: number
    depth_mm: number
    width: 'single' | 'dual'
  }) => {
    const { error: err } = await supabase.from('rack_builder_racks').insert(rack as never)
    if (err) throw err
    await fetchRacks()
  }

  const updateRack = async (
    id: string,
    updates: Partial<{
      name: string
      rack_units: number
      depth_mm: number
      width: 'single' | 'dual'
    }>,
  ) => {
    const { error: err } = await supabase
      .from('rack_builder_racks')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
    if (err) throw err
    await fetchRacks()
  }

  const deleteRack = async (id: string) => {
    const { error: err } = await supabase.from('rack_builder_racks').delete().eq('id', id)
    if (err) throw err
    await fetchRacks()
  }

  return { racks, loading, error, createRack, updateRack, deleteRack, refetch: fetchRacks }
}
