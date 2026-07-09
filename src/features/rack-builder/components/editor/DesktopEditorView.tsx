import type { ReactNode } from 'react'
import { DndProvider } from 'react-dnd'
import type { BackendFactory } from 'dnd-core'
import DevicePalette from './DevicePalette'
import RackGrid from './RackGrid'
import RackSideDepthView from './RackSideDepthView'
import DeviceNotes from './DeviceNotes'
import Button from '../ui/Button'
import LayoutCrudModals from './LayoutCrudModals'
import {
  VIEW_MODE_OPTIONS,
  MIN_ZOOM_PERCENT,
  MAX_ZOOM_PERCENT,
  type RackViewMode,
} from '../../lib/layoutEditorHelpers'
import { getRackBuilderProjectsPath } from '@/features/rack-builder/lib/department'
import type {
  ConnectorDefinition,
  Device,
  DeviceCategory,
  DeviceFacing,
  DrawingState,
  Layout,
  LayoutItemWithDevice,
  Project,
  Rack,
} from '../../types'

interface DesktopEditorViewProps {
  dndBackend: BackendFactory
  dndOptions: unknown
  filteredDevices: Device[]
  libraryCategories: DeviceCategory[]
  selectedCategoryId: string
  setSelectedCategoryId: (value: string) => void
  brands: string[]
  selectedBrand: string
  setSelectedBrand: (value: string) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
  devicesLoading: boolean
  navigate: (path: string) => void
  project: Project
  activeLayout: Layout
  rack: Rack
  rackTotals: { weightKg: number; powerW: number }
  fullProjectExportTitle: string
  viewMode: RackViewMode
  setRackViewMode: (mode: RackViewMode) => void
  showDeviceNames: boolean
  setShowDeviceNames: (updater: (prev: boolean) => boolean) => void
  simplifiedView: boolean
  setSimplifiedView: (updater: (prev: boolean) => boolean) => void
  handleZoomOut: () => void
  canZoomOut: boolean
  handleZoomReset: () => void
  zoomPercent: number
  handleZoomIn: () => void
  canZoomIn: boolean
  tabButtons: ReactNode[]
  openCreateLayoutModal: () => void
  openRenameLayoutModal: () => void
  setDeleteLayoutOpen: (open: boolean) => void
  layouts: Layout[]
  placementHint: string | null
  isSideView: boolean
  items: LayoutItemWithDevice[]
  zoomFactor: number
  connectorById: Map<string, ConnectorDefinition>
  facing: DeviceFacing
  setHoverPlacementHint: (hint: string | null) => void
  handleDropNew: (
    deviceId: string,
    startU: number,
    rackUnits: number,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => Promise<void>
  handleDropMove: (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  setNotesItem: (item: LayoutItemWithDevice | null) => void
  notesItem: LayoutItemWithDevice | null
  handleSaveNotes: (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => Promise<void>
  createLayoutOpen: boolean
  setCreateLayoutOpen: (open: boolean) => void
  renameLayoutOpen: boolean
  setRenameLayoutOpen: (open: boolean) => void
  deleteLayoutOpen: boolean
  layoutNameDraft: string
  setLayoutNameDraft: (value: string) => void
  layoutRackDraft: string
  setLayoutRackDraft: (value: string) => void
  layoutStateDraft: DrawingState
  setLayoutStateDraft: (value: DrawingState) => void
  layoutSaving: boolean
  racks: Rack[]
  handleCreateLayout: () => Promise<void>
  handleRenameLayout: () => Promise<void>
  handleDeleteLayout: () => Promise<void>
}

export default function DesktopEditorView({
  dndBackend,
  dndOptions,
  filteredDevices,
  libraryCategories,
  selectedCategoryId,
  setSelectedCategoryId,
  brands,
  selectedBrand,
  setSelectedBrand,
  searchQuery,
  setSearchQuery,
  devicesLoading,
  navigate,
  project,
  activeLayout,
  rack,
  rackTotals,
  fullProjectExportTitle,
  viewMode,
  setRackViewMode,
  showDeviceNames,
  setShowDeviceNames,
  simplifiedView,
  setSimplifiedView,
  handleZoomOut,
  canZoomOut,
  handleZoomReset,
  zoomPercent,
  handleZoomIn,
  canZoomIn,
  tabButtons,
  openCreateLayoutModal,
  openRenameLayoutModal,
  setDeleteLayoutOpen,
  layouts,
  placementHint,
  isSideView,
  items,
  zoomFactor,
  connectorById,
  facing,
  setHoverPlacementHint,
  handleDropNew,
  handleDropMove,
  removeItem,
  setNotesItem,
  notesItem,
  handleSaveNotes,
  createLayoutOpen,
  setCreateLayoutOpen,
  renameLayoutOpen,
  setRenameLayoutOpen,
  deleteLayoutOpen,
  layoutNameDraft,
  setLayoutNameDraft,
  layoutRackDraft,
  setLayoutRackDraft,
  layoutStateDraft,
  setLayoutStateDraft,
  layoutSaving,
  racks,
  handleCreateLayout,
  handleRenameLayout,
  handleDeleteLayout,
}: DesktopEditorViewProps) {
  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
        <DevicePalette
          devices={filteredDevices}
          categories={libraryCategories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          brands={brands}
          selectedBrand={selectedBrand}
          onBrandChange={setSelectedBrand}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={devicesLoading}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Button variant="secondary" onClick={() => navigate(getRackBuilderProjectsPath(project.department))}>
                  &larr; Back
                </Button>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold dark:text-white truncate">{project.name}</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {activeLayout.name} | {rack.name} ({rack.rack_units}U) | {rackTotals.weightKg.toFixed(2)} kg | {rackTotals.powerW} W
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/rack-builder/editor/project/${project.id}/print/${activeLayout.id}`)}
                >
                  Export A3 PDF
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/rack-builder/editor/project/${project.id}/panels`)}
                >
                  Panel Layouts
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/rack-builder/editor/project/${project.id}/print/all`)}
                  title={fullProjectExportTitle}
                >
                  Export Full Project PDF
                </Button>
                {VIEW_MODE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={viewMode === option.value ? 'primary' : 'secondary'}
                    onClick={() => setRackViewMode(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  variant={showDeviceNames ? 'primary' : 'secondary'}
                  onClick={() => setShowDeviceNames((prev) => !prev)}
                >
                  Labels {showDeviceNames ? 'On' : 'Off'}
                </Button>
                <Button
                  variant={simplifiedView ? 'primary' : 'secondary'}
                  onClick={() => setSimplifiedView((prev) => !prev)}
                >
                  Simplified {simplifiedView ? 'On' : 'Off'}
                </Button>
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={!canZoomOut}
                      className="h-11 w-9 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Zoom out (${MIN_ZOOM_PERCENT}% min)`}
                      aria-label="Zoom out"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomReset}
                      className="h-11 min-w-16 border-x border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs font-semibold text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
                      title="Reset zoom to 100%"
                      aria-label="Reset zoom"
                    >
                      {zoomPercent}%
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={!canZoomIn}
                      className="h-11 w-9 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Zoom in (${MAX_ZOOM_PERCENT}% max)`}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {tabButtons}
              <Button variant="secondary" className="whitespace-nowrap" onClick={openCreateLayoutModal}>
                + Layout
              </Button>
              <Button variant="secondary" className="whitespace-nowrap" onClick={openRenameLayoutModal}>
                Rename
              </Button>
              <Button
                variant="danger"
                className="whitespace-nowrap"
                onClick={() => setDeleteLayoutOpen(true)}
                disabled={layouts.length <= 1}
                title={layouts.length <= 1 ? 'A project must contain at least one layout' : undefined}
              >
                Delete
              </Button>
            </div>


      {placementHint && !isSideView && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {placementHint}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto flex items-start justify-center p-10">
            {placementHint && !isSideView && (
              <div className="fixed left-1/2 top-24 z-20 w-[min(60rem,calc(100%-4rem))] -translate-x-1/2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-lg">
                {placementHint}
              </div>
            )}
            {isSideView ? (
              <RackSideDepthView
                rack={rack}
                items={items}
                side={viewMode as 'left' | 'right'}
                zoom={zoomFactor}
                showDeviceDetails={showDeviceNames}
              />
            ) : (
              <RackGrid
                rack={rack}
                items={items}
                connectorById={connectorById}
                facing={facing}
                zoom={zoomFactor}
                showDeviceDetails={showDeviceNames}
                simplifiedView={simplifiedView}
                onPlacementHint={setHoverPlacementHint}
                onDropNew={handleDropNew}
                onDropMove={handleDropMove}
                onRemove={removeItem}
                onEditNotes={setNotesItem}
              />
            )}
          </div>
        </div>

        <DeviceNotes
          key={notesItem?.id ?? 'none'}
          item={notesItem}
          onSave={handleSaveNotes}
          onClose={() => setNotesItem(null)}
        />
      </div>

      <LayoutCrudModals
        createLayoutOpen={createLayoutOpen}
        onCloseCreate={() => setCreateLayoutOpen(false)}
        renameLayoutOpen={renameLayoutOpen}
        onCloseRename={() => setRenameLayoutOpen(false)}
        deleteLayoutOpen={deleteLayoutOpen}
        onCloseDelete={() => setDeleteLayoutOpen(false)}
        layoutNameDraft={layoutNameDraft}
        onLayoutNameDraftChange={setLayoutNameDraft}
        layoutRackDraft={layoutRackDraft}
        onLayoutRackDraftChange={setLayoutRackDraft}
        layoutStateDraft={layoutStateDraft}
        onLayoutStateDraftChange={setLayoutStateDraft}
        layoutSaving={layoutSaving}
        racks={racks}
        activeLayoutName={activeLayout.name}
        onCreate={() => void handleCreateLayout()}
        onRename={() => void handleRenameLayout()}
        onDelete={() => void handleDeleteLayout()}
      />
    </DndProvider>
  )
}
