import { useEffect, useState } from 'react'
import { toErrorMessage } from '../lib/layoutEditorHelpers'
import type { LayoutItemWithDevice } from '../types'

interface UseMobilePlacementEditorParams {
  items: LayoutItemWithDevice[]
  updateItemDetails: (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  getPlacementIssue: (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm: number | undefined,
    excludeItemId: string | undefined,
    preferredLane: 0 | 1 | undefined,
    preferredSubLane: 0 | 1 | undefined,
  ) => string | null
  onSaveSuccess?: () => void
}

export function useMobilePlacementEditor({
  items,
  updateItemDetails,
  removeItem,
  getPlacementIssue,
  onSaveSuccess,
}: UseMobilePlacementEditorParams) {
  const [selectedItemToMove, setSelectedItemToMove] = useState<string | null>(null)
  const [mobileOffsetDraft, setMobileOffsetDraft] = useState('0')
  const [mobileNameDraft, setMobileNameDraft] = useState('')
  const [mobileNotesDraft, setMobileNotesDraft] = useState('')
  const [mobileEditorError, setMobileEditorError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedItemToMove) {
      setMobileOffsetDraft('0')
      setMobileNameDraft('')
      setMobileNotesDraft('')
      setMobileEditorError(null)
      return
    }

    const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
    if (!selectedItem) return

    setMobileOffsetDraft(String(selectedItem.rack_ear_offset_mm ?? 0))
    setMobileNameDraft(selectedItem.custom_name ?? '')
    setMobileNotesDraft(selectedItem.notes ?? '')
    setMobileEditorError(null)
  }, [items, selectedItemToMove])

  const handleMobileOffsetSave = async () => {
    if (!selectedItemToMove) return

    const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
    if (!selectedItem) return

    const offset = Number(mobileOffsetDraft)
    if (!Number.isFinite(offset)) {
      setMobileEditorError('Rack ear offset must be a valid number.')
      return
    }
    if (offset < 0) {
      setMobileEditorError('Rack ear offset cannot be negative.')
      return
    }

    const normalizedOffset = Math.round(offset * 10) / 10
    const issue = getPlacementIssue(
      selectedItem.start_u,
      selectedItem.device.rack_units,
      selectedItem.device.is_half_rack,
      selectedItem.force_full_width,
      selectedItem.device.depth_mm,
      normalizedOffset,
      selectedItem.id,
      selectedItem.preferred_lane ?? undefined,
      selectedItem.preferred_sub_lane ?? undefined,
    )
    if (issue) {
      setMobileEditorError(issue)
      return
    }

    try {
      await updateItemDetails(selectedItemToMove, {
        custom_name: mobileNameDraft.trim() || null,
        notes: mobileNotesDraft,
        rack_ear_offset_mm: normalizedOffset,
      })
      setMobileEditorError(null)
      onSaveSuccess?.()
    } catch (err) {
      console.error('Save failed:', err)
      setMobileEditorError(toErrorMessage(err))
    }
  }

  const handleMobileDeleteItem = async () => {
    if (!selectedItemToMove) return
    try {
      await removeItem(selectedItemToMove)
      setSelectedItemToMove(null)
      setMobileEditorError(null)
    } catch (err) {
      console.error('Delete failed:', err)
      setMobileEditorError(toErrorMessage(err))
    }
  }

  return {
    selectedItemToMove,
    setSelectedItemToMove,
    mobileOffsetDraft,
    setMobileOffsetDraft,
    mobileNameDraft,
    setMobileNameDraft,
    mobileNotesDraft,
    setMobileNotesDraft,
    mobileEditorError,
    setMobileEditorError,
    handleMobileOffsetSave,
    handleMobileDeleteItem,
  }
}
