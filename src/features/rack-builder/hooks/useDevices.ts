import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Device, DeviceCategory } from '../types'

interface DeviceRow {
  id: string
  brand: string
  model: string
  rack_units: number
  depth_mm: number
  weight_kg: number
  power_w: number
  is_half_rack?: boolean
  category_id: string
  fav: boolean
  invert_image_in_dark_mode?: boolean
  front_image_path: string | null
  rear_image_path: string | null
  created_at: string
  updated_at: string
  category?: Record<string, unknown> | null
}

export type DeviceSortKey =
  | 'category'
  | 'brand'
  | 'model'
  | 'rack_units'
  | 'depth_mm'
  | 'weight_kg'
  | 'power_w'
export type SortDirection = 'asc' | 'desc'

export interface DeviceSortOption {
  key: DeviceSortKey
  direction: SortDirection
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function compareNumber(a: number, b: number): number {
  return a - b
}

function compareDevice(a: Device, b: Device, key: DeviceSortKey): number {
  if (key === 'category') return compareText(a.category?.name ?? '', b.category?.name ?? '')
  if (key === 'brand') return compareText(a.brand, b.brand)
  if (key === 'model') return compareText(a.model, b.model)
  if (key === 'rack_units') return compareNumber(a.rack_units, b.rack_units)
  if (key === 'weight_kg') return compareNumber(a.weight_kg, b.weight_kg)
  if (key === 'power_w') return compareNumber(a.power_w, b.power_w)
  return compareNumber(a.depth_mm, b.depth_mm)
}

function mapDeviceRow(row: DeviceRow): Device {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    rack_units: row.rack_units,
    depth_mm: row.depth_mm,
    weight_kg: row.weight_kg,
    power_w: row.power_w,
    is_half_rack: row.is_half_rack === true,
    category_id: row.category_id,
    fav: row.fav === true,
    invert_image_in_dark_mode: row.invert_image_in_dark_mode === true,
    front_image_path: row.front_image_path,
    rear_image_path: row.rear_image_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: (row.category as unknown as DeviceCategory | null) ?? null,
  }
}

export function sortDevices(devices: Device[], options: DeviceSortOption[]): Device[] {
  return [...devices].sort((a, b) => {
    for (const option of options) {
      const result = compareDevice(a, b, option.key)
      if (result !== 0) {
        return option.direction === 'desc' ? -result : result
      }
    }
    return compareText(a.id, b.id)
  })
}

export function filterDevicesByCategory(devices: Device[], categoryId: string): Device[] {
  if (categoryId === 'all') return devices
  if (categoryId === 'favorites') return devices.filter((device) => device.fav)
  return devices.filter((device) => device.category_id === categoryId)
}

export const ALL_BRAND = '__all__'

export function filterDevicesByBrand(devices: Device[], brand: string): Device[] {
  if (brand === ALL_BRAND) return devices
  return devices.filter((device) => device.brand === brand)
}

export function filterDevicesBySearch(devices: Device[], query: string): Device[] {
  const q = query.trim().toLowerCase()
  if (!q) return devices
  return devices.filter(
    (device) =>
      device.brand.toLowerCase().includes(q) ||
      device.model.toLowerCase().includes(q) ||
      (device.category?.name ?? '').toLowerCase().includes(q),
  )
}

export async function listCategories(): Promise<DeviceCategory[]> {
  const { data, error } = await supabase
    .from('rack_builder_device_categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return (data as DeviceCategory[]) ?? []
}

export async function createCategory(name: string): Promise<DeviceCategory> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Category name is required')

  const { data, error } = await supabase
    .from('rack_builder_device_categories')
    .insert({ name: trimmedName })
    .select()
    .single()

  if (error) throw error
  return data as DeviceCategory
}

export async function ensureCategoryByName(name: string): Promise<DeviceCategory> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Category name is required')

  const { data: existing, error: queryError } = await supabase
    .from('rack_builder_device_categories')
    .select('*')
    .ilike('name', trimmedName)
    .limit(1)
    .maybeSingle()

  if (queryError) throw queryError
  if (existing) return existing as DeviceCategory

  try {
    return await createCategory(trimmedName)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== '23505') throw error

    const { data: raceExisting, error: raceQueryError } = await supabase
      .from('rack_builder_device_categories')
      .select('*')
      .ilike('name', trimmedName)
      .limit(1)
      .single()

    if (raceQueryError) throw raceQueryError
    return raceExisting as DeviceCategory
  }
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [categories, setCategories] = useState<DeviceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    setLoading(true)

    const [{ data: deviceData, error: deviceError }, { data: categoryData, error: categoryError }] = await Promise.all([
      supabase
        .from('rack_builder_devices')
        .select('*, category:rack_builder_device_categories(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('rack_builder_device_categories')
        .select('*')
        .order('name', { ascending: true }),
    ])

    if (deviceError) {
      setError(deviceError.message)
      setLoading(false)
      return
    }

    if (categoryError) {
      setError(categoryError.message)
      setLoading(false)
      return
    }

    const rows = (deviceData ?? []) as DeviceRow[]
    setDevices(rows.map(mapDeviceRow))
    setCategories((categoryData as DeviceCategory[]) ?? [])
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDevices()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchDevices])

  const createDevice = async (device: {
    brand: string
    model: string
    rack_units: number
    depth_mm: number
    weight_kg: number
    power_w: number
    is_half_rack?: boolean
    category_id: string
    fav?: boolean
    invert_image_in_dark_mode?: boolean
    front_image_path?: string | null
    rear_image_path?: string | null
  }) => {
    const { error: err } = await supabase.from('rack_builder_devices').insert(device)
    if (err) throw err
    await fetchDevices()
  }

  const updateDevice = async (
    id: string,
    updates: Partial<{
      brand: string
      model: string
      rack_units: number
      depth_mm: number
      weight_kg: number
      power_w: number
      is_half_rack: boolean
      category_id: string
      fav: boolean
      invert_image_in_dark_mode: boolean
      front_image_path: string | null
      rear_image_path: string | null
    }>,
  ) => {
    const { data, error: err } = await supabase
      .from('rack_builder_devices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, category:rack_builder_device_categories(*)')
      .single()
    if (err) throw err

    const updatedDevice = mapDeviceRow(data as DeviceRow)
    setDevices((previous) => previous.map((device) => (device.id === id ? updatedDevice : device)))
  }

  const deleteDevice = async (id: string) => {
    const { error: err } = await supabase.from('rack_builder_devices').delete().eq('id', id)
    if (err) throw err
    await fetchDevices()
  }

  return {
    devices,
    categories,
    loading,
    error,
    createDevice,
    updateDevice,
    deleteDevice,
    refetch: fetchDevices,
  }
}

export function getDeviceImageUrl(path: string | null, bucket = 'rack-builder-device-images'): string | null {
  if (!path) return null
  if (path.startsWith('data:')) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/')) {
    const base = import.meta.env.BASE_URL || '/'
    const normalizedPath = path.slice(1)
    return `${base}${normalizedPath}`
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
