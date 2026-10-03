import { dataLayerClient } from '@/services/dataLayerClient';
import {
  AssignmentCommandError,
  applyDirectAssignment,
  assignmentCommandMessage,
  assignmentCommandStateKey,
  createAssignmentCommandId,
  getAssignmentCommandState,
  isRejectionCode,
  reconcileAssignmentViews,
  removeDirectAssignment,
  requireCommitted,
  runAssignmentSideEffects,
  type ApplyDirectAssignmentInput,
  type AssignmentCommandResult,
} from '@/features/assignments/commands';
import { normalizeDateKey } from '@/utils/assignmentWorkDates';
import { codeForLabel, isRoleCode, roleOptionsForDiscipline } from '@/utils/roles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatMadridDateKey, madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';


import { AssignJobDialogView } from "@/components/matrix/AssignJobDialogView";
import {
  conflictWarningFromRejection,
  type AssignmentConflictWarning,
} from "@/components/matrix/assignJobConflicts";
import {
  getAssignableJobDateKeys,
  getErrorMessage,
  parseDateKey,
  sortDateKeys,
  type AssignJobDialogProps,
  type CoverageMode,
} from "@/components/matrix/assignJobDialogTypes";
import { queryKeys } from "@/lib/react-query";

export { getAssignableJobDateKeys } from "@/components/matrix/assignJobDialogTypes";
export type {
  AssignableJob,
  CoverageMode,
  ExistingAssignment
} from "@/components/matrix/assignJobDialogTypes";

/** Madrid-midnight instant from the matrix -> the local calendar day it stands for. */
const toCalendarDate = (date: Date): Date => madridDateKeyToCalendarDate(formatMadridDateKey(date)) ?? date;

/**
 * Day key for a value that belongs to the calendar pickers.
 *
 * Everything the pickers touch is a calendar day — a local midnight standing
 * for a date — because that is what react-day-picker renders and returns from
 * onSelect. Local `format` round-trips those in every timezone, which is what
 * `assignmentDate` already relies on. `formatDateKey` must not be used on them:
 * it converts a Date as an *instant* into Madrid, so a picked local midnight
 * came back a day early east of Madrid (in Asia/Tokyo, picking 2026-03-12
 * submitted 2026-03-11).
 */
const toPickerDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

export const AssignJobDialog = ({
  open,
  onClose,
  technicianId,
  date,
  availableJobs,
  existingAssignment,
  preSelectedJobId
}: AssignJobDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(preSelectedJobId || existingAssignment?.job_id || '');
  const [selectedRole, setSelectedRole] = useState<string>('');
  // Coverage mode: full job span, single day, multiple days
  const [coverageMode, setCoverageMode] = useState<CoverageMode>(existingAssignment?.single_day ? 'single' : 'full');
  const [singleDate, setSingleDate] = useState<Date | null>(() => toCalendarDate(date));
  const [multiDates, setMultiDates] = useState<Date[]>(date ? [toCalendarDate(date)] : []);
  const [assignAsConfirmed, setAssignAsConfirmed] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<AssignmentConflictWarning | null>(null);
  // Modification mode: 'add' adds dates to existing, 'replace' replaces all dates
  const [modificationMode, setModificationMode] = useState<'add' | 'replace'>('add');

  // Get technician details
  const { data: technician } = useQuery({
    queryKey: queryKeys.scope('technician', technicianId),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('profiles')
        .select('first_name, last_name, department')
        .eq('id', technicianId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!technicianId
  });

  // If we're reassigning and the existing assignment was declined, block choosing the same job again
  const filteredJobs = React.useMemo(() => {
    if (existingAssignment?.status === 'declined') {
      return availableJobs.filter(j => j.id !== existingAssignment.job_id);
    }
    return availableJobs;
  }, [availableJobs, existingAssignment?.status, existingAssignment?.job_id]);

  const selectedJob = filteredJobs.find(job => job.id === selectedJobId);
  const roleOptions = technician ? roleOptionsForDiscipline(technician.department) : [];
  const isReassignment = !!existingAssignment;
  // NOTE: existingAssignment is only present when clicking a day that already has an assignment.
  // When adding a new day to an already-assigned job from an *empty* cell, existingAssignment is undefined,
  // but timesheets for (job_id, technician_id) already exist. We treat that as "modifying the same job".
  const isModifyingSameJobByContext = isReassignment && existingAssignment?.job_id === selectedJobId;
  // The matrix supplies Madrid-midnight instants while the picker and this
  // local yyyy-MM-dd formatting work in calendar days, so the range value is
  // converted at the boundary. Formatting the instant directly submitted the
  // previous day west of Madrid.
  // IMPORTANT: use local yyyy-MM-dd, not toISOString (which is UTC)
  const assignmentDate = React.useMemo(
    () => format(singleDate ?? toCalendarDate(date), 'yyyy-MM-dd'),
    [date, singleDate],
  );

  // Authoritative state of the selected pair: membership, active days and the
  // expected-state token sent back with the command. Needed even when
  // existingAssignment is undefined (adding a day to an already assigned job).
  const { data: selectedState, isLoading: isLoadingSelectedState } = useQuery({
    queryKey: assignmentCommandStateKey(selectedJobId, technicianId),
    enabled: open && !!selectedJobId && !!technicianId,
    queryFn: () => getAssignmentCommandState(selectedJobId, technicianId),
    staleTime: 10_000,
  });
  // State of the job a reassignment moves away from (same query when equal).
  const sourceJobId = existingAssignment?.job_id ?? '';
  const { data: sourceState, isLoading: isLoadingSourceState } = useQuery({
    queryKey: assignmentCommandStateKey(sourceJobId, technicianId),
    enabled: open && !!sourceJobId && !!technicianId,
    queryFn: () => getAssignmentCommandState(sourceJobId, technicianId),
    staleTime: 10_000,
  });
  const existingTimesheets = selectedState?.dates;
  const isLoadingExistingTimesheets = isLoadingSelectedState;

  const hasExistingTimesheetsForSelectedJob = (existingTimesheets?.length ?? 0) > 0;
  const isModifyingSelectedJob = isModifyingSameJobByContext || hasExistingTimesheetsForSelectedJob;
  const existingTimesheetDateKeys = useMemo(
    () => sortDateKeys((existingTimesheets || []).map((existingDate) => normalizeDateKey(existingDate)).filter((key): key is string => Boolean(key))),
    [existingTimesheets],
  );
  const existingTimesheetDateSet = useMemo(() => new Set(existingTimesheetDateKeys), [existingTimesheetDateKeys]);

  // Set initial role if reassigning
  React.useEffect(() => {
    if (existingAssignment && technician) {
      const currentRole = existingAssignment.sound_role ||
        existingAssignment.lights_role ||
        existingAssignment.video_role;
      if (currentRole) {
        if (isRoleCode(currentRole)) {
          setSelectedRole(currentRole);
        } else {
          const mapped = codeForLabel(currentRole, technician.department) || '';
          setSelectedRole(mapped);
        }
      }
    }
  }, [existingAssignment, technician]);

  React.useEffect(() => {
    if (existingAssignment?.single_day && existingAssignment?.assignment_date) {
      // new Date(...) yields an Invalid Date (it never throws) for a bad string,
      // so validate the result and keep the default when it isn't a real date.
      const parsedAssignmentDate = new Date(`${existingAssignment.assignment_date}T00:00:00`);
      if (!Number.isNaN(parsedAssignmentDate.getTime())) {
        setSingleDate(parsedAssignmentDate);
      }
    }
  }, [existingAssignment?.single_day, existingAssignment?.assignment_date]);

  // Update selected job when preSelectedJobId changes
  React.useEffect(() => {
    if (preSelectedJobId) {
      setSelectedJobId(preSelectedJobId);
    }
  }, [preSelectedJobId]);

  const queryClient = useQueryClient();
  // One command id per decision. A transport retry of the same decision reuses
  // it, so the database replays an already committed result instead of
  // applying it twice; any definitive outcome or a changed decision starts over.
  const pendingCommandRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const commandIdFor = (fingerprint: string) => {
    if (pendingCommandRef.current?.fingerprint !== fingerprint) {
      pendingCommandRef.current = { fingerprint, id: createAssignmentCommandId() };
    }
    return pendingCommandRef.current.id;
  };

  const moveFromJobId = existingAssignment && existingAssignment.job_id !== selectedJobId
    ? existingAssignment.job_id
    : null;

  const refreshPair = () => reconcileAssignmentViews(queryClient, {
    technicianId,
    jobIds: [selectedJobId, existingAssignment?.job_id],
  });

  const reportCommandFailure = (error: unknown, fallbackPrefix: string) => {
    if (!(error instanceof AssignmentCommandError)) {
      pendingCommandRef.current = null;
      toast.error(`${fallbackPrefix}: ${getErrorMessage(error)}`);
      return;
    }
    // Network/unknown failures may have committed server-side: keep the id so
    // the next click replays instead of repeating. Everything else is final.
    if (!error.retryable && error.code !== 'unknown') pendingCommandRef.current = null;
    if (error.code === 'stale_state' || error.code === 'concurrent_write') refreshPair();
    toast.error(error.message);
  };

  const runSideEffectsInBackground = (result: AssignmentCommandResult) => {
    if (result.side_effects.length === 0) return;
    const recipientName = technician ? `${technician.first_name ?? ''} ${technician.last_name ?? ''}`.trim() : null;
    void runAssignmentSideEffects(result.command_id, result, {
      technicianDepartment: technician?.department,
      recipientName,
    }).then((summary) => {
      if (summary.failed > 0) {
        toast.error('El cambio se guardó, pero falló la sincronización con Flex o la notificación. Queda registrado para reintentar.');
      }
    }, (error: unknown) => {
      console.error('Assignment side effects could not run', error);
    });
  };

  const attemptAssign = async (skipConflictCheck = false) => {
    if (!selectedJobId || !selectedRole || !technician) {
      toast.error('Por favor selecciona un trabajo y un rol');
      return;
    }

    if (existingAssignment?.status === 'declined' && selectedJobId === existingAssignment.job_id) {
      toast.error('Este técnico ya rechazó este trabajo');
      return;
    }

    if (isAssigning) return;

    if (isLoadingExistingTimesheets || (moveFromJobId && isLoadingSourceState)) {
      toast.error('Cargando el estado de la asignación, por favor espera...');
      return;
    }

    let dates: string[] | undefined;
    if (coverageMode === 'multi') {
      dates = sortDateKeys((multiDates || []).map((multiDate) => toPickerDateKey(multiDate)));
      if (dates.length === 0) {
        toast.error('Selecciona al menos una fecha');
        return;
      }
    } else if (coverageMode === 'single') {
      dates = [assignmentDate];
    }

    const input: Omit<ApplyDirectAssignmentInput, 'commandId'> = {
      jobId: selectedJobId,
      technicianId,
      role: selectedRole,
      status: assignAsConfirmed ? 'confirmed' : 'invited',
      coverage: coverageMode,
      dates,
      mode: modificationMode,
      expectedStateToken: selectedState?.state_token ?? null,
      fromJobId: moveFromJobId,
      expectedFromStateToken: moveFromJobId ? sourceState?.state_token ?? null : null,
      // Conflicts are enforced by the database under the technician lock; an
      // override is an explicit second decision after seeing the warning.
      conflictPolicy: skipConflictCheck ? 'allow' : 'reject',
      source: 'assignment-dialog',
    };
    const commandId = commandIdFor(JSON.stringify(input));

    setIsAssigning(true);
    try {
      const result = await applyDirectAssignment({ ...input, commandId });
      pendingCommandRef.current = null;

      if (!result.ok) {
        const warning = conflictWarningFromRejection(result, coverageMode);
        if (warning) {
          setConflictWarning(warning);
          return;
        }
        if (result.code === 'stale_state') refreshPair();
        toast.error(assignmentCommandMessage(isRejectionCode(result.code) ? result.code : 'unknown'));
        return;
      }

      refreshPair();
      setConflictWarning(null);
      if (result.outcome === 'noop') {
        toast.success('La asignación ya estaba así: no había cambios que guardar');
      } else {
        const statusText = result.assignment?.status === 'confirmed' ? 'confirmado' : 'invitado';
        toast.success(
          `${isReassignment ? 'Reasignado' : 'Asignado'} ${technician.first_name} ${technician.last_name} a ${selectedJob?.title} (${statusText})`
        );
      }
      if (result.warnings.length > 0) {
        toast.error('La asignación se guardó, pero no se pudo recalcular el importe de algún parte');
      }
      runSideEffectsInBackground(result);
      onClose();
    } catch (error: unknown) {
      console.error('Error assigning job:', error);
      reportCommandFailure(error, 'Error al asignar el trabajo');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssign = () => {
    void attemptAssign();
  };

  const handleRemoveAssignment = async () => {
    if (!existingAssignment) return;
    if (isRemoving) return;
    if (isLoadingSourceState) {
      toast.error('Cargando el estado de la asignación, por favor espera...');
      return;
    }
    const input = {
      jobId: existingAssignment.job_id,
      technicianId,
      expectedStateToken: sourceState?.state_token ?? null,
      source: 'assignment-dialog',
    };
    const commandId = commandIdFor(JSON.stringify({ remove: input }));

    setIsRemoving(true);
    try {
      const result = requireCommitted(await removeDirectAssignment({ ...input, commandId }));
      pendingCommandRef.current = null;
      refreshPair();
      runSideEffectsInBackground(result);
      toast.success('Asignación eliminada');
      onClose();
    } catch (error: unknown) {
      reportCommandFailure(error, 'Error al eliminar la asignación');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCheckboxChange = (checked: boolean | "indeterminate") => {
    // Convert CheckedState to boolean, treating "indeterminate" as false
    setAssignAsConfirmed(checked === true);
  };

  // Build selected job dates to constrain calendar selection.
  const selectedJobMeta = useMemo(() => {
    const j = selectedJob;
    if (!j) return null as null | { dateKeys: Set<string> };
    const dateKeys = new Set(getAssignableJobDateKeys(j));
    return { dateKeys };
  }, [selectedJob]);

  const isAllowedDate = React.useCallback((d: Date) => {
    const key = toPickerDateKey(d);
    if (existingTimesheetDateSet.has(key)) return true;
    if (!selectedJobMeta || selectedJobMeta.dateKeys.size === 0) return true;
    return selectedJobMeta.dateKeys.has(key);
  }, [existingTimesheetDateSet, selectedJobMeta]);

  React.useEffect(() => {
    if (!open || coverageMode !== 'multi' || !isModifyingSelectedJob || existingTimesheetDateKeys.length === 0) {
      return;
    }

    setMultiDates((currentDates) => {
      const nextByKey = new Map<string, Date>();
      currentDates.forEach((currentDate) => {
        if (isAllowedDate(currentDate)) {
          nextByKey.set(toPickerDateKey(currentDate), currentDate);
        }
      });
      existingTimesheetDateKeys.forEach((existingDateKey) => {
        const existingDate = madridDateKeyToCalendarDate(existingDateKey) ?? parseDateKey(existingDateKey);
        if (isAllowedDate(existingDate)) {
          nextByKey.set(existingDateKey, existingDate);
        }
      });

      const nextDates = Array.from(nextByKey.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, nextDate]) => nextDate);
      const currentKey = currentDates.map(toPickerDateKey).sort().join('|');
      const nextKey = nextDates.map(toPickerDateKey).join('|');
      return currentKey === nextKey ? currentDates : nextDates;
    });
  }, [
    open,
    coverageMode,
    isModifyingSelectedJob,
    existingTimesheetDateKeys,
    isAllowedDate,
  ]);

  const formatJobRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    try {
      return `${format(new Date(start), 'PPP')} – ${format(new Date(end), 'PPP')}`;
    } catch {
      return null;
    }
  };

  const formatDateLabel = (iso?: string) => {
    if (!iso) return null;
    try {
      return format(new Date(`${iso}T00:00:00`), 'PPP');
    } catch {
      return null;
    }
  };

  const targetJobRange = selectedJob ? formatJobRange(selectedJob.start_time, selectedJob.end_time) : null;
  const conflictTargetDateLabel = formatDateLabel(conflictWarning?.targetDate);

  return (
    <AssignJobDialogView
      open={open}
      onClose={onClose}
      isReassignment={isReassignment}
      technician={technician}
      date={toCalendarDate(date)}
      existingAssignment={existingAssignment}
      preSelectedJobId={preSelectedJobId}
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      filteredJobs={filteredJobs}
      selectedRole={selectedRole}
      setSelectedRole={setSelectedRole}
      roleOptions={roleOptions}
      isModifyingSelectedJob={isModifyingSelectedJob}
      coverageMode={coverageMode}
      setCoverageMode={setCoverageMode}
      existingTimesheets={existingTimesheets}
      modificationMode={modificationMode}
      setModificationMode={setModificationMode}
      singleDate={singleDate}
      setSingleDate={setSingleDate}
      isAllowedDate={isAllowedDate}
      multiDates={multiDates}
      setMultiDates={setMultiDates}
      assignAsConfirmed={assignAsConfirmed}
      handleCheckboxChange={handleCheckboxChange}
      selectedJob={selectedJob}
      isRemoving={isRemoving}
      handleRemoveAssignment={handleRemoveAssignment}
      handleAssign={handleAssign}
      isAssigning={isAssigning}
      conflictWarning={conflictWarning}
      setConflictWarning={setConflictWarning}
      targetJobRange={targetJobRange}
      conflictTargetDateLabel={conflictTargetDateLabel}
      formatJobRange={formatJobRange}
      formatDateLabel={formatDateLabel}
      attemptAssign={attemptAssign}
    />
  );
};
