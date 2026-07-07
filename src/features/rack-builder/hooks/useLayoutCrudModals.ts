import { useState } from 'react'
import type { DrawingState, Layout, Rack } from '../types'

interface UseLayoutCrudModalsParams {
  projectId: string | undefined
  rack: Rack | null
  racks: Rack[]
  activeLayout: Layout | null
  layouts: Layout[]
  createLayout: (layout: { project_id?: string; rack_id: string; name: string; drawing_state: DrawingState }) => Promise<Layout>
  updateLayout: (id: string, updates: Partial<{ name: string; rack_id: string; project_id: string; drawing_state: DrawingState }>) => Promise<void>
  deleteLayout: (id: string) => Promise<void>
  setActiveLayout: (layoutId: string) => void
}

export function useLayoutCrudModals({
  projectId,
  rack,
  racks,
  activeLayout,
  layouts,
  createLayout,
  updateLayout,
  deleteLayout,
  setActiveLayout,
}: UseLayoutCrudModalsParams) {
  const [createLayoutOpen, setCreateLayoutOpen] = useState(false)
  const [renameLayoutOpen, setRenameLayoutOpen] = useState(false)
  const [deleteLayoutOpen, setDeleteLayoutOpen] = useState(false)
  const [layoutNameDraft, setLayoutNameDraft] = useState('')
  const [layoutRackDraft, setLayoutRackDraft] = useState('')
  const [layoutStateDraft, setLayoutStateDraft] = useState<DrawingState>('preliminary')
  const [layoutSaving, setLayoutSaving] = useState(false)

  const openCreateLayoutModal = () => {
    setLayoutNameDraft('')
    setLayoutRackDraft(rack?.id ?? racks[0]?.id ?? '')
    setLayoutStateDraft('preliminary')
    setCreateLayoutOpen(true)
  }

  const openRenameLayoutModal = () => {
    if (!activeLayout) return
    setLayoutNameDraft(activeLayout.name)
    setLayoutStateDraft(activeLayout.drawing_state)
    setRenameLayoutOpen(true)
  }

  const handleCreateLayout = async () => {
    if (!projectId || !layoutNameDraft || !layoutRackDraft) return

    setLayoutSaving(true)
    try {
      const created = await createLayout({
        project_id: projectId,
        name: layoutNameDraft,
        rack_id: layoutRackDraft,
        drawing_state: layoutStateDraft,
      })
      if (created) {
        setCreateLayoutOpen(false)
        setActiveLayout(created.id)
      }
    } finally {
      setLayoutSaving(false)
    }
  }

  const handleRenameLayout = async () => {
    if (!activeLayout || !layoutNameDraft) return

    setLayoutSaving(true)
    try {
      await updateLayout(activeLayout.id, { name: layoutNameDraft, drawing_state: layoutStateDraft })
      setRenameLayoutOpen(false)
    } finally {
      setLayoutSaving(false)
    }
  }

  const handleDeleteLayout = async () => {
    if (!activeLayout || layouts.length <= 1) return

    const fallbackLayout = layouts.find((entry) => entry.id !== activeLayout.id)

    setLayoutSaving(true)
    try {
      await deleteLayout(activeLayout.id)
      setDeleteLayoutOpen(false)
      if (fallbackLayout) setActiveLayout(fallbackLayout.id)
    } finally {
      setLayoutSaving(false)
    }
  }

  return {
    createLayoutOpen,
    setCreateLayoutOpen,
    renameLayoutOpen,
    setRenameLayoutOpen,
    deleteLayoutOpen,
    setDeleteLayoutOpen,
    layoutNameDraft,
    setLayoutNameDraft,
    layoutRackDraft,
    setLayoutRackDraft,
    layoutStateDraft,
    setLayoutStateDraft,
    layoutSaving,
    openCreateLayoutModal,
    openRenameLayoutModal,
    handleCreateLayout,
    handleRenameLayout,
    handleDeleteLayout,
  }
}
