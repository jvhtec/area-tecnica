import { type FormEvent, useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Modal from '../ui/Modal'
import ImageCropper from './ImageCropper'
import { useImageUpload } from '../../hooks/useImageUpload'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import type { Device, DeviceCategory } from '../../types'
import { getRackPanelAspect, normalizeRackUnits, RACK_PANEL_WIDTH_UNITS, RACK_HALF_PANEL_WIDTH_UNITS } from '../../lib/rackVisual'

interface DeviceFormProps {
  initialData?: Device
  categories: DeviceCategory[]
  onEnsureCategory: (name: string) => Promise<DeviceCategory>
  onSubmit: (data: {
    brand: string
    model: string
    rack_units: number
    depth_mm: number
    weight_kg: number
    power_w: number
    is_half_rack: boolean
    invert_image_in_dark_mode: boolean
    category_id: string
    front_image_path?: string | null
    rear_image_path?: string | null
  }) => Promise<void>
  onCancel: () => void
}

export default function DeviceForm({
  initialData,
  categories,
  onEnsureCategory,
  onSubmit,
  onCancel,
}: DeviceFormProps) {
  const [brand, setBrand] = useState(initialData?.brand ?? '')
  const [model, setModel] = useState(initialData?.model ?? '')
  const [rackUnits, setRackUnits] = useState(initialData?.rack_units ?? 1)
  const [isHalfRack, setIsHalfRack] = useState(initialData?.is_half_rack ?? false)
  const [depthMm, setDepthMm] = useState(initialData?.depth_mm ?? 400)
  const [weightKg, setWeightKg] = useState(initialData?.weight_kg ?? 0)
  const [powerW, setPowerW] = useState(initialData?.power_w ?? 0)
  const [invertImageInDarkMode, setInvertImageInDarkMode] = useState(initialData?.invert_image_in_dark_mode ?? false)
  const [frontPath, setFrontPath] = useState(initialData?.front_image_path ?? null)
  const [rearPath, setRearPath] = useState(initialData?.rear_image_path ?? null)
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? '')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [saving, setSaving] = useState(false)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropSide, setCropSide] = useState<'front' | 'rear'>('front')
  const normalizedRackUnits = normalizeRackUnits(rackUnits)
  const cropAspect = getRackPanelAspect(normalizedRackUnits, isHalfRack)
  const CROP_PX_PER_INCH = 100
  const cropOutputWidth = (isHalfRack ? RACK_HALF_PANEL_WIDTH_UNITS : RACK_PANEL_WIDTH_UNITS) * CROP_PX_PER_INCH
  const cropOutputHeight = Math.round(cropOutputWidth / cropAspect)

  const { uploadImage, uploading } = useImageUpload()

  const frontInputRef = useRef<HTMLInputElement>(null)
  const rearInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (categoryId) return
    if (categories.length === 0) return
    setCategoryId(initialData?.category_id ?? categories[0].id)
  }, [categories, categoryId, initialData?.category_id])

  const handleFileSelect = (side: 'front' | 'rear', file: File) => {
    setCropSide(side)
    setCropSrc(URL.createObjectURL(file))
  }

  const handleEditExistingCrop = (side: 'front' | 'rear') => {
    const imagePath = side === 'front' ? frontPath : rearPath
    const imageUrl = getDeviceImageUrl(imagePath)
    if (!imageUrl) return
    setCropSide(side)
    setCropSrc(imageUrl)
  }

  const handleCropComplete = async (blob: Blob) => {
    const path = await uploadImage(blob, cropSide)
    if (cropSide === 'front') setFrontPath(path)
    else setRearPath(path)
    setCropSrc(null)
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setCreatingCategory(true)
    try {
      const category = await onEnsureCategory(newCategoryName)
      setCategoryId(category.id)
      setNewCategoryName('')
    } finally {
      setCreatingCategory(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      let resolvedCategoryId = categoryId

      if (resolvedCategoryId === '__new__') {
        const category = await onEnsureCategory(newCategoryName)
        resolvedCategoryId = category.id
      }

      await onSubmit({
        brand,
        model,
        rack_units: normalizedRackUnits,
        depth_mm: depthMm,
        weight_kg: weightKg,
        power_w: powerW,
        is_half_rack: isHalfRack,
        invert_image_in_dark_mode: invertImageInDarkMode,
        category_id: resolvedCategoryId,
        front_image_path: frontPath,
        rear_image_path: rearPath,
      })
    } finally {
      setSaving(false)
    }
  }

  const isCategoryValid = !!categoryId && (categoryId !== '__new__' || !!newCategoryName.trim())

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} required />
        <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} required />

        <Select
          label="Category"
          value={categoryId || ''}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            ...categories.map((category) => ({ value: category.id, label: category.name })),
            { value: '__new__', label: 'Create new category…' },
          ]}
          required
        />

        {categoryId === '__new__' && (
          <div className="space-y-2">
            <Input
              label="New Category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Switches"
              required
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCreateCategory()}
              disabled={creatingCategory || !newCategoryName.trim()}
            >
              {creatingCategory ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        )}

        <Input
          label="Rack Units"
          type="number"
          min={1}
          step={1}
          value={rackUnits}
          onChange={(e) => {
            const next = Number(e.target.value)
            setRackUnits(Number.isFinite(next) && next > 0 ? next : 1)
          }}
          onBlur={() => setRackUnits(normalizedRackUnits)}
          required
        />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isHalfRack}
            onChange={(e) => setIsHalfRack(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Half-rack width device (~9.5&Prime; / half of 19&Prime;)
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={invertImageInDarkMode}
            onChange={(e) => setInvertImageInDarkMode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Invert device images in dark theme
          </span>
        </label>

        <Input
          label="Depth (mm)"
          type="number"
          min={1}
          value={depthMm}
          onChange={(e) => setDepthMm(Number(e.target.value))}
          required
        />
        <Input
          label="Weight (kg)"
          type="number"
          min={0}
          step={0.01}
          value={weightKg}
          onChange={(e) => {
            const next = Number(e.target.value)
            setWeightKg(Number.isFinite(next) && next >= 0 ? next : 0)
          }}
          required
        />
        <Input
          label="Power (W)"
          type="number"
          min={0}
          step={1}
          value={powerW}
          onChange={(e) => {
            const next = Number(e.target.value)
            setPowerW(Number.isFinite(next) && next >= 0 ? Math.round(next) : 0)
          }}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Front Image</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect('front', file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => frontInputRef.current?.click()}
            >
              {frontPath ? 'Replace image' : 'Choose image'}
            </Button>
            {frontPath && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleEditExistingCrop('front')}
              >
                Edit crop
              </Button>
            )}
            {frontPath && <span className="text-xs text-green-600">Uploaded</span>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rear Image</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={rearInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect('rear', file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => rearInputRef.current?.click()}
            >
              {rearPath ? 'Replace image' : 'Choose image'}
            </Button>
            {rearPath && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleEditExistingCrop('rear')}
              >
                Edit crop
              </Button>
            )}
            {rearPath && <span className="text-xs text-green-600">Uploaded</span>}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" type="button" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={saving || uploading || !brand || !model || !isCategoryValid} className="w-full sm:w-auto">
            {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>

      <Modal
        isOpen={!!cropSrc}
        onClose={() => setCropSrc(null)}
        title={`Crop ${cropSide} image`}
      >
        {cropSrc && (
          <ImageCropper
            key={`${cropSide}-${normalizedRackUnits}-${isHalfRack}`}
            imageSrc={cropSrc}
            aspect={cropAspect}
            outputWidth={cropOutputWidth}
            outputHeight={cropOutputHeight}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </Modal>
    </>
  )
}
