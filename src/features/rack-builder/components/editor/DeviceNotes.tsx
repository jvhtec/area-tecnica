import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import type { LayoutItemWithDevice } from '../../types'

interface DeviceNotesProps {
  item: LayoutItemWithDevice | null
  onSave: (itemId: string, updates: { notes: string; custom_name: string | null; force_full_width?: boolean; rack_ear_offset_mm?: number }) => Promise<void>
  onClose: () => void
}

function toOffset(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 10) / 10
}

export default function DeviceNotes({ item, onSave, onClose }: DeviceNotesProps) {
  const [customName, setCustomName] = useState(item?.custom_name ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [forceFullWidth, setForceFullWidth] = useState(item?.force_full_width ?? false)
  const [rackEarOffset, setRackEarOffset] = useState(String(item?.rack_ear_offset_mm ?? 0))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!item) return
    const nextOffset = toOffset(rackEarOffset)
    if (nextOffset === null) {
      setValidationError('Rack ear offset must be a valid number.')
      return
    }
    if (nextOffset < 0) {
      setValidationError('Rack ear offset cannot be negative.')
      return
    }

    setValidationError(null)
    setSaving(true)
    try {
      await onSave(item.id, {
        custom_name: customName.trim() || null,
        notes,
        rack_ear_offset_mm: nextOffset,
        ...(item.device.is_half_rack ? { force_full_width: forceFullWidth } : {}),
      })
      onClose()
    } catch {
      setValidationError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const defaultName = item ? `${item.device.brand} ${item.device.model}` : ''

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={`Notes — ${item?.custom_name ?? defaultName}`}
    >
      <div className="space-y-3">
        <Input
          label="Name (layout-specific)"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={defaultName}
        />
        <Input
          label="Rack ear offset (mm)"
          type="number"
          step="0.1"
          value={rackEarOffset}
          onChange={(e) => {
            setRackEarOffset(e.target.value)
            if (validationError) setValidationError(null)
          }}
          placeholder="0"
        />
        {validationError && <p className="text-xs text-red-600">{validationError}</p>}
        <textarea
          className="w-full border rounded-md p-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes for this device placement..."
        />
        {item?.device.is_half_rack && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceFullWidth}
              onChange={(e) => setForceFullWidth(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Full-width span (shelf / custom ears)
            </span>
          </label>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}
