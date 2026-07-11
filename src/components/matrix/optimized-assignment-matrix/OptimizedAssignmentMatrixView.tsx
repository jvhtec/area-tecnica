import React from "react";
import { format } from "date-fns";
import { ArrowUpDown, UserPlus } from "lucide-react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { TechnicianRow } from "../TechnicianRow";
import { OptimizedMatrixCell } from "../OptimizedMatrixCell";
import { DateHeader } from "../DateHeader";
import { MatrixDialogs } from "@/components/matrix/optimized-assignment-matrix/MatrixDialogs";
import { CoverageDateCell } from "@/components/matrix/lenses/CoverageDateCell";
import { LENS_HEADER_ROW_HEIGHT, type CellLensBadgeData, type MatrixLens, type TechnicianLensSummaryData } from "@/components/matrix/lenses/types";
import type { CoverageByDateDept, CoverageByJobDept } from "@/components/matrix/lenses/coverage";
import { formatEuro, type CostTotal } from "@/components/matrix/lenses/cost";
import { formatInTimeZone } from "date-fns-tz";
import type { DragSource } from "@/components/matrix/dnd/useMatrixDrag";
import type { DropValidity } from "@/components/matrix/dnd/dropValidity";
import type { PendingMove } from "@/components/matrix/dnd/useMoveAssignment";
import { MoveAssignmentConfirmDialog } from "@/components/matrix/dnd/MoveAssignmentConfirmDialog";

const MADRID_TIMEZONE = "Europe/Madrid";

export interface OptimizedAssignmentMatrixViewProps {
  isFetching: boolean;
  isInitialLoading: boolean;
  TECHNICIAN_WIDTH: number;
  HEADER_HEIGHT: number;
  CELL_WIDTH: number;
  CELL_HEIGHT: number;
  matrixWidth: number;
  matrixHeight: number;
  dateHeadersRef: React.RefObject<HTMLDivElement>;
  technicianScrollRef: React.RefObject<HTMLDivElement>;
  mainScrollRef: React.RefObject<HTMLDivElement>;
  visibleCols: { start: number; end: number };
  visibleRows: { start: number; end: number };
  dates: Date[];
  technicians: any[];
  orderedTechnicians: any[];
  fridgeSet?: Set<string>;
  allowDirectAssign: boolean;
  allowMarkUnavailable?: boolean;
  mobile: boolean;
  staffingDepartment?: string | null;
  hideStaffingEmailButtons?: boolean;
  hideStaffingWhatsappButtons?: boolean;
  canNavLeft: boolean;
  canNavRight: boolean;
  handleMobileNav: (dir: "left" | "right") => void;
  handleDateHeadersScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTechnicianScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleMainScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  cycleTechSort: () => void;
  getSortLabel: () => string;
  isManagementUser: boolean;
  setCreateUserOpen: (open: boolean) => void;
  createUserOpen: boolean;
  qc: any;
  setSortJobId: React.Dispatch<React.SetStateAction<string | null>>;
  getJobsForDate: (date: Date) => any[];
  getAssignmentForCell: (technicianId: string, date: Date) => any;
  getAvailabilityForCell: (technicianId: string, date: Date) => any;
  selectedCells: Set<string>;
  staffingMaps: any;
  profileNamesMap: Map<string, string>;
  handleCellSelect: (technicianId: string, date: Date, selected: boolean) => void;
  handleCellClick: (technicianId: string, date: Date, action: any, selectedJobId?: string) => void;
  handleCellPrefetch: (technicianId: string) => void;
  handleOptimisticUpdate: (technicianId: string, jobId: string, status: any) => void;
  incrementCellRender: () => void;
  declinedJobsByTech: Map<string, Set<string>>;
  cellAction: any;
  currentTechnician: any | null;
  closeDialogs: () => void;
  handleJobSelected: (jobId: string) => void;
  handleStaffingActionSelected: (jobId: string, action: 'availability' | 'offer', options?: { singleDay?: boolean }) => void;
  forcedStaffingAction: any;
  forcedStaffingChannel: any;
  jobs: any[];
  offerChannel: "email" | "whatsapp";
  toast: any;
  sendStaffingEmail: any;
  checkTimeConflictEnhanced: any;
  availabilityDialog: any;
  setAvailabilityDialog: (value: any) => void;
  availabilityCoverage: "full" | "single" | "multi";
  setAvailabilityCoverage: (value: "full" | "single" | "multi") => void;
  availabilitySingleDate: Date | null;
  setAvailabilitySingleDate: (value: Date | null) => void;
  availabilityMultiDates: Date[];
  setAvailabilityMultiDates: (value: Date[]) => void;
  availabilitySending: boolean;
  setAvailabilitySending: (value: boolean) => void;
  handleEmailError: (error: any, payload: any) => void;
  conflictDialog: any;
  setConflictDialog: (value: any) => void;
  // Roadmap P3-06 keeps this prop reserved for Stream Deck-aware matrix view integration.
  isGlobalCellSelected: (technicianId: string, date: Date) => boolean;
  techMedalRankings: Map<string, 'gold' | 'silver' | 'bronze'>;
  techLastYearMedalRankings: Map<string, 'gold' | 'silver' | 'bronze'>;
  BASE_HEADER_HEIGHT: number;
  lens: MatrixLens;
  onOpenStaffingOrchestrator?: (jobId: string, department: string, jobTitle: string) => void;
  coverageByDate: CoverageByDateDept;
  coverageByJob: CoverageByJobDept;
  costWindowTotal: CostTotal | null;
  costByDate: Map<string, CostTotal>;
  lensBadgeByCell: Map<string, CellLensBadgeData>;
  technicianLensSummaryByTech: Map<string, TechnicianLensSummaryData>;
  dragEnabled: boolean;
  dragSource: DragSource | null;
  dropTarget: { key: string; validity: DropValidity } | null;
  beginDrag: (technician: any, date: Date, assignment: any) => void;
  dragOverCell: (technicianId: string, date: Date) => void;
  clearDragOver: () => void;
  dropOnCell: (technician: any, date: Date) => void;
  endDrag: () => void;
  pendingMove: PendingMove | null;
  isMoving: boolean;
  cancelMove: () => void;
  commitMove: () => void;
}

const CostDateTotalCellComp = ({ date, width, costByDate }: { date: Date; width: number; costByDate: Map<string, CostTotal> }) => {
  const dateKey = formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
  const total = costByDate.get(dateKey);
  return (
    <div className="border-r flex-shrink-0 flex items-center justify-center" style={{ width, height: LENS_HEADER_ROW_HEIGHT }}>
      {total && total.amount > 0 ? (
        <span
          className="text-[10px] font-medium text-muted-foreground"
          title={`Aprobado: ${formatEuro(total.approved)}`}
        >
          {formatEuro(total.amount)}
        </span>
      ) : null}
    </div>
  );
};
const CostDateTotalCell = React.memo(CostDateTotalCellComp);

export const OptimizedAssignmentMatrixView: React.FC<OptimizedAssignmentMatrixViewProps> = ({
  isFetching,
  isInitialLoading,
  TECHNICIAN_WIDTH,
  HEADER_HEIGHT,
  CELL_WIDTH,
  CELL_HEIGHT,
  matrixWidth,
  matrixHeight,
  dateHeadersRef,
  technicianScrollRef,
  mainScrollRef,
  visibleCols,
  visibleRows,
  dates,
  technicians,
  orderedTechnicians,
  fridgeSet,
  allowDirectAssign,
  allowMarkUnavailable = false,
  mobile,
  staffingDepartment = null,
  hideStaffingEmailButtons = false,
  hideStaffingWhatsappButtons = false,
  canNavLeft,
  canNavRight,
  handleMobileNav,
  handleDateHeadersScroll,
  handleTechnicianScroll,
  handleMainScroll,
  cycleTechSort,
  getSortLabel,
  isManagementUser,
  setCreateUserOpen,
  createUserOpen,
  qc,
  setSortJobId,
  getJobsForDate,
  getAssignmentForCell,
  getAvailabilityForCell,
  selectedCells,
  staffingMaps,
  profileNamesMap,
  handleCellSelect,
  handleCellClick,
  handleCellPrefetch,
  handleOptimisticUpdate,
  incrementCellRender,
  declinedJobsByTech,
  cellAction,
  currentTechnician,
  closeDialogs,
  handleJobSelected,
  handleStaffingActionSelected,
  forcedStaffingAction,
  forcedStaffingChannel,
  jobs,
  offerChannel,
  toast,
  sendStaffingEmail,
  checkTimeConflictEnhanced,
  availabilityDialog,
  setAvailabilityDialog,
  availabilityCoverage,
  setAvailabilityCoverage,
  availabilitySingleDate,
  setAvailabilitySingleDate,
  availabilityMultiDates,
  setAvailabilityMultiDates,
  availabilitySending,
  setAvailabilitySending,
  handleEmailError,
  conflictDialog,
  setConflictDialog,
  isGlobalCellSelected: _isGlobalCellSelected,
  techMedalRankings,
  techLastYearMedalRankings,
  BASE_HEADER_HEIGHT,
  lens,
  onOpenStaffingOrchestrator,
  coverageByDate,
  coverageByJob,
  costWindowTotal,
  costByDate,
  lensBadgeByCell,
  technicianLensSummaryByTech,
  dragEnabled,
  dragSource,
  dropTarget,
  beginDrag,
  dragOverCell,
  clearDragOver,
  dropOnCell,
  endDrag,
  pendingMove,
  isMoving,
  cancelMove,
  commitMove,
}: OptimizedAssignmentMatrixViewProps) => {
  void _isGlobalCellSelected;
  const showLensHeaderRow = lens === "coverage" || lens === "cost";

  return (
    <div className="matrix-layout relative">
      {isFetching && !isInitialLoading && (
        <div className="pointer-events-none absolute top-2 right-4 flex items-center gap-2 text-xs text-muted-foreground bg-background/80 backdrop-blur rounded-full px-3 py-1 shadow-sm border border-border/60">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          <span>Actualizando...</span>
        </div>
      )}
      {/* Fixed Corner Header */}
      <div
        className="matrix-corner"
        style={{
          width: TECHNICIAN_WIDTH,
          height: HEADER_HEIGHT,
        }}
      >
        <div className="flex flex-col h-full bg-card border-r border-b">
          <div className="flex items-center justify-between px-2 py-1 border-b">
            <button
              className="flex items-center gap-1 font-semibold hover:text-primary transition-colors cursor-pointer group"
              onClick={cycleTechSort}
              title="Cambia el orden de técnicos"
            >
              {mobile ? <span className="text-sm">Técnicos</span> : <span>Técnicos</span>}
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
            </button>
            {isManagementUser &&
              (mobile ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setCreateUserOpen(true)}
                  aria-label="Añadir usuario"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setCreateUserOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Añadir
                </Button>
              ))}
          </div>
          {getSortLabel() && (
            <div className="flex items-center justify-center px-2 py-1 flex-1">
              <span className="text-xs font-medium text-muted-foreground bg-accent/50 px-2 py-0.5 rounded">
                {getSortLabel()}
              </span>
            </div>
          )}
          {lens === "cost" && costWindowTotal && (
            <div
              className="flex items-center justify-center border-t"
              style={{ height: LENS_HEADER_ROW_HEIGHT }}
              title="Suma de costes en la ventana visible (técnicos y fechas cargados), no el gasto total de la empresa"
            >
              <span className="text-[10px] font-medium text-muted-foreground">
                Total ventana: {formatEuro(costWindowTotal.amount)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Date Headers */}
      <div
        ref={dateHeadersRef}
        className="matrix-date-headers"
        style={{
          left: TECHNICIAN_WIDTH,
          height: HEADER_HEIGHT,
          width: `calc(100% - ${TECHNICIAN_WIDTH}px)`,
        }}
        onScroll={handleDateHeadersScroll}
      >
        {mobile && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-1">
            <button
              aria-label="Fechas anteriores"
              className={`pointer-events-auto rounded-full bg-background/80 border shadow h-8 w-8 flex items-center justify-center ${canNavLeft ? "opacity-100" : "opacity-40"}`}
              onClick={(e) => {
                e.stopPropagation();
                handleMobileNav("left");
              }}
              disabled={!canNavLeft}
            >
              <span className="sr-only">Anterior</span>
              {"<"}
            </button>
            <button
              aria-label="Fechas siguientes"
              className={`pointer-events-auto rounded-full bg-background/80 border shadow h-8 w-8 flex items-center justify-center ${canNavRight ? "opacity-100" : "opacity-40"}`}
              onClick={(e) => {
                e.stopPropagation();
                handleMobileNav("right");
              }}
              disabled={!canNavRight}
            >
              <span className="sr-only">Siguiente</span>
              {">"}
            </button>
          </div>
        )}
        <div style={{ width: matrixWidth, display: "flex", flexDirection: "column" }}>
          <div style={{ width: matrixWidth, height: BASE_HEADER_HEIGHT, display: "flex", position: "relative" }}>
            {/* Leading spacer for virtualized columns */}
            <div style={{ width: visibleCols.start * CELL_WIDTH }} />
            {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, idx) => (
              <DateHeader
                key={visibleCols.start + idx}
                date={date}
                width={CELL_WIDTH}
                jobs={getJobsForDate(date)}
                technicianIds={technicians.map((t) => t.id)}
                onJobClick={(jobId) => {
                  setSortJobId((prev) => (prev === jobId ? null : jobId));
                }}
                dragEnabled={dragEnabled}
              />
            ))}
            {/* Trailing spacer to fill remaining width */}
            <div style={{ width: Math.max(0, (dates.length - (visibleCols.end + 1)) * CELL_WIDTH) }} />
          </div>

          {showLensHeaderRow && (
            <div style={{ width: matrixWidth, height: LENS_HEADER_ROW_HEIGHT, display: "flex", position: "relative" }}>
              <div style={{ width: visibleCols.start * CELL_WIDTH }} />
              {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, idx) =>
                lens === "coverage" ? (
                  <CoverageDateCell
                    key={visibleCols.start + idx}
                    date={date}
                    width={CELL_WIDTH}
                    coverageByDate={coverageByDate}
                    coverageByJob={coverageByJob}
                    getJobsForDate={getJobsForDate}
                    onOpenStaffing={(jobId, department, jobTitle) => onOpenStaffingOrchestrator?.(jobId, department, jobTitle)}
                  />
                ) : (
                  <CostDateTotalCell key={visibleCols.start + idx} date={date} width={CELL_WIDTH} costByDate={costByDate} />
                ),
              )}
              <div style={{ width: Math.max(0, (dates.length - (visibleCols.end + 1)) * CELL_WIDTH) }} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed Technician Names Column */}
      <div
        className="matrix-technician-column"
        style={{
          width: TECHNICIAN_WIDTH,
          top: HEADER_HEIGHT,
          height: `calc(100% - ${HEADER_HEIGHT}px)`,
        }}
      >
        <div ref={technicianScrollRef} className="matrix-technician-scroll" onScroll={handleTechnicianScroll}>
          <div style={{ height: matrixHeight, position: "relative" }}>
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
                lensSummary={technicianLensSummaryByTech.get(technician.id) ?? null}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Scrollable Matrix Area */}
      <div
        className="matrix-main-area"
        style={{
          left: TECHNICIAN_WIDTH,
          top: HEADER_HEIGHT,
          width: `calc(100% - ${TECHNICIAN_WIDTH}px)`,
          height: `calc(100% - ${HEADER_HEIGHT}px)`,
        }}
      >
        <TooltipProvider>
          <div ref={mainScrollRef} className="matrix-main-scroll" onScroll={handleMainScroll}>
            <div className="matrix-grid" style={{ width: matrixWidth, height: matrixHeight }}>
              {orderedTechnicians.slice(visibleRows.start, visibleRows.end + 1).map((technician, idx) => {
                const techIndex = visibleRows.start + idx;
                return (
                  <div
                    key={technician.id}
                    className="matrix-row"
                    style={{ transform: `translate3d(0, ${techIndex * CELL_HEIGHT}px, 0)`, height: CELL_HEIGHT }}
                  >
                    {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, jdx) => {
                      const dateIndex = visibleCols.start + jdx;
                      const assignment = getAssignmentForCell(technician.id, date);
                      const availability = getAvailabilityForCell(technician.id, date);
                      const cellKey = `${technician.id}-${format(date, "yyyy-MM-dd")}`;
                      const isSelected = selectedCells.has(cellKey);
                      const jobId = assignment?.job_id;
                      const byJobKey = jobId ? `${jobId}-${technician.id}` : "";
                      const byDateKey = `${technician.id}-${format(date, "yyyy-MM-dd")}`;
                      const providedByJob =
                        jobId && staffingMaps?.byJob.get(byJobKey) ? (staffingMaps?.byJob.get(byJobKey) as any) : null;
                      const providedByDate = staffingMaps?.byDate.get(byDateKey)
                        ? (staffingMaps?.byDate.get(byDateKey) as any)
                        : null;
                      // Lens maps are keyed on the Madrid calendar day (matches the
                      // timesheet-backed data they're built from), independent of
                      // the browser's local timezone used by cellKey/byDateKey above.
                      const madridDateKey = formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
                      const lensCellKey = `${technician.id}-${madridDateKey}`;
                      const lensBadge = lensBadgeByCell.get(lensCellKey) ?? null;
                      const isDragSourceCell =
                        dragSource?.technicianId === technician.id && dragSource?.dateKey === madridDateKey;
                      const dropValidity = dropTarget?.key === lensCellKey ? dropTarget.validity : null;

                      return (
                        <div
                          key={dateIndex}
                          className="matrix-cell-wrapper"
                          style={{
                            transform: `translate3d(${dateIndex * CELL_WIDTH}px, 0, 0)`,
                            width: CELL_WIDTH,
                            height: CELL_HEIGHT,
                          }}
                        >
                          <OptimizedMatrixCell
                            technician={technician}
                            date={date}
                            assignment={assignment}
                            availability={availability}
                            width={CELL_WIDTH}
                            height={CELL_HEIGHT}
                            isSelected={isSelected}
                            onSelect={(selected) => handleCellSelect(technician.id, date, selected)}
                            onClick={(action, selectedJobId) =>
                              handleCellClick(technician.id, date, action, selectedJobId)
                            }
                            onPrefetch={() => handleCellPrefetch(technician.id)}
                            onOptimisticUpdate={(status) =>
                              assignment && handleOptimisticUpdate(technician.id, assignment.job_id, status)
                            }
                            onRender={() => incrementCellRender()}
                            jobId={jobId}
                            declinedJobIdsSet={declinedJobsByTech.get(technician.id) || new Set<string>()}
                            allowDirectAssign={allowDirectAssign}
                            allowMarkUnavailable={allowMarkUnavailable}
                            staffingStatusProvided={providedByJob}
                            staffingStatusByDateProvided={providedByDate}
                            profileNamesMap={profileNamesMap}
                            isFridge={fridgeSet?.has(technician.id) || false}
                            mobile={mobile}
                            staffingDepartment={staffingDepartment}
                            hideStaffingEmailButtons={hideStaffingEmailButtons}
                            hideStaffingWhatsappButtons={hideStaffingWhatsappButtons}
                            lensBadge={lensBadge}
                            dragEnabled={dragEnabled}
                            isDragSource={isDragSourceCell}
                            dropValidity={dropValidity}
                            onDragStartCell={() => beginDrag(technician, date, assignment)}
                            onDragOverCell={() => dragOverCell(technician.id, date)}
                            onDragLeaveCell={() => clearDragOver()}
                            onDropCell={() => dropOnCell(technician, date)}
                            onDragEndCell={() => endDrag()}
                            onDropJobCell={(jobId) => handleCellClick(technician.id, date, "assign", jobId)}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      </div>

      <MatrixDialogs
        cellAction={cellAction}
        currentTechnician={currentTechnician}
        closeDialogs={closeDialogs}
        handleJobSelected={handleJobSelected}
        handleStaffingActionSelected={handleStaffingActionSelected}
        forcedStaffingAction={forcedStaffingAction}
        forcedStaffingChannel={forcedStaffingChannel}
        getJobsForDate={getJobsForDate}
        declinedJobsByTech={declinedJobsByTech}
        jobs={jobs}
        staffingDepartment={staffingDepartment}
        offerChannel={offerChannel}
        toast={toast}
        sendStaffingEmail={sendStaffingEmail}
        checkTimeConflictEnhanced={checkTimeConflictEnhanced}
        availabilityDialog={availabilityDialog}
        setAvailabilityDialog={setAvailabilityDialog}
        availabilityCoverage={availabilityCoverage}
        setAvailabilityCoverage={setAvailabilityCoverage}
        availabilitySingleDate={availabilitySingleDate}
        setAvailabilitySingleDate={setAvailabilitySingleDate}
        availabilityMultiDates={availabilityMultiDates}
        setAvailabilityMultiDates={setAvailabilityMultiDates}
        availabilitySending={availabilitySending}
        setAvailabilitySending={setAvailabilitySending}
        handleEmailError={handleEmailError}
        conflictDialog={conflictDialog}
        setConflictDialog={setConflictDialog}
        selectedCells={selectedCells}
        isManagementUser={isManagementUser}
        createUserOpen={createUserOpen}
        setCreateUserOpen={setCreateUserOpen}
        qc={qc}
      />

      <MoveAssignmentConfirmDialog
        pendingMove={pendingMove}
        isMoving={isMoving}
        onCancel={cancelMove}
        onConfirm={commitMove}
      />
    </div>
  );
};
