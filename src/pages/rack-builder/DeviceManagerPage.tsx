import { useMemo, useState } from 'react'
import { ALL_BRAND, ensureCategoryByName, filterDevicesByBrand, filterDevicesByCategory, filterDevicesBySearch, sortDevices, useDevices } from '@/features/rack-builder/hooks/useDevices'
import PageHeader from '@/features/rack-builder/components/layout/PageHeader'
import Button from '@/features/rack-builder/components/ui/Button'
import Modal from '@/features/rack-builder/components/ui/Modal'
import ConfirmDialog from '@/features/rack-builder/components/ui/ConfirmDialog'
import Select from '@/features/rack-builder/components/ui/Select'
import DeviceList from '@/features/rack-builder/components/devices/DeviceList'
import DeviceForm from '@/features/rack-builder/components/devices/DeviceForm'
import type { Device } from '@/features/rack-builder/types'

export default function DeviceManagerPage() {
  const { devices, categories, loading, createDevice, updateDevice, deleteDevice, refetch } = useDevices()
  const [formOpen, setFormOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | undefined>()
  const [deletingDevice, setDeletingDevice] = useState<Device | undefined>()
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState(ALL_BRAND)
  const [sortField, setSortField] = useState<
    'default' | 'brand' | 'model' | 'rack_units' | 'depth_mm' | 'weight_kg' | 'power_w'
  >('default')
  const [searchQuery, setSearchQuery] = useState('')

  const brands = useMemo(
    () => [...new Set(devices.map((d) => d.brand))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [devices],
  )

  // If the selected brand no longer exists in the data, fall back to "all"
  const effectiveBrand = selectedBrand !== ALL_BRAND && !brands.includes(selectedBrand) ? ALL_BRAND : selectedBrand

  const filteredDevices = useMemo(
    () => filterDevicesBySearch(filterDevicesByBrand(filterDevicesByCategory(devices, selectedCategoryId), effectiveBrand), searchQuery),
    [devices, selectedCategoryId, effectiveBrand, searchQuery],
  )

  const sortedDevices = useMemo(() => {
    if (sortField === 'default') {
      return sortDevices(filteredDevices, [
        { key: 'category', direction: 'asc' },
        { key: 'brand', direction: 'asc' },
        { key: 'model', direction: 'asc' },
      ])
    }

    return sortDevices(filteredDevices, [
      { key: sortField, direction: 'asc' },
      { key: 'brand', direction: 'asc' },
      { key: 'model', direction: 'asc' },
    ])
  }, [filteredDevices, sortField])

  const handleSubmit = async (data: {
    brand: string
    model: string
    rack_units: number
    depth_mm: number
    weight_kg: number
    power_w: number
    invert_image_in_dark_mode: boolean
    category_id: string
    front_image_path?: string | null
    rear_image_path?: string | null
    fav?: boolean
  }) => {
    if (editingDevice) {
      await updateDevice(editingDevice.id, data)
    } else {
      await createDevice(data)
    }
    setFormOpen(false)
    setEditingDevice(undefined)
  }

  const handleEdit = (device: Device) => {
    setEditingDevice(device)
    setFormOpen(true)
  }


  const handleToggleFavorite = async (device: Device) => {
    await updateDevice(device.id, { fav: !device.fav })
  }

  const handleEnsureCategory = async (name: string) => {
    const category = await ensureCategoryByName(name)
    await refetch()
    return category
  }

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditingDevice(undefined)
  }

  if (loading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/95 dark:bg-gray-900/95 pb-4 backdrop-blur">
        <PageHeader
          title="Device Manager"
          action={<Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">Add Device</Button>}
        />

        <div className="mb-4 text-gray-700 dark:text-gray-300">
          Showing {sortedDevices.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select
            label="Category"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            options={[
              { value: 'favorites', label: 'Favorites' },
              { value: 'all', label: 'All categories' },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
          />
          <Select
            label="Brand"
            value={effectiveBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            options={[
              { value: ALL_BRAND, label: 'All brands' },
              ...brands.map((b) => ({ value: b, label: b })),
            ]}
          />
          <Select
            label="Sort By"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as typeof sortField)}
            options={[
              { value: 'default', label: 'Category, Brand, Model' },
              { value: 'brand', label: 'Brand' },
              { value: 'model', label: 'Model' },
              { value: 'rack_units', label: 'Rack Units' },
              { value: 'depth_mm', label: 'Depth (mm)' },
              { value: 'weight_kg', label: 'Weight (kg)' },
              { value: 'power_w', label: 'Power (W)' },
            ]}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            <input
              type="search"
              placeholder="Brand, model or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <DeviceList devices={sortedDevices} onEdit={handleEdit} onDelete={setDeletingDevice} onToggleFavorite={handleToggleFavorite} />

      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editingDevice ? 'Edit Device' : 'New Device'}
      >
        <DeviceForm
          initialData={editingDevice}
          categories={categories}
          onEnsureCategory={handleEnsureCategory}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingDevice}
        onClose={() => setDeletingDevice(undefined)}
        onConfirm={() => deletingDevice && deleteDevice(deletingDevice.id)}
        title="Delete Device"
        message={`Are you sure you want to delete "${deletingDevice?.brand} ${deletingDevice?.model}"?`}
      />
    </div>
  )
}
