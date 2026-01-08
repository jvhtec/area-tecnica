import React from "react";
import { format } from "date-fns";
import { ArrowUpDown, Calendar as CalendarIcon, UserPlus } from "lucide-react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";

import { TechnicianRow } from "../TechnicianRow";
import { OptimizedMatrixCell } from "../OptimizedMatrixCell";
import { DateHeader } from "../DateHeader";
import { SelectJobDialog } from "../SelectJobDialog";
import { StaffingJobSelectionDialog } from "../StaffingJobSelectionDialog";
import { AssignJobDialog } from "../AssignJobDialog";
import { AssignmentStatusDialog } from "../AssignmentStatusDialog";
import { MarkUnavailableDialog } from "../MarkUnavailableDialog";
import { OfferDetailsDialog } from "../OfferDetailsDialog";

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
  mobile: boolean;
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
  handleStaffingActionSelected: (args: any) => void;
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
  isGlobalCellSelected: (technicianId: string, date: Date) => boolean;
  techMedalRankings: Map<string, 'gold' | 'silver' | 'bronze'>;
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
  mobile,
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
  isGlobalCellSelected,
  techMedalRankings,
}: OptimizedAssignmentMatrixViewProps) => {
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
        <div style={{ width: matrixWidth, height: "100%", display: "flex", position: "relative" }}>
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
                            staffingStatusProvided={providedByJob}
                            staffingStatusByDateProvided={providedByDate}
                            isFridge={fridgeSet?.has(technician.id) || false}
                            mobile={mobile}
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

      {/* Dialogs */}
      {cellAction?.type === "select-job" && currentTechnician && (
        <SelectJobDialog
          open={true}
          onClose={closeDialogs}
          onJobSelected={handleJobSelected}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
        />
      )}

      {cellAction?.type === "select-job-for-staffing" && currentTechnician && (
        <StaffingJobSelectionDialog
          open={true}
          onClose={closeDialogs}
          onStaffingActionSelected={handleStaffingActionSelected}
          technicianId={cellAction.technicianId}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
          declinedJobIds={Array.from(declinedJobsByTech.get(cellAction.technicianId) || [])}
          preselectedJobId={cellAction.selectedJobId || null}
          forcedAction={forcedStaffingAction}
          forcedChannel={forcedStaffingChannel}
        />
      )}

      {cellAction?.type === "assign" && (
        <AssignJobDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
          existingAssignment={cellAction.assignment}
          preSelectedJobId={cellAction.selectedJobId}
        />
      )}

      {(cellAction?.type === "confirm" || cellAction?.type === "decline") && (
        <AssignmentStatusDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          assignment={cellAction.assignment}
          action={cellAction.type}
        />
      )}

      {cellAction?.type === "offer-details" && currentTechnician && (
        <OfferDetailsDialog
          open={true}
          onClose={closeDialogs}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          jobTitle={jobs.find((j) => j.id === cellAction.selectedJobId)?.title}
          technicianDepartment={currentTechnician.department}
          defaultSingleDay={cellAction.singleDay}
          jobStartTimeIso={jobs.find((j) => j.id === cellAction.selectedJobId)?.start_time}
          jobEndTimeIso={jobs.find((j) => j.id === cellAction.selectedJobId)?.end_time}
          defaultDateIso={format(cellAction.date, "yyyy-MM-dd")}
          onSubmit={({ role, message, singleDay, dates }) => {
            if (!cellAction.selectedJobId) return;
            (async () => {
              const jobId = cellAction.selectedJobId!;
              const profileId = currentTechnician.id;
              const via = offerChannel;
              if (singleDay) {
                const selectedDates =
                  Array.isArray(dates) && dates.length ? dates : [format(cellAction.date, "yyyy-MM-dd")];
                for (const d of selectedDates) {
                  const conflictResult = await checkTimeConflictEnhanced(profileId, jobId, {
                    targetDateIso: d,
                    singleDayOnly: true,
                    includePending: true,
                  });
                  if (conflictResult.hasHardConflict) {
                    const conflict = conflictResult.hardConflicts[0];
                    toast({
                      title: "Conflicto de horarios",
                      description: `(${d}) Ya tiene confirmado: ${conflict.title}`,
                      variant: "destructive",
                    });
                    return;
                  }
                }
                const payload: any = {
                  job_id: jobId,
                  profile_id: profileId,
                  phase: "offer",
                  role,
                  message,
                  channel: via,
                  single_day: true,
                  dates: selectedDates,
                };
                if (selectedDates.length === 1) {
                  payload.target_date = selectedDates[0];
                }
                sendStaffingEmail(payload, {
                  onSuccess: (data: any) => {
                    const ch = data?.channel || via;
                    toast({
                      title: "Oferta enviada",
                      description: `Oferta de ${role} enviada por ${ch} (${selectedDates.length} día${selectedDates.length > 1 ? "s" : ""}).`,
                    });
                    closeDialogs();
                  },
                  onError: (error: any) => {
                    toast({
                      title: "No se pudo enviar la oferta",
                      description: error.message,
                      variant: "destructive",
                    });
                  },
                });
                return;
              }
              // Full span
              const conflictResult = await checkTimeConflictEnhanced(profileId, jobId, {
                includePending: true,
              });
              if (conflictResult.hasHardConflict) {
                const conflict = conflictResult.hardConflicts[0];
                toast({
                  title: "Conflicto de horarios",
                  description: `Ya tiene confirmado: ${conflict.title}`,
                  variant: "destructive",
                });
                return;
              }
              sendStaffingEmail(
                ({ job_id: jobId, profile_id: profileId, phase: "offer", role, message, channel: via, single_day: false } as any),
                {
                  onSuccess: (data: any) => {
                    const ch = data?.channel || via;
                    toast({ title: "Oferta enviada", description: `Oferta de ${role} enviada por ${ch}.` });
                    closeDialogs();
                  },
                  onError: (error: any) => {
                    toast({
                      title: "No se pudo enviar la oferta",
                      description: error.message,
                      variant: "destructive",
                    });
                  },
                }
              );
            })();
          }}
        />
      )}

      {availabilityDialog?.open && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setAvailabilityDialog(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar solicitud de disponibilidad</DialogTitle>
              <DialogDescription>
                Pide disponibilidad a {currentTechnician?.first_name} {currentTechnician?.last_name} vía{" "}
                {availabilityDialog.channel === "whatsapp" ? "WhatsApp" : "Email"}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {/* Coverage selection */}
              <div className="space-y-3">
                <label className="font-medium text-sm text-foreground">Cobertura</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-coverage"
                      checked={availabilityCoverage === "full"}
                      onChange={() => setAvailabilityCoverage("full")}
                    />
                    <span>Todo el trabajo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-coverage"
                      checked={availabilityCoverage === "single"}
                      onChange={() => setAvailabilityCoverage("single")}
                    />
                    <span>Un día</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-coverage"
                      checked={availabilityCoverage === "multi"}
                      onChange={() => setAvailabilityCoverage("multi")}
                    />
                    <span>Varios días</span>
                  </label>
                </div>
                {(() => {
                  const job = jobs.find((j) => j.id === availabilityDialog.jobId);
                  const start = job?.start_time ? new Date(job.start_time) : undefined;
                  const end = job?.end_time ? new Date(job.end_time) : start;
                  if (start) start.setHours(0, 0, 0, 0);
                  if (end) end.setHours(0, 0, 0, 0);
                  const isAllowed = (d: Date) => {
                    if (!start || !end) return true;
                    const t = new Date(d);
                    t.setHours(0, 0, 0, 0);
                    return t >= start && t <= end;
                  };
                  return (
                    <>
                      {availabilityCoverage === "single" && (
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                {availabilitySingleDate
                                  ? format(availabilitySingleDate, "PPP")
                                  : availabilityDialog.dateIso}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={availabilitySingleDate ?? undefined}
                                onSelect={(d) => {
                                  if (d && isAllowed(d)) setAvailabilitySingleDate(d);
                                }}
                                disabled={(d) => !isAllowed(d)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">Enviar solo para la fecha seleccionada.</p>
                        </div>
                      )}
                      {availabilityCoverage === "multi" && (
                        <div className="space-y-2">
                          <CalendarPicker
                            mode="multiple"
                            selected={availabilityMultiDates}
                            onSelect={(ds) => setAvailabilityMultiDates((ds || []).filter((d) => isAllowed(d)))}
                            disabled={(d) => !isAllowed(d)}
                            numberOfMonths={2}
                          />
                          <p className="text-xs text-muted-foreground">
                            Crea una solicitud de un solo día por cada fecha seleccionada.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAvailabilityDialog(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!availabilityDialog) return;
                  setAvailabilitySending(true);
                  const jobId = availabilityDialog.jobId;
                  const profileId = availabilityDialog.profileId;
                  const via = availabilityDialog.channel;
                  if (availabilityCoverage === "full") {
                    const payload = { job_id: jobId, profile_id: profileId, phase: "availability", channel: via, single_day: false };
                    sendStaffingEmail(payload as any, {
                      onSuccess: (data: any) => {
                        setAvailabilitySending(false);
                        setAvailabilityDialog(null);
                        toast({
                          title: "Solicitud enviada",
                          description: `Solicitud de disponibilidad enviada por ${data?.channel || via}.`,
                        });
                        closeDialogs();
                      },
                      onError: (error: any) => handleEmailError(error, payload),
                    });
                    return;
                  }
                  const dates =
                    availabilityCoverage === "single"
                      ? availabilitySingleDate
                        ? [format(availabilitySingleDate, "yyyy-MM-dd")]
                        : [availabilityDialog.dateIso]
                      : Array.from(new Set((availabilityMultiDates || []).map((d) => format(d, "yyyy-MM-dd"))));
                  if (dates.length === 0) {
                    setAvailabilitySending(false);
                    toast({
                      title: "Selecciona fecha(s)",
                      description: "Elige al menos una fecha dentro del rango del trabajo.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const payload: any = {
                    job_id: jobId,
                    profile_id: profileId,
                    phase: "availability",
                    channel: via,
                    single_day: true,
                    dates,
                  };
                  if (availabilityCoverage === "single" || dates.length === 1) {
                    payload.target_date = dates[0];
                  }
                  sendStaffingEmail(payload, {
                    onSuccess: (data: any) => {
                      setAvailabilitySending(false);
                      setAvailabilityDialog(null);
                      toast({
                        title: "Solicitud enviada",
                        description: `Solicitud de disponibilidad enviada para ${dates.length} día${dates.length > 1 ? "s" : ""} por ${data?.channel || via}.`,
                      });
                      closeDialogs();
                    },
                    onError: (error: any) => handleEmailError(error, payload),
                  });
                }}
                disabled={availabilitySending}
              >
                {availabilitySending ? "Enviando…" : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {cellAction?.type === "unavailable" && (
        <MarkUnavailableDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          selectedDate={cellAction.date}
          selectedCells={Array.from(selectedCells)}
        />
      )}

      {isManagementUser && (
        <CreateUserDialog
          open={createUserOpen}
          onOpenChange={(open) => {
            if (!open) {
              qc.invalidateQueries({ queryKey: ["optimized-matrix-technicians"] });
            }
            setCreateUserOpen(open);
          }}
        />
      )}

      {/* Conflict Dialog */}
      {conflictDialog?.open && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setConflictDialog(null) }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Conflicto de agenda detectado</DialogTitle>
              <DialogDescription>El técnico tiene conflictos o no está disponible durante este periodo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {/* Overlapping Job Assignments - Red */}
              {conflictDialog.details?.conflicts && conflictDialog.details.conflicts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-600 dark:text-red-400">Trabajos solapados:</h4>
                  <div className="space-y-1">
                    {conflictDialog.details.conflicts.map((conflict: any, idx: number) => (
                      <div
                        key={idx}
                        className="text-sm p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
                      >
                        <div className="font-medium text-red-900 dark:text-red-100">
                          {conflict.job_name || "Trabajo sin nombre"}
                        </div>
                        <div className="text-red-700 dark:text-red-300">
                          {conflict.job_type && <span className="capitalize">{conflict.job_type}</span>}
                          {conflict.start_time && conflict.end_time && (
                            <span className="ml-2">
                              {new Date(conflict.start_time).toLocaleDateString()} -{" "}
                              {new Date(conflict.end_time).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {conflict.role && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">Rol: {conflict.role}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unavailability Periods - Orange */}
              {conflictDialog.details?.unavailability && conflictDialog.details.unavailability.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-orange-600 dark:text-orange-400">Fechas no disponibles:</h4>
                  <div className="space-y-1">
                    {conflictDialog.details.unavailability.map((unavail: any, idx: number) => (
                      <div
                        key={idx}
                        className="text-sm p-2 rounded bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900"
                      >
                        <div className="text-orange-900 dark:text-orange-100">
                          {unavail.start_date && unavail.end_date ? (
                            <>
                              {new Date(unavail.start_date).toLocaleDateString()} -{" "}
                              {new Date(unavail.end_date).toLocaleDateString()}
                            </>
                          ) : unavail.date ? (
                            new Date(unavail.date).toLocaleDateString()
                          ) : (
                            "Fecha no especificada"
                          )}
                        </div>
                        {unavail.reason && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">{unavail.reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConflictDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const payloadWithOverride = {
                    ...conflictDialog.originalPayload,
                    override_conflicts: true,
                  };
                  setConflictDialog(null);
                  sendStaffingEmail(payloadWithOverride, {
                    onSuccess: () => {
                      setAvailabilityDialog(null);
                      setAvailabilitySending(false);
                      toast({
                        title: "Solicitud enviada",
                        description: "Solicitud de staffing enviada (conflictos ignorados)",
                      });
                    },
                    onError: (error: any) => {
                      setAvailabilitySending(false);
                      toast({
                        title: "Error al enviar",
                        description: error.message || "No se pudo enviar la solicitud de staffing",
                        variant: "destructive",
                      });
                    },
                  });
                }}
              >
                Enviar igualmente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
