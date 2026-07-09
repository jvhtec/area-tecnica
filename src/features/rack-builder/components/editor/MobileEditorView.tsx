import RackSideDepthView from './RackSideDepthView'
import AutoScaleText from '../shared/AutoScaleText'
import DeviceNotes from './DeviceNotes'
import LayoutCrudModals from './LayoutCrudModals'
import { getItemSlot, getSlotStyle } from '../../lib/rackPositions'
import { ALL_BRAND } from '../../hooks/useDevices'
import {
  getTopU,
  computeMobileColumnRange,
  resolvePlacementImageUrl,
  VIEW_MODE_OPTIONS,
  type RackViewMode,
} from '../../lib/layoutEditorHelpers'
import { getRackBuilderProjectsPath } from '@/features/rack-builder/lib/department'
import type {
  Device,
  DeviceCategory,
  DeviceFacing,
  DrawingState,
  Layout,
  LayoutItemWithDevice,
  Project,
  Rack,
} from '../../types'

interface DeviceAtUResult {
  item: LayoutItemWithDevice
  isGhost: boolean
}

interface MobileEditorViewProps {
  navigate: (path: string) => void
  project: Project
  activeLayout: Layout
  layouts: Layout[]
  setActiveLayout: (layoutId: string) => void
  cycleRackViewMode: () => void
  activeViewOption: { value: RackViewMode; label: string; shortLabel: string }
  isSideView: boolean
  selectedDeviceTemplate: string | null
  selectedItemToMove: string | null
  setSelectedDeviceTemplate: (id: string | null) => void
  setSelectedItemToMove: (id: string | null) => void
  setMobileOffsetDraft: (value: string) => void
  mobileNameDraft: string
  setMobileNameDraft: (value: string) => void
  mobileEditorError: string | null
  setMobileEditorError: (value: string | null) => void
  mobileNotesDraft: string
  setMobileNotesDraft: (value: string) => void
  mobileOffsetDraft: string
  handleMobileOffsetSave: () => Promise<void>
  handleMobileDeleteItem: () => Promise<void>
  placementHint: string | null
  isDualRack: boolean
  mobileDualLane: 0 | 1
  setMobileDualLane: (lane: 0 | 1) => void
  rack: Rack
  items: LayoutItemWithDevice[]
  viewMode: RackViewMode
  showDeviceNames: boolean
  slots: number[]
  mobileColumnCount: number
  getDeviceAtU: (slotU: number, visualSlotIndex: number) => DeviceAtUResult | undefined
  handleMobileSlotClick: (slotU: number, colIndex: number) => Promise<void>
  handleMobileMoveToSlot: (slotU: number, colIndex: number) => Promise<void>
  mobileGhostSlotAssignments: Map<string, ReturnType<typeof getItemSlot>>
  mobileSlotAssignments: Map<string, ReturnType<typeof getItemSlot>>
  facing: DeviceFacing
  haptic: (input?: string) => void
  simplifiedView: boolean
  mobileLaneOffset: number
  activeTab: 'devices' | 'rack'
  setActiveTab: (tab: 'devices' | 'rack') => void
  isSheetOpen: boolean
  setIsSheetOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
  selectedCategoryId: string
  setSelectedCategoryId: (value: string) => void
  libraryCategories: DeviceCategory[]
  selectedBrand: string
  setSelectedBrand: (value: string) => void
  brands: string[]
  filteredDevices: Device[]
  openCreateLayoutModal: () => void
  openRenameLayoutModal: () => void
  setDeleteLayoutOpen: (open: boolean) => void
  setRackViewMode: (mode: RackViewMode) => void
  setShowDeviceNames: (updater: (prev: boolean) => boolean) => void
  setSimplifiedView: (updater: (prev: boolean) => boolean) => void
  fullProjectExportTitle: string
  rackTotals: { weightKg: number; powerW: number }
  notesItem: LayoutItemWithDevice | null
  handleSaveNotes: (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => Promise<void>
  setNotesItem: (item: LayoutItemWithDevice | null) => void
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

export default function MobileEditorView({
  navigate,
  project,
  activeLayout,
  layouts,
  setActiveLayout,
  cycleRackViewMode,
  activeViewOption,
  isSideView,
  selectedDeviceTemplate,
  selectedItemToMove,
  setSelectedDeviceTemplate,
  setSelectedItemToMove,
  setMobileOffsetDraft,
  mobileNameDraft,
  setMobileNameDraft,
  mobileEditorError,
  setMobileEditorError,
  mobileNotesDraft,
  setMobileNotesDraft,
  mobileOffsetDraft,
  handleMobileOffsetSave,
  handleMobileDeleteItem,
  placementHint,
  isDualRack,
  mobileDualLane,
  setMobileDualLane,
  rack,
  items,
  viewMode,
  showDeviceNames,
  slots,
  mobileColumnCount,
  getDeviceAtU,
  handleMobileSlotClick,
  handleMobileMoveToSlot,
  mobileGhostSlotAssignments,
  mobileSlotAssignments,
  facing,
  haptic,
  simplifiedView,
  mobileLaneOffset,
  activeTab,
  setActiveTab,
  isSheetOpen,
  setIsSheetOpen,
  searchQuery,
  setSearchQuery,
  selectedCategoryId,
  setSelectedCategoryId,
  libraryCategories,
  selectedBrand,
  setSelectedBrand,
  brands,
  filteredDevices,
  openCreateLayoutModal,
  openRenameLayoutModal,
  setDeleteLayoutOpen,
  setRackViewMode,
  setShowDeviceNames,
  setSimplifiedView,
  fullProjectExportTitle,
  rackTotals,
  notesItem,
  handleSaveNotes,
  setNotesItem,
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
}: MobileEditorViewProps) {
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 overflow-hidden">
      <header className="flex items-center justify-between px-4 h-14 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(getRackBuilderProjectsPath(project.department))} className="text-gray-600 dark:text-slate-300 text-sm font-semibold">
          &larr; Back
        </button>
        <div className="flex flex-col items-center min-w-0 px-2">
          <h1 className="text-sm font-bold truncate max-w-[150px] dark:text-white">{project.name}</h1>
          <span className="text-[10px] text-gray-500 dark:text-slate-500 uppercase tracking-widest truncate">{activeLayout.name}</span>
        </div>
      </header>

      <div className="px-2 py-2 bg-slate-900 border-b border-slate-800 overflow-x-auto shrink-0">
        <div className="inline-flex items-center gap-2">
          {layouts.map((layoutEntry) => (
            <button
              key={layoutEntry.id}
              onClick={() => setActiveLayout(layoutEntry.id)}
              className={`px-3 py-1 rounded-md text-xs whitespace-nowrap border ${
                layoutEntry.id === activeLayout.id
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              {layoutEntry.name}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative bg-slate-950">
        <div className="fixed right-4 z-20 flex flex-col gap-2" style={{ top: 'calc(7rem + env(safe-area-inset-top))' }}>
          <button
            onClick={cycleRackViewMode}
            className="w-12 h-12 rounded-full bg-indigo-600 shadow-xl flex items-center justify-center border border-indigo-400 text-xs font-bold uppercase"
            title={`Current view: ${activeViewOption.label}`}
          >
            {activeViewOption.shortLabel}
          </button>
        </div>

        {!isSideView && (selectedDeviceTemplate || selectedItemToMove) && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 bg-indigo-600 px-4 py-2 rounded-full shadow-2xl border border-indigo-400 flex items-center gap-2" style={{ top: 'calc(7rem + env(safe-area-inset-top))' }}>
            <span className="text-xs font-bold">{selectedItemToMove ? 'Tap a slot to move' : 'Tap a slot to place'}</span>
            <button onClick={() => { setSelectedDeviceTemplate(null); setSelectedItemToMove(null); setMobileOffsetDraft('0') }} className="text-xs">✕</button>
          </div>
        )}

        {!isSideView && selectedItemToMove && (() => {
          const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
          if (!selectedItem) return null
          const selectedLabel = selectedItem.custom_name?.trim() || `${selectedItem.device.brand} ${selectedItem.device.model}`
          return (
            <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-xl border border-indigo-400 bg-slate-900/95 px-3 py-2 shadow-2xl" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
              <div className="mb-2 text-[11px] font-semibold text-indigo-100 truncate">Edit · {selectedLabel}</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={mobileNameDraft}
                  onChange={(e) => { setMobileNameDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
                  placeholder="Custom name"
                  className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
                />
                <textarea
                  value={mobileNotesDraft}
                  onChange={(e) => { setMobileNotesDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
                  placeholder="Notes"
                  className="w-full h-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={mobileOffsetDraft}
                    onChange={(e) => { setMobileOffsetDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
                    className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
                    placeholder="Offset (mm)"
                  />
                  <button
                    onClick={() => void handleMobileOffsetSave()}
                    className="min-h-9 rounded-md border border-indigo-300 bg-indigo-600 px-3 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => void handleMobileDeleteItem()}
                    className="min-h-9 rounded-md border border-red-500/70 bg-red-700/70 px-3 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
                {mobileEditorError && <p className="text-[11px] text-amber-300">{mobileEditorError}</p>}
              </div>
            </div>
          )
        })()}

        {placementHint && !isSideView && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow-lg" style={{ top: 'calc(10.5rem + env(safe-area-inset-top))' }}>
            {placementHint}
          </div>
        )}

        {isDualRack && !isSideView && (
          <div className="px-5 pt-3 pb-1">
            <div className="max-w-[360px] mx-auto flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() => setMobileDualLane(0)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  mobileDualLane === 0
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Left half
              </button>
              <span className="text-slate-400 uppercase tracking-wide">Dual rack view</span>
              <button
                onClick={() => setMobileDualLane(1)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  mobileDualLane === 1
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Right half
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-center p-5 min-h-full" style={{ paddingBottom: selectedItemToMove ? 'calc(21rem + env(safe-area-inset-bottom))' : 'calc(7rem + env(safe-area-inset-bottom))' }}>
          {isSideView ? (
            <div className="w-full max-w-[360px]">
              <RackSideDepthView
                rack={rack}
                items={items}
                side={viewMode as 'left' | 'right'}
                showDeviceDetails={showDeviceNames}
                compact
              />
              <p className="mt-3 text-[11px] text-slate-500 text-center">
                Side views are read-only. Switch to Front or Rear to place or move devices.
              </p>
            </div>
          ) : (
            <div className="relative w-full max-w-[360px]">
              <div className="bg-slate-900 rounded-t-xl border-x-[10px] border-t-[10px] border-slate-800 shadow-2xl">
                {slots.map((u) => (
                  <div
                    key={u}
                    className="h-10 border-b border-slate-800/70 relative flex items-center transition-colors"
                  >
                    <div className="w-8 text-[10px] font-mono text-slate-500 flex items-center justify-center border-r border-slate-800 bg-slate-900/50 h-full">
                      {u}
                    </div>

                    <div className="flex-1 h-full relative">
                      {Array.from({ length: mobileColumnCount }, (_, colIndex) => {
                        const visualColIndex = mobileLaneOffset + colIndex
                        const cellEntry = getDeviceAtU(u, visualColIndex)
                        const item = cellEntry?.item
                        const isGhost = cellEntry?.isGhost ?? false
                        const topU = item ? getTopU(item) : null
                        const isTop = item && topU === u

                        // Compute which column this device's slot starts in (for multi-column spanning)
                        const itemSlot = item && rack
                          ? (
                            isGhost
                              ? (mobileGhostSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
                              : (mobileSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
                          )
                          : null
                        const colWidthPct = 100 / mobileColumnCount
                        const { startCol, spanCols } = itemSlot && rack
                          ? (() => {
                            const { left, width } = getSlotStyle(itemSlot, rack.width, facing)
                            return computeMobileColumnRange(left, width, rack.width)
                          })()
                          : { startCol: visualColIndex, spanCols: 1 }
                        const isLeadCol = visualColIndex === startCol
                        const visibleSpanCols = Math.max(0, Math.min(spanCols, mobileColumnCount - colIndex))

                        const isSelectableEmpty = (!item || isGhost) && (!!selectedDeviceTemplate || !!selectedItemToMove)
                        const colBaseClass = isSelectableEmpty ? 'bg-indigo-500/15 active:bg-indigo-500/30' : ''
                        const colLeft = `${colIndex * colWidthPct}%`
                        const colWidth = `${colWidthPct}%`

                        const selectableItem = item
                        const handleColClick: (() => void) | undefined = isSelectableEmpty
                          ? () => void (selectedItemToMove ? handleMobileMoveToSlot(u, visualColIndex) : handleMobileSlotClick(u, visualColIndex))
                          : selectableItem && !isGhost
                            ? () => {
                                haptic('nudge')
                                if (selectedItemToMove === selectableItem.id) {
                                  setSelectedItemToMove(null)
                                } else {
                                  setSelectedItemToMove(selectableItem.id)
                                  setSelectedDeviceTemplate(null)
                                }
                              }
                            : undefined

                        return (
                          <div
                            key={`${u}-${colIndex}`}
                            className={`absolute top-0 h-full border-r border-slate-800/60 ${colBaseClass}`}
                            style={{ left: colLeft, width: colWidth }}
                            onClick={handleColClick}
                          >
                            {isTop && item && isLeadCol && visibleSpanCols > 0 && (
                              <div
                                className="absolute z-10 p-1"
                                style={{
                                  height: `${item.device.rack_units * 40 - 1}px`,
                                  top: '0px',
                                  left: 0,
                                  width: `${visibleSpanCols * 100}%`,
                                }}
                              >
                                <div
                                  className={`relative w-full h-full rounded overflow-hidden bg-slate-700 border-2 transition-colors ${isGhost ? 'border-slate-400/50 opacity-55 saturate-75' : selectedItemToMove === item.id ? 'border-amber-400 opacity-70' : 'border-indigo-300/70'}`}
                                  style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  {simplifiedView ? (
                                    <div className="absolute inset-1 pointer-events-none">
                                      <span className="absolute top-0 left-0 max-w-[40%] z-[1] text-[8px] font-bold uppercase text-white truncate">{item.device.brand}</span>
                                      <span className="absolute bottom-0 left-0 max-w-[40%] z-[1] text-[8px] text-slate-400 truncate">{item.device.model}</span>
                                      {item.notes && (
                                        <AutoScaleText
                                          text={item.notes}
                                          className="absolute inset-0 flex items-center justify-center text-center text-slate-300 whitespace-pre-line overflow-hidden break-words"
                                          minFontPx={4}
                                        />
                                      )}
                                      <span className="absolute bottom-0 right-0 max-w-[50%] z-[1] text-[8px] font-semibold text-blue-300 truncate">{item.custom_name?.trim() || ''}</span>
                                    </div>
                                  ) : (
                                    <>
                                      {(() => {
                                        const imageUrl = resolvePlacementImageUrl(item, facing)
                                        return imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                            className="w-full h-full object-fill"
                                            draggable={false}
                                            onContextMenu={(e) => e.preventDefault()}
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-indigo-500/80" />
                                        )
                                      })()}

                                      {showDeviceNames && (
                                        <div className="absolute inset-0 bg-black/35 p-2 flex flex-col justify-end pointer-events-none">
                                          <p className="text-[9px] uppercase font-black text-indigo-100 truncate">
                                            {item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                          </p>
                                          {item.custom_name && (
                                            <p className="text-[10px] text-indigo-100 truncate">{item.device.brand} {item.device.model}</p>
                                          )}
                                          {item.notes && <p className="text-[10px] text-indigo-100/90 truncate">{item.notes}</p>}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-b-xl" />
            </div>
          )}
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => { setActiveTab('devices'); setIsSheetOpen(true) }}
          className={`flex flex-col items-center gap-1 px-6 py-2 ${selectedDeviceTemplate ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <span className="text-lg">▦</span>
          <span className="text-[10px] font-bold uppercase">Devices</span>
        </button>

        <button
          onClick={() => { setActiveTab('rack'); setIsSheetOpen(true) }}
          className="flex flex-col items-center gap-1 px-6 py-2 text-slate-400"
        >
          <span className="text-lg">⚙</span>
          <span className="text-[10px] font-bold uppercase">Rack</span>
        </button>
      </footer>

      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex overflow-hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsSheetOpen(false)} />
          <div className="relative w-80 max-w-[85%] bg-slate-900 h-full shadow-2xl flex flex-col">
            <div
              className="p-4 border-b border-slate-800 flex items-center justify-between"
              style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
            >
              <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">
                {activeTab === 'devices' ? 'Add Equipment' : 'Rack Settings'}
              </h2>
              <button onClick={() => setIsSheetOpen(false)} className="p-2 text-slate-300">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'devices' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Search</label>
                    <input
                      type="search"
                      placeholder="Brand, model or category…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Category</label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                    >
                      <option value="favorites">Favorites</option>
                      <option value="all">All categories</option>
                      {libraryCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                    >
                      <option value={ALL_BRAND}>All brands</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {filteredDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        setSelectedDeviceTemplate(device.id)
                        setIsSheetOpen(false)
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                        selectedDeviceTemplate === device.id
                          ? 'bg-indigo-600 border-indigo-400'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                      >
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{device.brand}</p>
                        <p className="text-xs text-slate-300 truncate">{device.model}</p>
                        <p className="text-[10px] text-indigo-200 truncate">{device.category?.name ?? 'Uncategorized'}</p>
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded text-[10px] font-mono text-indigo-400 shrink-0">
                        {device.rack_units}U{device.is_half_rack ? ' ½' : ''}
                      </div>
                    </button>
                  ))}
                  {filteredDevices.length === 0 && <p className="text-xs text-slate-400">No devices match your filters.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 uppercase font-bold">Layouts</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsSheetOpen(false); openCreateLayoutModal() }}
                      className="flex-1 py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                    >
                      + New
                    </button>
                    <button
                      onClick={() => { setIsSheetOpen(false); openRenameLayoutModal() }}
                      className="flex-1 py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { setIsSheetOpen(false); setDeleteLayoutOpen(true) }}
                      disabled={layouts.length <= 1}
                      className="flex-1 py-2 rounded-lg border text-sm border-red-700/60 bg-red-900/30 text-red-300 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 uppercase font-bold">View</p>
                  <div className="grid grid-cols-2 gap-2">
                    {VIEW_MODE_OPTIONS.map((option) => (
                      <button
                        key={`mobile-view-${option.value}`}
                        onClick={() => setRackViewMode(option.value)}
                        className={`py-2 rounded-lg border text-sm ${
                          viewMode === option.value
                            ? 'border-indigo-400 bg-indigo-500/20'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowDeviceNames((prev) => !prev)}
                    className={`w-full py-2 rounded-lg border text-sm ${
                      showDeviceNames ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    Device names: {showDeviceNames ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => setSimplifiedView((prev) => !prev)}
                    className={`w-full py-2 rounded-lg border text-sm ${
                      simplifiedView ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    Simplified view: {simplifiedView ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => navigate(`/rack-builder/editor/project/${project.id}/print/${activeLayout.id}`)}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                  >
                    Export A3 PDF
                  </button>
                  <button
                    onClick={() => navigate(`/rack-builder/editor/project/${project.id}/print/all`)}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                    title={fullProjectExportTitle}
                  >
                    Export Full Project PDF
                  </button>
                  <button
                    onClick={() => navigate(`/rack-builder/editor/project/${project.id}/panels`)}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                  >
                    Panel Layouts
                  </button>
                  <p className="text-xs text-slate-500">Rack: {rack.name} ({rack.rack_units}U, {rack.width})</p>
                  <p className="text-xs text-slate-500">Total load: {rackTotals.weightKg.toFixed(2)} kg</p>
                  <p className="text-xs text-slate-500">Total power: {rackTotals.powerW} W</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeviceNotes
        key={notesItem?.id ?? 'none'}
        item={notesItem}
        onSave={handleSaveNotes}
        onClose={() => setNotesItem(null)}
      />

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
    </div>
  )
}
