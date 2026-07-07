import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import { DRAWING_STATE_OPTIONS } from '../../lib/drawingState'
import type { DrawingState, Rack } from '../../types'

interface LayoutCrudModalsProps {
  createLayoutOpen: boolean
  onCloseCreate: () => void
  renameLayoutOpen: boolean
  onCloseRename: () => void
  deleteLayoutOpen: boolean
  onCloseDelete: () => void
  layoutNameDraft: string
  onLayoutNameDraftChange: (value: string) => void
  layoutRackDraft: string
  onLayoutRackDraftChange: (value: string) => void
  layoutStateDraft: DrawingState
  onLayoutStateDraftChange: (value: DrawingState) => void
  layoutSaving: boolean
  racks: Rack[]
  activeLayoutName: string | undefined
  onCreate: () => void
  onRename: () => void
  onDelete: () => void
}

export default function LayoutCrudModals({
  createLayoutOpen,
  onCloseCreate,
  renameLayoutOpen,
  onCloseRename,
  deleteLayoutOpen,
  onCloseDelete,
  layoutNameDraft,
  onLayoutNameDraftChange,
  layoutRackDraft,
  onLayoutRackDraftChange,
  layoutStateDraft,
  onLayoutStateDraftChange,
  layoutSaving,
  racks,
  activeLayoutName,
  onCreate,
  onRename,
  onDelete,
}: LayoutCrudModalsProps) {
  return (
    <>
      <Modal isOpen={createLayoutOpen} onClose={onCloseCreate} title="New Layout">
        <div className="space-y-4">
          <Input
            label="Layout Name"
            value={layoutNameDraft}
            onChange={(e) => onLayoutNameDraftChange(e.target.value)}
            required
          />
          <Select
            label="Rack"
            value={layoutRackDraft}
            onChange={(e) => onLayoutRackDraftChange(e.target.value)}
            options={racks.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.rack_units}U)` }))}
          />
          <Select
            label="Drawing State"
            value={layoutStateDraft}
            onChange={(e) => onLayoutStateDraftChange(e.target.value as DrawingState)}
            options={DRAWING_STATE_OPTIONS}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onCloseCreate}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={layoutSaving || !layoutNameDraft || !layoutRackDraft}>
              {layoutSaving ? 'Creating...' : 'Create Layout'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={renameLayoutOpen} onClose={onCloseRename} title="Rename Layout">
        <div className="space-y-4">
          <Input
            label="Layout Name"
            value={layoutNameDraft}
            onChange={(e) => onLayoutNameDraftChange(e.target.value)}
            required
          />
          <Select
            label="Drawing State"
            value={layoutStateDraft}
            onChange={(e) => onLayoutStateDraftChange(e.target.value as DrawingState)}
            options={DRAWING_STATE_OPTIONS}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onCloseRename}>
              Cancel
            </Button>
            <Button onClick={onRename} disabled={layoutSaving || !layoutNameDraft}>
              {layoutSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteLayoutOpen}
        onClose={onCloseDelete}
        onConfirm={onDelete}
        title="Delete Layout"
        message={`Delete "${activeLayoutName}" from this project?`}
      />
    </>
  )
}
