import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { formatMadridDateKey, madridDateKeyToCalendarDate } from "@/utils/timezoneUtils";

import { AssignmentStatusDialog } from "@/components/matrix/AssignmentStatusDialog";
import { AssignJobDialog } from "@/components/matrix/AssignJobDialog";
import { MarkUnavailableDialog } from "@/components/matrix/MarkUnavailableDialog";
import { OfferDetailsDialog } from "@/components/matrix/OfferDetailsDialog";
import { SelectJobDialog } from "@/components/matrix/SelectJobDialog";
import { StaffingJobSelectionDialog } from "@/components/matrix/StaffingJobSelectionDialog";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { CoverageSelector } from "@/components/matrix/staffing/CoverageSelector";
import { SHEET_BODY, SHEET_FOOTER, SHEET_HEADER } from "@/components/matrix/staffing/sheetLayout";
import { cn } from "@/lib/utils";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { queryKeys } from "@/lib/react-query";
import type { OptimizedAssignmentMatrixViewProps } from "@/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView";
import { getErrorMessage } from '@/utils/errorMessage';

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
  | "offerSeedDates"
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
  offerSeedDates,
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
        defaultDateIso={formatMadridDateKey(cellAction.date)}
        defaultDates={offerSeedDates}
        onSubmit={({ role, message, singleDay, dates }) => {
          if (!cellAction.selectedJobId) return;
          void (async () => {
            try {
              const jobId = cellAction.selectedJobId!;
              const profileId = currentTechnician.id;
              const via = offerChannel;
              if (singleDay) {
                const selectedDates =
                  Array.isArray(dates) && dates.length ? dates : [formatMadridDateKey(cellAction.date)];
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
                  onError: (error: unknown) => {
                    toast({
                      title: "No se pudo enviar la oferta",
                      description: getErrorMessage(error, "No se pudo enviar la oferta"),
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
                ({ job_id: jobId, profile_id: profileId, phase: "offer", role, message, channel: via, department: staffingDepartment, single_day: false }),
                {
                  onSuccess: (data: any) => {
                    const ch = data?.channel || via;
                    toast({ title: "Oferta enviada", description: `Oferta de ${role} enviada por ${ch}.` });
                    closeDialogs();
                  },
                  onError: (error: unknown) => {
                    toast({
                      title: "No se pudo enviar la oferta",
                      description: getErrorMessage(error, "No se pudo enviar la oferta"),
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

    {availabilityDialog?.open && (() => {
      const job = jobs.find((j) => j.id === availabilityDialog.jobId);
      // Job timestamps are real instants, so they convert to Madrid days.
      const toMadridDay = (value: Date | string) => formatInTimeZone(value, "Europe/Madrid", "yyyy-MM-dd");
      const startDay = job?.start_time ? toMadridDay(job.start_time) : undefined;
      const endDay = job?.end_time ? toMadridDay(job.end_time) : startDay;
      const isAllowed = (d: Date) => {
        if (!startDay || !endDay) return true;
        // Picker values are NOT instants: they are local-midnight calendar
        // values standing for a Madrid day (see madridDateKeyToCalendarDate),
        // and they are submitted with the same local format below. Running
        // them through formatInTimeZone shifted them a day east of Madrid.
        const day = format(d, "yyyy-MM-dd");
        return day >= startDay && day <= endDay;
      };
      const dayCount =
        availabilityCoverage === "multi"
          ? availabilityMultiDates.length
          : availabilityCoverage === "single"
            ? 1
            : 0;
      const sendLabel = availabilitySending
        ? "Enviando…"
        : availabilityCoverage === "full"
          ? "Enviar solicitud"
          : `Enviar (${dayCount} ${dayCount === 1 ? "día" : "días"})`;

      return (
        <ResponsiveDialog open={true} onOpenChange={(v) => { if (!v) setAvailabilityDialog(null) }}>
          <ResponsiveDialogContent className="sm:max-w-md">
            <ResponsiveDialogHeader className={SHEET_HEADER}>
              <ResponsiveDialogTitle>Pedir disponibilidad</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {`${currentTechnician?.first_name ?? ""} ${currentTechnician?.last_name ?? ""}`.trim()}
                {job?.title ? ` · ${job.title}` : ""}
                {` · ${availabilityDialog.channel === "whatsapp" ? "WhatsApp" : "Email"}`}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className={SHEET_BODY}>
              <CoverageSelector
                value={availabilityCoverage}
                onChange={setAvailabilityCoverage}
                singleDate={availabilitySingleDate}
                onSingleDateChange={setAvailabilitySingleDate}
                multiDates={availabilityMultiDates}
                onMultiDatesChange={setAvailabilityMultiDates}
                isAllowed={isAllowed}
                rangeStart={startDay ? madridDateKeyToCalendarDate(startDay) : null}
                rangeEnd={endDay ? madridDateKeyToCalendarDate(endDay) : null}
                fullHint="Pregunta por todas las fechas del trabajo."
                singleHint="Envía la solicitud solo para la fecha seleccionada."
                multiHint="Crea una solicitud de un día por cada fecha seleccionada."
              />
            </div>

            <ResponsiveDialogFooter className={SHEET_FOOTER}>
              <Button variant="outline" className="min-h-11" onClick={() => setAvailabilityDialog(null)}>
                Cancelar
              </Button>
              <Button
                className="min-h-11 flex-1 sm:flex-none"
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
                      onError: (error: unknown) => handleEmailError(error, payload),
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
                    onError: (error: unknown) => handleEmailError(error, payload),
                  });
                }}
                disabled={availabilitySending}
              >
                {sendLabel}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      );
    })()}

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
      <ResponsiveDialog open={true} onOpenChange={(v) => { if (!v) setConflictDialog(null) }}>
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader className={SHEET_HEADER}>
            <ResponsiveDialogTitle>Conflicto de agenda detectado</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>El técnico tiene conflictos o no está disponible durante este periodo.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className={cn(SHEET_BODY, "space-y-4 sm:max-h-[400px]")}>
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
          <ResponsiveDialogFooter className={SHEET_FOOTER}>
            <Button variant="outline" className="min-h-11" onClick={() => setConflictDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 flex-1 sm:flex-none"
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
                  onError: (error: unknown) => {
                    setAvailabilitySending(false);
                    toast({
                      title: "Error al enviar",
                      description: getErrorMessage(error, "No se pudo enviar la solicitud de staffing"),
                      variant: "destructive",
                    });
                  },
                });
              }}
            >
              Enviar igualmente
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    )}
  </>
);
