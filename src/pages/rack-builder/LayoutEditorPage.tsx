import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useProjectRecord } from '@/features/rack-builder/hooks/useProjectRecord'
import { useLayoutItems } from '@/features/rack-builder/hooks/useLayoutItems'
import { useDevices } from '@/features/rack-builder/hooks/useDevices'
import { usePanelLayouts } from '@/features/rack-builder/hooks/usePanelLayouts'
import { useLayouts } from '@/features/rack-builder/hooks/useLayouts'
import { useRacks } from '@/features/rack-builder/hooks/useRacks'
import { useConnectors } from '@/features/rack-builder/hooks/useConnectors'
import { useLayoutEditorViewport } from '@/features/rack-builder/hooks/useLayoutEditorViewport'
import { useZoomControl } from '@/features/rack-builder/hooks/useZoomControl'
import { useLayoutCrudModals } from '@/features/rack-builder/hooks/useLayoutCrudModals'
import { useMobilePlacementEditor } from '@/features/rack-builder/hooks/useMobilePlacementEditor'
import { useDevicePaletteLibrary } from '@/features/rack-builder/hooks/useDevicePaletteLibrary'
import { findDepthConflict, isWithinBounds } from '@/features/rack-builder/lib/overlap'
import {
  canPlaceAtPosition,
  findPositionConflict,
  getItemSlot,
  getSlotStyle,
  preferenceToSlot,
} from '@/features/rack-builder/lib/rackPositions'
import type { DeviceFacing, LayoutItemWithDevice } from '@/features/rack-builder/types'
import { buildRackFaceViewModel } from '@/features/rack-builder/lib/rackViewModel'
import Button from '@/features/rack-builder/components/ui/Button'
import { useHaptic } from '@/features/rack-builder/contexts/HapticContext'
import DesktopEditorView from '@/features/rack-builder/components/editor/DesktopEditorView'
import MobileEditorView from '@/features/rack-builder/components/editor/MobileEditorView'
import {
  getTopU,
  visualColToLanePreference,
  computeMobileColumnRange,
  toFiniteNumber,
  describeSlot,
  toErrorMessage,
  parsePanelTemplateId,
  type RackViewMode,
  VIEW_MODE_OPTIONS,
  isSideViewMode,
} from '@/features/rack-builder/lib/layoutEditorHelpers'

export default function LayoutEditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [viewMode, setViewMode] = useState<RackViewMode>('front')
  const [notesItem, setNotesItem] = useState<LayoutItemWithDevice | null>(null)
  const [activeTab, setActiveTab] = useState<'devices' | 'rack'>('devices')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedDeviceTemplate, setSelectedDeviceTemplate] = useState<string | null>(null)
  const [showDeviceNames, setShowDeviceNames] = useState(true)
  const [simplifiedView, setSimplifiedView] = useState(false)
  const [mobileDualLane, setMobileDualLane] = useState<0 | 1>(0)
  const [hoverPlacementHint, setHoverPlacementHint] = useState<string | null>(null)
  const [placementErrorHint, setPlacementErrorHint] = useState<string | null>(null)
  const placementHint = placementErrorHint ?? hoverPlacementHint
  const { trigger: haptic } = useHaptic()

  const { isMobile, dndBackend, dndOptions } = useLayoutEditorViewport()
  const {
    zoomPercent,
    zoomFactor,
    canZoomOut,
    canZoomIn,
    handleZoomOut,
    handleZoomIn,
    handleZoomReset,
  } = useZoomControl()

  const { project, loading: projectLoading, error: projectError } = useProjectRecord(projectId)
  const {
    layouts,
    loading: layoutsLoading,
    createLayout,
    updateLayout,
    deleteLayout,
  } = useLayouts(projectId)
  const { racks, loading: racksLoading } = useRacks()
  const { connectorById } = useConnectors()
  const { devices, categories, loading: devicesLoading } = useDevices()
  const { panelLayouts } = usePanelLayouts(projectId)

  const activeLayoutId = searchParams.get('layout')
  const activeLayout = useMemo(
    () => layouts.find((entry) => entry.id === activeLayoutId) ?? null,
    [activeLayoutId, layouts],
  )

  const rackMap = useMemo(() => new Map(racks.map((rack) => [rack.id, rack])), [racks])
  const rack = useMemo(() => {
    if (!activeLayout) return null
    return rackMap.get(activeLayout.rack_id) ?? null
  }, [activeLayout, rackMap])

  const { items, addItem, addPanelLayoutItem, removeItem, moveItem, updateItemDetails } = useLayoutItems(
    activeLayout?.id,
    rack?.rack_units ?? 0,
  )
  const rackTotals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        weightKg: acc.weightKg + item.device.weight_kg,
        powerW: acc.powerW + item.device.power_w,
      }),
      { weightKg: 0, powerW: 0 },
    )
  }, [items])
  const fullProjectExportTitle = panelLayouts.length > 0
    ? 'Export the project cover, index, rack layouts, and panel layouts as one PDF.'
    : 'Export the project cover, index, and rack layouts as one PDF.'

  useEffect(() => {
    if (rack?.width !== 'dual') {
      setMobileDualLane(0)
    }
  }, [rack?.width])

  useEffect(() => {
    if (layouts.length === 0) return
    if (activeLayoutId && layouts.some((entry) => entry.id === activeLayoutId)) return

    const next = new URLSearchParams(searchParams)
    next.set('layout', layouts[0].id)
    setSearchParams(next, { replace: true })
  }, [activeLayoutId, layouts, searchParams, setSearchParams])

  const setActiveLayout = useCallback((layoutId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('layout', layoutId)
    setSearchParams(next)
  }, [searchParams, setSearchParams])

  const setRackViewMode = useCallback((nextViewMode: RackViewMode) => {
    setViewMode(nextViewMode)
    if (nextViewMode === 'front' || nextViewMode === 'rear') {
      setFacing(nextViewMode)
    }
  }, [])

  const cycleRackViewMode = useCallback(() => {
    const options = VIEW_MODE_OPTIONS.map((option) => option.value)
    const currentIndex = options.indexOf(viewMode)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length
    setRackViewMode(options[nextIndex])
  }, [setRackViewMode, viewMode])

  const isSideView = isSideViewMode(viewMode)
  const activeViewOption = VIEW_MODE_OPTIONS.find((option) => option.value === viewMode) ?? VIEW_MODE_OPTIONS[0]

  const {
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
  } = useLayoutCrudModals({ projectId, rack, racks, activeLayout, layouts, createLayout, updateLayout, deleteLayout, setActiveLayout })

  useEffect(() => {
    if (!isSideView) return
    if (selectedDeviceTemplate) setSelectedDeviceTemplate(null)
  }, [isSideView, selectedDeviceTemplate])

  useEffect(() => {
    if (!isSideView) return
    if (hoverPlacementHint) setHoverPlacementHint(null)
    if (placementErrorHint) setPlacementErrorHint(null)
  }, [hoverPlacementHint, isSideView, placementErrorHint])

  const {
    libraryCategories,
    brands,
    filteredDevices,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedBrand,
    setSelectedBrand,
    searchQuery,
    setSearchQuery,
  } = useDevicePaletteLibrary({
    devices,
    categories,
    panelLayouts,
    connectorById,
    selectedDeviceTemplate,
    onSelectedDeviceTemplateInvalid: () => setSelectedDeviceTemplate(null),
  })

  const showBackendPlacementReject = useCallback((actionLabel: string, error: unknown) => {
    const message = toErrorMessage(error)
    haptic('error')
    setPlacementErrorHint(`${actionLabel} rejected by backend: ${message}`)
  }, [haptic])

  const handleDropNew = async (
    deviceId: string,
    startU: number,
    rackUnits: number,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => {
    setPlacementErrorHint(null)
    try {
      const panelLayoutId = parsePanelTemplateId(deviceId)
      if (panelLayoutId) {
        const panelLayout = panelLayouts.find((entry) => entry.id === panelLayoutId)
        if (!panelLayout) return
        await addPanelLayoutItem(
          panelLayoutId,
          startU,
          facing,
          panelLayout.height_ru,
          preferredLane,
          preferredSubLane,
        )
        setPlacementErrorHint(null)
        return
      }
      await addItem(deviceId, startU, facing, rackUnits, preferredLane, preferredSubLane)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Drop failed:', err)
      showBackendPlacementReject('Placement', err)
    }
  }

  const handleDropMove = async (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => {
    setPlacementErrorHint(null)
    try {
      await moveItem(itemId, newStartU, facing, preferredLane, preferredSubLane)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Move failed:', err)
      showBackendPlacementReject('Move', err)
    }
  }

  const oppositeFacingItems = useMemo(
    () => items.filter((item) => item.facing !== facing),
    [items, facing],
  )
  const oppositeFacingSlotAssignments = useMemo(
    () => rack
      ? new Map(oppositeFacingItems.map((item) => [item.id, getItemSlot(item, rack.width)]))
      : new Map<string, ReturnType<typeof getItemSlot>>(),
    [oppositeFacingItems, rack],
  )
  const mobileRackView = useMemo(
    () => rack ? buildRackFaceViewModel(items, facing, rack.width) : null,
    [facing, items, rack],
  )
  const mobileItems = mobileRackView?.activeItems ?? []
  const mobileSlotAssignments =
    mobileRackView?.activeSlotByItemId ?? new Map<string, ReturnType<typeof getItemSlot>>()
  const mobileGhostItems = mobileRackView?.ghostItems ?? []
  const mobileGhostSlotAssignments =
    mobileRackView?.ghostSlotByItemId ?? new Map<string, ReturnType<typeof getItemSlot>>()

  const getPlacementIssue = useCallback((
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm = 0,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ): string | null => {
    if (!rack) return 'Rack is not available.'

    const normalizedSlotU = toFiniteNumber(slotU)
    const normalizedRackUnits = toFiniteNumber(rackUnits)
    if (
      normalizedSlotU === null
      || normalizedRackUnits === null
      || !isWithinBounds(normalizedSlotU, normalizedRackUnits, rack.rack_units)
    ) {
      return `Out of rack bounds: U${slotU} with ${rackUnits}U in a ${rack.rack_units}U rack.`
    }

    const targetSlot = preferenceToSlot(rack.width, isHalfRack && !forceFullWidth, preferredLane, preferredSubLane)
    const overlap = findPositionConflict(
      normalizedSlotU,
      normalizedRackUnits,
      targetSlot,
      mobileItems,
      rack.width,
      excludeItemId,
    )
    if (overlap) {
      const endU = overlap.startU + overlap.rackUnits - 1
      const conflictEndU = overlap.conflictingStartU + overlap.conflictingRackUnits - 1
      return `Same-side overlap in ${describeSlot(targetSlot, rack.width)}: U${overlap.startU}-U${endU} conflicts with ${overlap.conflictingItemName} at U${overlap.conflictingStartU}-U${conflictEndU}.`
    }

    const depthConflict = findDepthConflict(
      normalizedSlotU,
      normalizedRackUnits,
      facing,
      depthMm,
      rackEarOffsetMm,
      items,
      rack.depth_mm,
      excludeItemId,
      targetSlot,
      rack.width,
      oppositeFacingSlotAssignments,
    )
    if (depthConflict) {
      return `Depth conflict: ${depthConflict.currentDepthMm}mm + ${depthConflict.oppositeDepthMm}mm = ${depthConflict.combinedDepthMm}mm exceeds rack depth ${depthConflict.rackDepthMm}mm (${depthConflict.conflictingItemName}).`
    }

    return null
  }, [facing, items, mobileItems, oppositeFacingSlotAssignments, rack])

  const {
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
  } = useMobilePlacementEditor({
    items,
    updateItemDetails,
    removeItem,
    getPlacementIssue,
    onSaveSuccess: () => setPlacementErrorHint(null),
  })

  useEffect(() => {
    if (!isSideView) return
    if (selectedItemToMove) setSelectedItemToMove(null)
  }, [isSideView, selectedItemToMove, setSelectedItemToMove])

  const getDeviceAtU = useCallback((slotU: number, visualSlotIndex: number) => {
    if (!rack) return undefined

    const findAtPosition = (
      candidateItems: LayoutItemWithDevice[],
      slotById: Map<string, ReturnType<typeof getItemSlot>>,
      isGhost: boolean,
    ) => {
      const matched = candidateItems.find((item) => {
        if (slotU < item.start_u || slotU > getTopU(item)) return false
        const slot = slotById.get(item.id) ?? getItemSlot(item, rack.width)
        const { left, width } = getSlotStyle(slot, rack.width, facing)
        const { startCol, endCol } = computeMobileColumnRange(left, width, rack.width)
        return visualSlotIndex >= startCol && visualSlotIndex <= endCol
      })
      if (!matched) return undefined
      return { item: matched, isGhost }
    }

    return (
      findAtPosition(mobileItems, mobileSlotAssignments, false)
      ?? findAtPosition(mobileGhostItems, mobileGhostSlotAssignments, true)
    )
  }, [facing, mobileGhostItems, mobileGhostSlotAssignments, mobileItems, mobileSlotAssignments, rack])

  const handleMobileSlotClick = async (slotU: number, colIndex: number) => {
    if (!selectedDeviceTemplate || !rack) return
    const panelTemplateId = parsePanelTemplateId(selectedDeviceTemplate)
    if (panelTemplateId) {
      const panelLayout = panelLayouts.find((entry) => entry.id === panelTemplateId)
      if (!panelLayout) return
      const panelDepthMm = panelLayout.depth_mm
      if (!isWithinBounds(slotU, panelLayout.height_ru, rack.rack_units)) {
        haptic('error')
        setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${panelLayout.height_ru}U in a ${rack.rack_units}U rack.`)
        return
      }

      const { preferredLane, preferredSubLane } = visualColToLanePreference(
        colIndex, rack.width, facing, false,
      )
      const issue = getPlacementIssue(
        slotU,
        panelLayout.height_ru,
        false,
        false,
        panelDepthMm,
        0,
        undefined,
        preferredLane,
        preferredSubLane,
      )
      if (issue) {
        haptic('error')
        setPlacementErrorHint(issue)
        return
      }

      try {
        await addPanelLayoutItem(panelTemplateId, slotU, facing, panelLayout.height_ru, preferredLane, preferredSubLane)
        haptic('success')
        setSelectedDeviceTemplate(null)
        setPlacementErrorHint(null)
      } catch (err) {
        console.error('Tap placement failed:', err)
        showBackendPlacementReject('Placement', err)
      }
      return
    }

    const device = devices.find((entry) => entry.id === selectedDeviceTemplate)
    if (!device) return

    if (!isWithinBounds(slotU, device.rack_units, rack.rack_units)) {
      haptic('error')
      setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${device.rack_units}U in a ${rack.rack_units}U rack.`)
      return
    }

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, device.is_half_rack,
    )
    const issue = getPlacementIssue(
      slotU,
      device.rack_units,
      device.is_half_rack,
      false,
      device.depth_mm,
      0,
      undefined,
      preferredLane,
      preferredSubLane,
    )
    if (issue) {
      haptic('error')
      setPlacementErrorHint(issue)
      return
    }

    try {
      await addItem(device.id, slotU, facing, device.rack_units, preferredLane, preferredSubLane)
      haptic('success')
      setSelectedDeviceTemplate(null)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Tap placement failed:', err)
      showBackendPlacementReject('Placement', err)
    }
  }

  const handleMobileMoveToSlot = async (slotU: number, colIndex: number) => {
    if (!selectedItemToMove || !rack) return
    const item = items.find((i) => i.id === selectedItemToMove)
    if (!item) return

    if (!isWithinBounds(slotU, item.device.rack_units, rack.rack_units)) {
      haptic('error')
      setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${item.device.rack_units}U in a ${rack.rack_units}U rack.`)
      return
    }

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, item.device.is_half_rack,
    )
    const issue = getPlacementIssue(
      slotU,
      item.device.rack_units,
      item.device.is_half_rack,
      item.force_full_width,
      item.device.depth_mm,
      item.rack_ear_offset_mm,
      selectedItemToMove,
      preferredLane,
      preferredSubLane,
    )
    if (issue) {
      haptic('error')
      setPlacementErrorHint(issue)
      return
    }

    try {
      await moveItem(selectedItemToMove, slotU, facing, preferredLane, preferredSubLane)
      haptic('success')
      setSelectedItemToMove(null)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Tap move failed:', err)
      showBackendPlacementReject('Move', err)
    }
  }


  if (projectError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{projectError}</p>
          <Button onClick={() => navigate('/rack-builder/projects')}>Back to Projects</Button>
        </div>
      </div>
    )
  }

  if (projectLoading || layoutsLoading || racksLoading || !project || !activeLayout || !rack) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
    )
  }

  const slots = Array.from({ length: rack.rack_units }, (_, i) => rack.rack_units - i)
  const mobileColumnCount = 2
  const isDualRack = rack.width === 'dual'
  const mobileLaneOffset = isDualRack ? mobileDualLane * mobileColumnCount : 0

  const handleSaveNotes = async (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => {
    const item = items.find((i) => i.id === itemId)

    // When a half-rack device is being widened to full-column, verify it won't conflict
    if (updates.force_full_width === true && rack && item?.device.is_half_rack) {
      const widenedSlot = getItemSlot({ ...item, force_full_width: true }, rack.width)
      const sameFacing = items.filter((i) => i.id !== itemId && i.facing === item.facing)
      if (!canPlaceAtPosition(item.start_u, item.device.rack_units, widenedSlot, sameFacing, rack.width)) {
        throw new Error('Cannot span full width: another device occupies the adjacent half-rack slot at this position.')
      }
    }

    if (item && typeof updates.rack_ear_offset_mm === 'number' && updates.rack_ear_offset_mm !== item.rack_ear_offset_mm) {
      const issue = getPlacementIssue(
        item.start_u,
        item.device.rack_units,
        item.device.is_half_rack,
        updates.force_full_width ?? item.force_full_width,
        item.device.depth_mm,
        updates.rack_ear_offset_mm,
        item.id,
        item.preferred_lane ?? undefined,
        item.preferred_sub_lane ?? undefined,
      )
      if (issue) throw new Error(issue)
    }

    return updateItemDetails(itemId, updates)
  }

  const tabButtons = layouts.map((layoutEntry) => (
    <button
      key={layoutEntry.id}
      onClick={() => setActiveLayout(layoutEntry.id)}
      className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap border ${
        layoutEntry.id === activeLayout.id
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {layoutEntry.name}
    </button>
  ))

  if (!isMobile) {
    return (
      <DesktopEditorView
        dndBackend={dndBackend}
        dndOptions={dndOptions}
        filteredDevices={filteredDevices}
        libraryCategories={libraryCategories}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
        brands={brands}
        selectedBrand={selectedBrand}
        setSelectedBrand={setSelectedBrand}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        devicesLoading={devicesLoading}
        navigate={navigate}
        project={project}
        activeLayout={activeLayout}
        rack={rack}
        rackTotals={rackTotals}
        fullProjectExportTitle={fullProjectExportTitle}
        viewMode={viewMode}
        setRackViewMode={setRackViewMode}
        showDeviceNames={showDeviceNames}
        setShowDeviceNames={setShowDeviceNames}
        simplifiedView={simplifiedView}
        setSimplifiedView={setSimplifiedView}
        handleZoomOut={handleZoomOut}
        canZoomOut={canZoomOut}
        handleZoomReset={handleZoomReset}
        zoomPercent={zoomPercent}
        handleZoomIn={handleZoomIn}
        canZoomIn={canZoomIn}
        tabButtons={tabButtons}
        openCreateLayoutModal={openCreateLayoutModal}
        openRenameLayoutModal={openRenameLayoutModal}
        setDeleteLayoutOpen={setDeleteLayoutOpen}
        layouts={layouts}
        placementHint={placementHint}
        isSideView={isSideView}
        items={items}
        zoomFactor={zoomFactor}
        connectorById={connectorById}
        facing={facing}
        setHoverPlacementHint={setHoverPlacementHint}
        handleDropNew={handleDropNew}
        handleDropMove={handleDropMove}
        removeItem={removeItem}
        setNotesItem={setNotesItem}
        notesItem={notesItem}
        handleSaveNotes={handleSaveNotes}
        createLayoutOpen={createLayoutOpen}
        setCreateLayoutOpen={setCreateLayoutOpen}
        renameLayoutOpen={renameLayoutOpen}
        setRenameLayoutOpen={setRenameLayoutOpen}
        deleteLayoutOpen={deleteLayoutOpen}
        layoutNameDraft={layoutNameDraft}
        setLayoutNameDraft={setLayoutNameDraft}
        layoutRackDraft={layoutRackDraft}
        setLayoutRackDraft={setLayoutRackDraft}
        layoutStateDraft={layoutStateDraft}
        setLayoutStateDraft={setLayoutStateDraft}
        layoutSaving={layoutSaving}
        racks={racks}
        handleCreateLayout={handleCreateLayout}
        handleRenameLayout={handleRenameLayout}
        handleDeleteLayout={handleDeleteLayout}
      />
    )
  }

  return (
    <MobileEditorView
      navigate={navigate}
      project={project}
      activeLayout={activeLayout}
      layouts={layouts}
      setActiveLayout={setActiveLayout}
      cycleRackViewMode={cycleRackViewMode}
      activeViewOption={activeViewOption}
      isSideView={isSideView}
      selectedDeviceTemplate={selectedDeviceTemplate}
      selectedItemToMove={selectedItemToMove}
      setSelectedDeviceTemplate={setSelectedDeviceTemplate}
      setSelectedItemToMove={setSelectedItemToMove}
      setMobileOffsetDraft={setMobileOffsetDraft}
      mobileNameDraft={mobileNameDraft}
      setMobileNameDraft={setMobileNameDraft}
      mobileEditorError={mobileEditorError}
      setMobileEditorError={setMobileEditorError}
      mobileNotesDraft={mobileNotesDraft}
      setMobileNotesDraft={setMobileNotesDraft}
      mobileOffsetDraft={mobileOffsetDraft}
      handleMobileOffsetSave={handleMobileOffsetSave}
      handleMobileDeleteItem={handleMobileDeleteItem}
      placementHint={placementHint}
      isDualRack={isDualRack}
      mobileDualLane={mobileDualLane}
      setMobileDualLane={setMobileDualLane}
      rack={rack}
      items={items}
      viewMode={viewMode}
      showDeviceNames={showDeviceNames}
      slots={slots}
      mobileColumnCount={mobileColumnCount}
      getDeviceAtU={getDeviceAtU}
      handleMobileSlotClick={handleMobileSlotClick}
      handleMobileMoveToSlot={handleMobileMoveToSlot}
      mobileGhostSlotAssignments={mobileGhostSlotAssignments}
      mobileSlotAssignments={mobileSlotAssignments}
      facing={facing}
      haptic={haptic}
      simplifiedView={simplifiedView}
      mobileLaneOffset={mobileLaneOffset}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isSheetOpen={isSheetOpen}
      setIsSheetOpen={setIsSheetOpen}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedCategoryId={selectedCategoryId}
      setSelectedCategoryId={setSelectedCategoryId}
      libraryCategories={libraryCategories}
      selectedBrand={selectedBrand}
      setSelectedBrand={setSelectedBrand}
      brands={brands}
      filteredDevices={filteredDevices}
      openCreateLayoutModal={openCreateLayoutModal}
      openRenameLayoutModal={openRenameLayoutModal}
      setDeleteLayoutOpen={setDeleteLayoutOpen}
      setRackViewMode={setRackViewMode}
      setShowDeviceNames={setShowDeviceNames}
      setSimplifiedView={setSimplifiedView}
      fullProjectExportTitle={fullProjectExportTitle}
      rackTotals={rackTotals}
      notesItem={notesItem}
      handleSaveNotes={handleSaveNotes}
      setNotesItem={setNotesItem}
      createLayoutOpen={createLayoutOpen}
      setCreateLayoutOpen={setCreateLayoutOpen}
      renameLayoutOpen={renameLayoutOpen}
      setRenameLayoutOpen={setRenameLayoutOpen}
      deleteLayoutOpen={deleteLayoutOpen}
      layoutNameDraft={layoutNameDraft}
      setLayoutNameDraft={setLayoutNameDraft}
      layoutRackDraft={layoutRackDraft}
      setLayoutRackDraft={setLayoutRackDraft}
      layoutStateDraft={layoutStateDraft}
      setLayoutStateDraft={setLayoutStateDraft}
      layoutSaving={layoutSaving}
      racks={racks}
      handleCreateLayout={handleCreateLayout}
      handleRenameLayout={handleRenameLayout}
      handleDeleteLayout={handleDeleteLayout}
    />
  )
}
