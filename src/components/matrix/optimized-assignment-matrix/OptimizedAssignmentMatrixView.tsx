import React from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";

import { formatMadridDateKey } from "@/utils/timezoneUtils";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { TechnicianRow } from "../TechnicianRow";
import { OptimizedMatrixCell } from "../OptimizedMatrixCell";
import { DateHeader } from "../DateHeader";
import { MatrixDialogs } from "@/components/matrix/optimized-assignment-matrix/MatrixDialogs";
import type { MatrixCellAction } from "@/components/matrix/optimized-matrix-cell/types";

// Shared so cells for technicians with no declined jobs keep a stable prop.
const EMPTY_DECLINED_JOB_IDS: Set<string> = new Set<string>();

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
  handleCellClick: (technicianId: string, date: Date, action: MatrixCellAction, selectedJobId?: string) => void;
  handleCellPrefetch: (technicianId: string) => void;
  handleOptimisticUpdate: (technicianId: string, jobId: string, status: string) => void;
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
  isSendingStaffingEmail: boolean;
  cancelStaffing: any;
  isCancellingStaffing: boolean;
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
  isSendingStaffingEmail,
  cancelStaffing,
  isCancellingStaffing,
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
}: OptimizedAssignmentMatrixViewProps) => {
  void _isGlobalCellSelected;

  // DateHeader is memoized and runs queries keyed off these props; rebuilding
  // them inline per render defeated the memo and re-fired those queries.
  const technicianIds = React.useMemo(() => technicians.map((t) => t.id), [technicians]);
  const handleDateHeaderJobClick = React.useCallback(
    (jobId: string) => setSortJobId((prev) => (prev === jobId ? null : jobId)),
    [setSortJobId],
  );

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
        {/* overflow-hidden is a backstop: the corner is a fixed TECHNICIAN_WIDTH
            box, and anything that outgrows it spills across the borders into the
            first date column instead of being clipped. */}
        <div className="flex flex-col h-full overflow-hidden bg-card border-r border-b">
          <div className={`flex items-center justify-between border-b ${mobile ? "gap-0.5 px-0.5 py-0.5" : "px-2 py-1"}`}>
            <button
              className={`flex items-center gap-1 font-semibold hover:text-primary transition-colors cursor-pointer group ${mobile ? "min-w-0 flex-1 overflow-hidden" : ""}`}
              onClick={cycleTechSort}
              title="Cambia el orden de técnicos"
            >
              <span className={mobile ? "min-w-0 flex-1 truncate text-left text-xs" : ""}>Técnicos</span>
              <ArrowUpDown className={`shrink-0 opacity-50 group-hover:opacity-100 ${mobile ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
            </button>
            {isManagementUser &&
              (mobile ? (
                // A plain button, not <Button size="sm">: that variant carries its
                // own px-3/h-9 intrinsics, which overflowed this 109px corner even
                // with h-6 w-6 p-0 applied.
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-background"
                  onClick={() => setCreateUserOpen(true)}
                  aria-label="Añadir usuario"
                >
                  <UserPlus className="h-3 w-3" />
                </button>
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
                  <button
                    aria-label="Fechas anteriores"
                    className={`shrink-0 rounded-full bg-background border shadow-sm h-7 w-7 flex items-center justify-center ${canNavLeft ? "opacity-100" : "opacity-40"}`}
                    onClick={() => handleMobileNav("left")}
                    disabled={!canNavLeft}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    aria-label="Fechas siguientes"
                    className={`shrink-0 rounded-full bg-background border shadow-sm h-7 w-7 flex items-center justify-center ${canNavRight ? "opacity-100" : "opacity-40"}`}
                    onClick={() => handleMobileNav("right")}
                    disabled={!canNavRight}
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
              {getSortLabel() && (
                <span className="truncate text-xs font-medium text-muted-foreground bg-accent/50 px-2 py-0.5 rounded">
                  {getSortLabel()}
                </span>
              )}
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
        <div style={{ width: matrixWidth, height: "100%", display: "flex", position: "relative" }}>
          {/* Leading spacer for virtualized columns */}
          <div style={{ width: visibleCols.start * CELL_WIDTH }} />
          {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, idx) => (
            <DateHeader
              key={visibleCols.start + idx}
              date={date}
              width={CELL_WIDTH}
              jobs={getJobsForDate(date)}
              technicianIds={technicianIds}
              compact={mobile}
              onJobClick={handleDateHeaderJobClick}
            />
          ))}
          {/* Trailing spacer to fill remaining width */}
          <div style={{ width: Math.max(0, (dates.length - (visibleCols.end + 1)) * CELL_WIDTH) }} />
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
                      const cellKey = `${technician.id}-${formatMadridDateKey(date)}`;
                      const isSelected = selectedCells.has(cellKey);
                      const jobId = assignment?.job_id;
                      const byJobKey = jobId ? `${jobId}-${technician.id}` : "";
                      const byDateKey = cellKey;
                      const providedByJob =
                        jobId && staffingMaps?.byJob.get(byJobKey) ? (staffingMaps?.byJob.get(byJobKey) as any) : null;
                      const providedByDate = staffingMaps?.byDate.get(byDateKey)
                        ? (staffingMaps?.byDate.get(byDateKey) as any)
                        : null;

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
                            onSelect={handleCellSelect}
                            onClick={handleCellClick}
                            onPrefetch={handleCellPrefetch}
                            onOptimisticUpdate={handleOptimisticUpdate}
                            onRender={incrementCellRender}
                            jobId={jobId}
                            declinedJobIdsSet={declinedJobsByTech.get(technician.id) ?? EMPTY_DECLINED_JOB_IDS}
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
                            sendStaffingEmail={sendStaffingEmail}
                            isSendingStaffingEmail={isSendingStaffingEmail}
                            cancelStaffing={cancelStaffing}
                            isCancellingStaffing={isCancellingStaffing}
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
    </div>
  );
};
