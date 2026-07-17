import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar as CalendarIcon } from "lucide-react";

import { AssignmentStatusDialog } from "@/components/matrix/AssignmentStatusDialog";
import { AssignJobDialog } from "@/components/matrix/AssignJobDialog";
import { MarkUnavailableDialog } from "@/components/matrix/MarkUnavailableDialog";
import { OfferDetailsDialog } from "@/components/matrix/OfferDetailsDialog";
import { SelectJobDialog } from "@/components/matrix/SelectJobDialog";
import { StaffingJobSelectionDialog } from "@/components/matrix/StaffingJobSelectionDialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { queryKeys } from "@/lib/react-query";
import type { OptimizedAssignmentMatrixViewProps } from "@/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView";

type MatrixDialogsProps = Pick<
  OptimizedAssignmentMatrixViewProps,
  | "cellAction"
  | "currentTechnician"
  | "closeDialogs"
  | "handleJobSelected"
  | "handleStaffingActionSelected"
  | "forcedStaffingAction"
  | "forcedStaffingChannel"
  | "getJobsForDate"
  | "declinedJobsByTech"
  | "jobs"
  | "staffingDepartment"
  | "offerChannel"
  | "toast"
  | "sendStaffingEmail"
  | "checkTimeConflictEnhanced"
  | "availabilityDialog"
  | "setAvailabilityDialog"
  | "availabilityCoverage"
  | "setAvailabilityCoverage"
  | "availabilitySingleDate"
  | "setAvailabilitySingleDate"
  | "availabilityMultiDates"
  | "setAvailabilityMultiDates"
  | "availabilitySending"
  | "setAvailabilitySending"
  | "handleEmailError"
  | "conflictDialog"
  | "setConflictDialog"
  | "selectedCells"
  | "isManagementUser"
  | "createUserOpen"
  | "setCreateUserOpen"
  | "qc"
>;

export const MatrixDialogs = ({
  cellAction,
  currentTechnician,
  closeDialogs,
  handleJobSelected,
  handleStaffingActionSelected,
  forcedStaffingAction,
  forcedStaffingChannel,
  getJobsForDate,
  declinedJobsByTech,
  jobs,
  staffingDepartment,
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
  selectedCells,
  isManagementUser,
  createUserOpen,
  setCreateUserOpen,
  qc,
}: MatrixDialogsProps) => (
  <>
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
        jobDescription={jobs.find((j) => j.id === cellAction.selectedJobId)?.description}
        technicianDepartment={currentTechnician.department}
        defaultSingleDay={cellAction.singleDay}
        jobStartTimeIso={jobs.find((j) => j.id === cellAction.selectedJobId)?.start_time}
        jobEndTimeIso={jobs.find((j) => j.id === cellAction.selectedJobId)?.end_time}
        defaultDateIso={format(cellAction.date, "yyyy-MM-dd")}
        onSubmit={({ role, message, singleDay, dates }) => {
          if (!cellAction.selectedJobId) return;
          void (async () => {
            try {
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
                  department: staffingDepartment,
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
                ({ job_id: jobId, profile_id: profileId, phase: "offer", role, message, channel: via, department: staffingDepartment, single_day: false } as any),
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
            } catch (error) {
              toast({
                title: "No se pudo enviar la oferta",
                description: error instanceof Error ? error.message : "Error inesperado al procesar la oferta",
                variant: "destructive",
              });
            }
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
            <div className="space-y-3">
              <Label className="font-medium text-sm text-foreground">Cobertura</Label>
              <RadioGroup
                value={availabilityCoverage}
                onValueChange={(value) => setAvailabilityCoverage(value as "full" | "single" | "multi")}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="availability-coverage-full" value="full" />
                  <Label htmlFor="availability-coverage-full" className="cursor-pointer">
                    Todo el trabajo
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="availability-coverage-single" value="single" />
                  <Label htmlFor="availability-coverage-single" className="cursor-pointer">
                    Un día
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="availability-coverage-multi" value="multi" />
                  <Label htmlFor="availability-coverage-multi" className="cursor-pointer">
                    Varios días
                  </Label>
                </div>
              </RadioGroup>
              {(() => {
                const job = jobs.find((j) => j.id === availabilityDialog.jobId);
                const toMadridDay = (value: Date | string) =>
                  formatInTimeZone(value, "Europe/Madrid", "yyyy-MM-dd");
                const startDay = job?.start_time ? toMadridDay(job.start_time) : undefined;
                const endDay = job?.end_time ? toMadridDay(job.end_time) : startDay;
                const isAllowed = (d: Date) => {
                  if (!startDay || !endDay) return true;
                  const day = toMadridDay(d);
                  return day >= startDay && day <= endDay;
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
                  const payload = { job_id: jobId, profile_id: profileId, phase: "availability", channel: via, department: staffingDepartment, single_day: false };
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
                  department: staffingDepartment,
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
            qc.invalidateQueries({ queryKey: queryKeys.scope("optimized-matrix-technicians") });
          }
          setCreateUserOpen(open);
        }}
      />
    )}

    {conflictDialog?.open && (
      <Dialog open={true} onOpenChange={(v) => { if (!v) setConflictDialog(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conflicto de agenda detectado</DialogTitle>
            <DialogDescription>El técnico tiene conflictos o no está disponible durante este periodo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
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
  </>
);
