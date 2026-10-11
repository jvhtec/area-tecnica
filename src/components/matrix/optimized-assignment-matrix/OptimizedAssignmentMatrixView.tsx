import React from "react";
import { ArrowUpDown, CalendarCheck, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";

import { formatMadridDateKey, isMadridToday } from "@/utils/timezoneUtils";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { TechnicianRow } from "../TechnicianRow";
import { DateHeader } from "../DateHeader";
import { MatrixGridRow } from "@/components/matrix/optimized-assignment-matrix/MatrixGridRow";
import { useMatrixScrollState } from "@/components/matrix/optimized-assignment-matrix/useMatrixScrollState";
import type { DateHeaderCounts } from "@/hooks/useMatrixHeaderCounts";
import {
  MatrixCellHoverTooltip,
  type MatrixCellHoverTooltipHandle,
} from "@/components/matrix/optimized-assignment-matrix/MatrixCellHoverTooltip";
import { formatUserName } from "@/utils/userName";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { queryKeys } from "@/lib/react-query";
import { MatrixInspectorHost } from "@/features/matrix-v2/inspector/MatrixInspectorHost";
import type { MatrixV2ViewConfig } from "@/features/matrix-v2/viewConfig";
import { useMatrixGridV2 } from "@/features/matrix-v2/useMatrixGridV2";
import { MatrixShortcutHelp } from "@/features/matrix-v2/keyboard/MatrixShortcutHelp";
import { FocusColumnOverlay } from "@/features/matrix-v2/focus/FocusColumnOverlay";
import { BatchLayer } from "@/features/matrix-v2/batch/BatchLayer";
import { useSelectionDerivations } from "./useSelectionDerivations";
import { SelectionOverlay } from "@/features/matrix-v2/batch/SelectionOverlay";
import type { CancelStaffingAsync, SendStaffingEmailAsync } from "@/components/matrix/optimized-matrix-cell/types";

export interface OptimizedAssignmentMatrixViewProps {
  isFetching: boolean;
  isInitialLoading: boolean;
  TECHNICIAN_WIDTH: number;
  HEADER_HEIGHT: number;
  CELL_WIDTH: number;
  CELL_HEIGHT: number;
  matrixWidth: number;
  matrixHeight: number;
  /** The date range can grow at either end as the user nears it. */
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  onNearEdgeScroll?: (direction: "before" | "after") => void;
  /** Reports the virtualised row window (the staffing badges load per block). */
  onVisibleRowsChange?: (rows: { start: number; end: number }) => void;
  dates: Date[];
  technicians: any[];
  orderedTechnicians: any[];
  fridgeSet?: Set<string>;
  mobile: boolean;
  staffingDepartment?: string | null;
  cycleTechSort: () => void;
  getSortLabel: () => string;
  isManagementUser: boolean;
  setCreateUserOpen: (open: boolean) => void;
  createUserOpen: boolean;
  qc: any;
  getJobsForDate: (date: Date) => any[];
  getHeaderCounts?: (date: Date) => DateHeaderCounts;
  getAssignmentForCell: (technicianId: string, date: Date) => any;
  getAvailabilityForCell: (technicianId: string, date: Date) => any;
  selectedCells: Set<string>;
  staffingMaps: any;
  profileNamesMap: Map<string, string>;
  handleCellSelect: (technicianId: string, date: Date, selected: boolean) => void;
  handleCellPrefetch: (technicianId: string) => void;
  incrementCellRender: () => void;
  declinedJobsByTech: Map<string, Set<string>>;
  jobs: any[];
  /** Each call has its own promise, which `mutate`'s per-call callbacks do not (only the latest call's fire). */
  sendStaffingEmailAsync: SendStaffingEmailAsync;
  cancelStaffingAsync: CancelStaffingAsync;
  techMedalRankings: Map<string, 'gold' | 'silver' | 'bronze'>;
  techLastYearMedalRankings: Map<string, 'gold' | 'silver' | 'bronze'>;
  clearCellSelection: () => void;
  /** Replaces the selection wholesale (drag and shift-click ranges). */
  onReplaceSelection: (keys: Set<string>) => void;
  /** Whose remembered staffing channel the composer uses. */
  staffingUserId?: string | null;
  /** The inspector, job focus and batch state, owned by the container. */
  v2: MatrixV2ViewConfig;
}

export const OptimizedAssignmentMatrixView: React.FC<OptimizedAssignmentMatrixViewProps> = ({
  isFetching,
  isInitialLoading,
  TECHNICIAN_WIDTH,
  HEADER_HEIGHT,
  CELL_WIDTH,
  CELL_HEIGHT,
  matrixWidth,
  matrixHeight,
  canExpandBefore = false,
  canExpandAfter = false,
  onNearEdgeScroll,
  onVisibleRowsChange,
  dates,
  technicians,
  orderedTechnicians,
  fridgeSet,
  mobile,
  staffingDepartment = null,
  cycleTechSort,
  getSortLabel,
  isManagementUser,
  setCreateUserOpen,
  createUserOpen,
  qc,
  getJobsForDate,
  getHeaderCounts,
  getAssignmentForCell,
  getAvailabilityForCell,
  selectedCells,
  staffingMaps,
  profileNamesMap,
  handleCellSelect,
  handleCellPrefetch,
  incrementCellRender,
  declinedJobsByTech,
  jobs,
  sendStaffingEmailAsync,
  cancelStaffingAsync,
  techMedalRankings,
  techLastYearMedalRankings,
  clearCellSelection,
  onReplaceSelection,
  staffingUserId,
  v2,
}: OptimizedAssignmentMatrixViewProps) => {
  // Scroll position and the virtualised window are owned here rather than by
  // the matrix container, so a scroll step re-renders this view alone.
  const {
    dateHeadersRef,
    technicianScrollRef,
    mainScrollRef,
    visibleCols,
    visibleRows,
    canNavLeft,
    canNavRight,
    handleMobileNav,
    handleMainScroll,
  } = useMatrixScrollState({
    dates,
    techniciansLength: orderedTechnicians.length,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    technicianWidth: TECHNICIAN_WIDTH,
    headerHeight: HEADER_HEIGHT,
    mobile,
    isInitialLoading,
    canExpandBefore,
    canExpandAfter,
    onNearEdgeScroll,
  });

  React.useEffect(() => {
    onVisibleRowsChange?.(visibleRows);
  }, [onVisibleRowsChange, visibleRows]);

  // One inspector for the grid, whose state the container owns so the cell
  // buttons and the keyboard can open it too. Desktop anchors it to the clicked
  // cell; a phone gets the same content as a bottom sheet (no anchor).
  const keyboardHintId = React.useId();

  const selectionActive = mobile && selectedCells.size > 0;
  const { inspectorTarget, closeInspector } = v2;

  const { selectedDateKeysByTech } = useSelectionDerivations(selectedCells);

  // Anchored to the viewport, not to this layout: the matrix container runs past
  // the fold on a phone, so an absolutely positioned control at its bottom edge
  // lands off-screen. The offset clears the app's fixed bottom nav and the home
  // indicator below it.
  const floatingBottom = 'calc(4.75rem + env(safe-area-inset-bottom))';

  const scrollToToday = React.useCallback(() => {
    const index = dates.findIndex((date) => isMadridToday(date));
    if (index < 0 || !mainScrollRef.current) return;
    mainScrollRef.current.scrollTo({ left: index * CELL_WIDTH, behavior: "smooth" });
  }, [dates, mainScrollRef, CELL_WIDTH]);

  // The rendered column window. Memoised on the window itself, so a vertical
  // scroll step hands every row the same arrays and their memo holds.
  const visibleDates = React.useMemo(
    () => dates.slice(visibleCols.start, visibleCols.end + 1),
    [dates, visibleCols.start, visibleCols.end],
  );
  const visibleDateKeys = React.useMemo(() => visibleDates.map((date) => formatMadridDateKey(date)), [visibleDates]);

  // Shared hover tooltip (see MatrixCellHoverTooltip): cells only carry data
  // attributes, and the content is resolved here from the grid's current data.
  const hoverTooltipRef = React.useRef<MatrixCellHoverTooltipHandle>(null);
  const techniciansById = React.useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const datesByKey = React.useMemo(() => new Map(dates.map((date) => [formatMadridDateKey(date), date])), [dates]);
  const resolveCellTooltip = React.useCallback(
    (technicianId: string, dateKey: string) => {
      const technician = techniciansById.get(technicianId);
      const date = datesByKey.get(dateKey);
      if (!technician || !date) return null;
      const assignment = getAssignmentForCell(technicianId, date);
      const availability = getAvailabilityForCell(technicianId, date);
      return {
        displayName: formatUserName(technician.first_name, technician.nickname, technician.last_name) || "Técnico",
        technician,
        hasAssignment: !!assignment,
        assignment,
        isUnavailable: availability?.status === "unavailable",
        availability,
        staffingStatusByDate: staffingMaps?.byDate.get(`${technicianId}-${dateKey}`) ?? null,
        profileNamesMap,
      };
    },
    [techniciansById, datesByKey, getAssignmentForCell, getAvailabilityForCell, staffingMaps, profileNamesMap],
  );
  const handleGridMouseOver = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-matrix-cell]");
    hoverTooltipRef.current?.hover(cell);
  }, []);
  const hideCellTooltip = React.useCallback(() => hoverTooltipRef.current?.hide(), []);
  const handleGridScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      hoverTooltipRef.current?.hide();
      handleMainScroll(event);
    },
    [handleMainScroll],
  );

  // Matrix v2: the inspector's environment, the keyboard model and its actions.
  const v2Grid = useMatrixGridV2({
    v2,
    mobile,
    technicians,
    orderedTechnicians,
    dates,
    jobs,
    getJobsForDate,
    getAssignmentForCell,
    getAvailabilityForCell,
    declinedJobsByTech,
    fridgeSet,
    staffingMaps,
    profileNamesMap,
    isManagementUser,
    grid: { cellWidth: CELL_WIDTH, cellHeight: CELL_HEIGHT, technicianWidth: TECHNICIAN_WIDTH, headerHeight: HEADER_HEIGHT },
    scrollRef: mainScrollRef,
    selectedCells,
    clearSelection: clearCellSelection,
    onReplaceSelection,
    sendStaffingEmail: sendStaffingEmailAsync,
    cancelStaffing: cancelStaffingAsync,
    staffingDepartment: staffingDepartment ?? null,
    staffingUserId: staffingUserId ?? null,
  });
  const { inspectorEnv, keyboard, onInspect: handleInspectAndActivate, focus, focusOverlay, gridHandlers, previewRects, batchLayer } = v2Grid;

  // The cell's ✓ and ✕: confirming is immediate (with Deshacer), declining asks first in the inspector.
  const { quickConfirm, openInspector } = v2;
  const handleConfirm = React.useCallback((technicianId: string, date: Date) => quickConfirm(technicianId, date), [quickConfirm]);
  const handleDecline = React.useCallback((technicianId: string, date: Date) => openInspector(technicianId, date, null, "decline"), [openInspector]);

  // DateHeader is memoized and runs queries keyed off these props; rebuilding
  // them inline per render defeated the memo and re-fired those queries.
  const technicianIds = React.useMemo(() => technicians.map((t) => t.id), [technicians]);
  const handleDateHeaderJobClick = React.useCallback(
    // The header's job row focuses the job.
    (jobId: string) => v2.toggleFocusJob(jobId),
    [v2],
  );

  return (
    <div className="matrix-layout relative">
      {isFetching && !isInitialLoading && (
        <div className="pointer-events-none absolute bottom-3 right-4 z-[60] flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-lg backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          <span>Actualizando...</span>
        </div>
      )}
      {/* One scroll container. The date header row and the technician column
          are sticky inside it, so the browser keeps them aligned with the grid
          on the compositor: no scroll sync in JavaScript, and they cannot trail
          the grid when the main thread is busy. */}
      <TooltipProvider>
        <div
          ref={mainScrollRef}
          className="matrix-main-scroll"
          onScroll={handleGridScroll}
          {...(!mobile
            ? {
              tabIndex: 0,
              role: "application",
              "aria-label": "Matriz de asignaciones",
              "aria-describedby": keyboardHintId,
              "aria-activedescendant": keyboard.activeDescendant,
              "data-matrix-grid": "true",
              onKeyDown: keyboard.onKeyDown,
              onFocus: keyboard.onFocus,
            }
            : {})}
        >
          <div
            className="matrix-canvas"
            style={{ width: TECHNICIAN_WIDTH + matrixWidth, height: HEADER_HEIGHT + matrixHeight }}
          >
            {/* Header row, sticky to the top: the frozen corner, then the dates. */}
            <div className="matrix-header-row" style={{ width: TECHNICIAN_WIDTH + matrixWidth, height: HEADER_HEIGHT }}>
              <div
                className="matrix-corner"
                style={{
                  width: TECHNICIAN_WIDTH,
                  height: HEADER_HEIGHT,
                }}
              >
                {/* overflow-hidden is a backstop: the corner is a fixed TECHNICIAN_WIDTH
                    box, and anything that outgrows it spills across the borders into the
                    first date column instead of being clipped. */}
                <div className="flex flex-col h-full overflow-hidden bg-card border-r border-b">
                  <div className={`flex border-b border-border/60 ${mobile ? "items-stretch gap-0.5 px-0.5 py-0.5" : "items-center justify-between px-2 py-1"}`}>
                    {/* size="inline" so the primitive adds no box of its own: this row
                        is 28px tall on a phone, and the default size's h-10 plus its
                        44px hit pseudo-element would both overflow the corner and
                        overlap the control beside it. */}
                    <Button
                      variant="ghost"
                      size="inline"
                      className={`group flex cursor-pointer items-center gap-1 font-semibold hover:bg-transparent hover:text-primary ${
                        mobile
                          ? // min-h-6 is a floor, not a change: items-stretch on the row
                            // already gives this 24px. But it gets that by matching the
                            // height of the button beside it, so shrinking that one
                            // would silently drop this under the 24px WCAG minimum.
                            "min-h-6 min-w-0 flex-1 justify-start overflow-hidden [&_svg]:size-3"
                          : "[&_svg]:size-3.5"
                      }`}
                      onClick={cycleTechSort}
                      title="Cambia el orden de técnicos"
                    >
                      <span
                        className={
                          mobile
                            ? "min-w-0 flex-1 truncate text-left text-xs"
                            : "text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        }
                      >
                        Técnicos
                      </span>
                      <ArrowUpDown className="shrink-0 opacity-50 group-hover:opacity-100" />
                    </Button>
                    {isManagementUser &&
                      (mobile ? (
                        // icon-xs, not sm: the sm variant's px-3/h-9 intrinsics
                        // overflowed this 109px corner even with h-6 w-6 p-0 applied.
                        // hit-target-fill grows the tap area to this cell rather than
                        // to 44px, which at this pitch would overlap the sort control.
                        <span className="relative flex shrink-0 items-center">
                          <Button
                            variant="outline"
                            size="icon-xs"
                            className="hit-target-fill shrink-0"
                            onClick={() => setCreateUserOpen(true)}
                            aria-label="Añadir usuario"
                          >
                            <UserPlus />
                          </Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setCreateUserOpen(true)}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Añadir
                        </Button>
                      ))}
                  </div>
                  {(mobile || getSortLabel()) && (
                    <div className={`flex items-center justify-center flex-1 min-h-0 px-1 ${mobile ? "gap-1 py-0.5" : "gap-2 py-1"}`}>
                      {/* Mobile date paging. It used to be an overlay inside the header's
                          scroll container, which both scrolled away with the content and
                          covered the first and last visible columns. */}
                      {mobile && (
                        <>
                          {/* Each arrow sits in its own stretched flex cell so its tap
                              area fills that cell. The cells tile the row, so the two
                              targets meet without overlapping — the 44px pseudo-element
                              the default sizes carry would overlap at this pitch. */}
                          <span className="relative flex flex-1 items-center justify-center self-stretch">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Fechas anteriores"
                              className={`hit-target-fill shrink-0 rounded-full shadow-sm ${canNavLeft ? "opacity-100" : "opacity-40"}`}
                              onClick={() => handleMobileNav("left")}
                              disabled={!canNavLeft}
                            >
                              <ChevronLeft aria-hidden="true" />
                            </Button>
                          </span>
                          <span className="relative flex flex-1 items-center justify-center self-stretch">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Fechas siguientes"
                              className={`hit-target-fill shrink-0 rounded-full shadow-sm ${canNavRight ? "opacity-100" : "opacity-40"}`}
                              onClick={() => handleMobileNav("right")}
                              disabled={!canNavRight}
                            >
                              <ChevronRight aria-hidden="true" />
                            </Button>
                          </span>
                        </>
                      )}
                      {getSortLabel() && (
                        <span className="truncate rounded-full border border-border/60 bg-accent/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {getSortLabel()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={dateHeadersRef}
                className="matrix-date-headers"
                style={{ width: matrixWidth, height: HEADER_HEIGHT }}
              >
                {/* Leading spacer for virtualized columns */}
                <div style={{ width: visibleCols.start * CELL_WIDTH, flexShrink: 0 }} />
                {visibleDates.map((date, idx) => {
                  const counts = getHeaderCounts?.(date);
                  return (
                    <DateHeader
                      key={visibleCols.start + idx}
                      date={date}
                      width={CELL_WIDTH}
                      jobs={getJobsForDate(date)}
                      technicianIds={technicianIds}
                      confirmedCount={counts?.confirmed}
                      openSlots={counts?.openSlots}
                      compact={mobile}
                      onJobClick={handleDateHeaderJobClick}
                    />
                  );
                })}
              </div>
              {focusOverlay && (
                <FocusColumnOverlay
                  part="header"
                  {...focusOverlay}
                  cellWidth={CELL_WIDTH}
                  technicianWidth={TECHNICIAN_WIDTH}
                  headerHeight={HEADER_HEIGHT}
                  bodyHeight={matrixHeight}
                />
              )}
            </div>

            <div className="matrix-body" style={{ width: TECHNICIAN_WIDTH + matrixWidth, height: matrixHeight }}>
              {/* Technician names, sticky to the left. */}
              <div
                ref={technicianScrollRef}
                className="matrix-technician-column"
                style={{ width: TECHNICIAN_WIDTH, height: matrixHeight }}
              >
                {/* Leading spacer for virtualized rows */}
                <div style={{ height: visibleRows.start * CELL_HEIGHT }} />
                {orderedTechnicians.slice(visibleRows.start, visibleRows.end + 1).map((technician) => (
                  <TechnicianRow
                    key={technician.id}
                    technician={technician}
                    height={CELL_HEIGHT}
                    isFridge={fridgeSet?.has(technician.id) || false}
                    // @ts-ignore – optional prop for compact rendering
                    compact={mobile}
                    medalRank={techMedalRankings.get(technician.id)}
                    lastYearMedalRank={techLastYearMedalRankings.get(technician.id)}
                    focusFit={focus?.fits.get(technician.id)}
                    onFocusAssign={focus?.onNameClick}
                  />
                ))}
              </div>

              <div
                className="matrix-grid"
                style={{ width: matrixWidth, height: matrixHeight }}
                onMouseOver={mobile ? undefined : handleGridMouseOver}
                onMouseLeave={mobile ? undefined : hideCellTooltip}
                onMouseDown={mobile ? undefined : hideCellTooltip}
                {...gridHandlers}
              >
                {orderedTechnicians.slice(visibleRows.start, visibleRows.end + 1).map((technician, idx) => (
                  <MatrixGridRow
                    key={technician.id}
                    technician={technician}
                    rowIndex={visibleRows.start + idx}
                    colStart={visibleCols.start}
                    visibleDates={visibleDates}
                    visibleDateKeys={visibleDateKeys}
                    cellWidth={CELL_WIDTH}
                    cellHeight={CELL_HEIGHT}
                    getAssignmentForCell={getAssignmentForCell}
                    getAvailabilityForCell={getAvailabilityForCell}
                    staffingMaps={staffingMaps}
                    selectedDateKeys={selectedDateKeysByTech.get(technician.id)}
                    selectionActive={selectionActive}
                    isFridge={fridgeSet?.has(technician.id) || false}
                    mobile={mobile}
                    onSelect={handleCellSelect}
                    onInspect={handleInspectAndActivate}
                    onConfirm={handleConfirm}
                    onDecline={handleDecline}
                    onPrefetch={handleCellPrefetch}
                    onRender={incrementCellRender}
                  />
                ))}
              </div>
            </div>
            {focusOverlay && (
              <FocusColumnOverlay
                part="body"
                {...focusOverlay}
                cellWidth={CELL_WIDTH}
                technicianWidth={TECHNICIAN_WIDTH}
                headerHeight={HEADER_HEIGHT}
                bodyHeight={matrixHeight}
              />
            )}
            {previewRects.length > 0 && (
              <SelectionOverlay rects={previewRects} cellWidth={CELL_WIDTH} cellHeight={CELL_HEIGHT} technicianWidth={TECHNICIAN_WIDTH} headerHeight={HEADER_HEIGHT} />
            )}
            {keyboard.ring && (
              <div
                aria-hidden="true"
                data-matrix-active-ring="true"
                className="pointer-events-none absolute z-[25] rounded-md ring-2 ring-primary ring-offset-1 ring-offset-background"
                style={{ left: keyboard.ring.left, top: keyboard.ring.top, width: keyboard.ring.width, height: keyboard.ring.height }}
              />
            )}
          </div>
        </div>
      </TooltipProvider>

      {!mobile && (
        <>
          <p id={keyboardHintId} className="sr-only">
            Usa las flechas para moverte por la matriz, Intro para abrir una celda y ? para ver los atajos.
          </p>
          <div role="status" aria-live="polite" className="sr-only">{keyboard.announcement}</div>
        </>
      )}

      {!mobile && <MatrixCellHoverTooltip ref={hoverTooltipRef} resolve={resolveCellTooltip} />}

      {/* Touch affordances over the grid */}
      {mobile && !selectionActive && (
        // The wrapper carries the positioning: Button's size variants add
        // `coarse-hit-target`, whose `position: relative` wins over a `fixed`
        // utility on a coarse pointer.
        <div className="fixed z-30" style={{ left: TECHNICIAN_WIDTH + 8, bottom: floatingBottom }}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={scrollToToday}
            className="h-9 gap-1.5 rounded-full border px-3 shadow-lg"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold">Hoy</span>
          </Button>
        </div>
      )}

      <BatchLayer {...batchLayer} />

      {inspectorEnv && (
        <MatrixInspectorHost env={inspectorEnv} target={inspectorTarget} onClose={closeInspector} mobile={mobile} />
      )}
      {!mobile && <MatrixShortcutHelp open={keyboard.helpOpen} onOpenChange={keyboard.setHelpOpen} />}

      {isManagementUser && (
        <CreateUserDialog
          open={createUserOpen}
          onOpenChange={(open) => {
            if (!open) {
              qc.invalidateQueries({ queryKey: queryKeys.scope("optimized-matrix-technicians") });
            }
            setCreateUserOpen(open);
          }}
        />
      )}
    </div>
  );
};
