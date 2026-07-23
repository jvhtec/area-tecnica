import { dataLayerClient } from '@/services/dataLayerClient';
import { removeTimesheetAssignment } from '@/services/removeTimesheetAssignment';
import { syncTimesheetCategoriesForAssignment } from '@/services/syncTimesheetCategories';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';
import { getAssignmentNotificationDepartments } from '@/utils/assignmentNotificationDepartments';
import { normalizeDateKey } from '@/utils/assignmentWorkDates';
import { determineFlexDepartmentsForAssignment } from '@/utils/flexCrewAssignments';
import { codeForLabel, isRoleCode, roleOptionsForDiscipline } from '@/utils/roles';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';


import { AssignJobDialogView } from "@/components/matrix/AssignJobDialogView";
import {
  checkAssignmentConflicts,
  type AssignmentConflictWarning,
} from "@/components/matrix/assignJobConflicts";
import {
  formatDateKey,
  getAssignableJobDateKeys,
  getErrorCode,
  getErrorMessage,
  parseDateKey,
  sortDateKeys,
  type AssignJobDialogProps,
  type CoverageMode,
  type JobAssignmentUpdate
} from "@/components/matrix/assignJobDialogTypes";
import { queryKeys } from "@/lib/react-query";
import { addMadridCalendarDays } from "@/utils/timezoneUtils";

export { getAssignableJobDateKeys } from "@/components/matrix/assignJobDialogTypes";
export type {
  AssignableJob,
  CoverageMode,
  ExistingAssignment
} from "@/components/matrix/assignJobDialogTypes";

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
  const [singleDate, setSingleDate] = useState<Date | null>(date);
  const [multiDates, setMultiDates] = useState<Date[]>(date ? [date] : []);
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
  // IMPORTANT: use local yyyy-MM-dd, not toISOString (which is UTC)
  const assignmentDate = React.useMemo(() => format((singleDate ?? date), 'yyyy-MM-dd'), [date, singleDate]);

  // Fetch existing timesheets for this job+technician.
  // This is needed even when existingAssignment is undefined (adding a new day to an existing job).
  const { data: existingTimesheets, isLoading: isLoadingExistingTimesheets } = useQuery({
    queryKey: queryKeys.scope('existing-timesheets', selectedJobId, technicianId),
    enabled: open && !!selectedJobId && !!technicianId,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('timesheets')
        .select('date')
        .eq('job_id', selectedJobId)
        .eq('technician_id', technicianId)
        .eq('is_active', true);
      if (error) throw error;
      return data?.map(t => t.date) || [];
    },
    staleTime: 10_000,
  });

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

  const attemptAssign = async (skipConflictCheck = false) => {
    if (!selectedJobId || !selectedRole || !technician) {
      toast.error('Por favor selecciona un trabajo y un rol');
      return;
    }

    if (existingAssignment?.status === 'declined' && selectedJobId === existingAssignment.job_id) {
      toast.error('Este técnico ya rechazó este trabajo');
      return;
    }

    if (isAssigning) {
      console.log('Assignment already in progress, ignoring duplicate click');
      return;
    }

    // Wait for existing timesheets query to complete when we need it
    if (isLoadingExistingTimesheets) {
      console.log('Waiting for existing timesheets to load...');
      toast.error('Cargando hojas de hora existentes, por favor espera...');
      return;
    }

    if (!skipConflictCheck) {
      const conflict = await checkAssignmentConflicts({
        technicianId,
        selectedJobId,
        coverageMode,
        multiDates,
        assignmentDate,
      });
      if (conflict) {
        setConflictWarning(conflict);
        return;
      }
    }

    setIsAssigning(true);
    console.log('Starting assignment:', { selectedJobId, selectedRole, technicianId, isReassignment });

    const timeoutId = window.setTimeout(() => {
      console.error('Assignment timeout after 10 seconds');
      setIsAssigning(false);
      toast.error('La asignación expiró - por favor intenta de nuevo');
    }, 10000);

    try {
      const soundRole = technician.department === 'sound' ? selectedRole : 'none';
      const lightsRole = technician.department === 'lights' ? selectedRole : 'none';
      const videoRole = technician.department === 'video' ? selectedRole : 'none';

      console.log('Role assignments:', { soundRole, lightsRole, videoRole, department: technician.department });

      if (isReassignment && !isModifyingSameJobByContext) {
        const { deleted_assignment } = await removeTimesheetAssignment({ jobId: existingAssignment.job_id, technicianId });

        if (!deleted_assignment) {
          const { error: deleteError } = await dataLayerClient.from('job_assignments')
            .delete()
            .eq('job_id', existingAssignment.job_id)
            .eq('technician_id', technicianId);

          if (deleteError) {
            console.error('Error removing old assignment after RPC fallback:', deleteError);
            throw deleteError;
          }
        }

        const departmentsToRemove = determineFlexDepartmentsForAssignment(existingAssignment, technician?.department);
        if (existingAssignment?.job_id && departmentsToRemove.length > 0) {
          await Promise.allSettled(departmentsToRemove.map(async (department) => {
            try {
              const { error: flexError } = await dataLayerClient.functions.invoke('manage-flex-crew-assignments', {
                body: {
                  job_id: existingAssignment.job_id,
                  technician_id: technicianId,
                  department,
                  action: 'remove'
                }
              });

              if (flexError) {
                console.error(`Error removing from Flex crew (${department}):`, flexError);
              }
            } catch (flexError) {
              console.error(`Failed to remove from Flex crew (${department}):`, flexError);
            }
          }));
        }
      }

      const basePayload = {
        job_id: selectedJobId,
        technician_id: technicianId,
        sound_role: soundRole !== 'none' ? soundRole : null,
        lights_role: lightsRole !== 'none' ? lightsRole : null,
        video_role: videoRole !== 'none' ? videoRole : null,
        assigned_by: (await dataLayerClient.auth.getUser()).data.user?.id,
        assigned_at: new Date().toISOString(),
        status: assignAsConfirmed ? 'confirmed' : 'invited',
        response_time: assignAsConfirmed ? new Date().toISOString() : null,
        assignment_source: 'direct' as const,
      } as const;

      const coverageDates: string[] = await (async () => {
        if (coverageMode === 'multi') {
          const uniqueKeys = sortDateKeys((multiDates || []).map((multiDate) => formatDateKey(multiDate)));
          if (uniqueKeys.length === 0) {
            throw new Error('Selecciona al menos una fecha');
          }
          return uniqueKeys;
        }
        if (coverageMode === 'single' && assignmentDate) {
          return [assignmentDate];
        }
        if (coverageMode === 'full') {
          // For full job coverage, get all dates from job start to end
          const { data: jobData } = await dataLayerClient.from('jobs')
            .select('start_time, end_time')
            .eq('id', selectedJobId)
            .single();

          if (jobData) {
            const startKey = normalizeDateKey(jobData.start_time);
            const endKey = normalizeDateKey(jobData.end_time);
            if (!startKey || !endKey) return [];
            const dates: string[] = [];

            let cursorKey = startKey;
            while (cursorKey <= endKey) {
              dates.push(cursorKey);
              cursorKey = addMadridCalendarDays(cursorKey, 1);
            }
            return dates;
          }
        }
        return [];
      })();

      // Before writing, check if an assignment already exists for this job + technician
      const { data: existingRow } = await dataLayerClient.from('job_assignments')
        .select('job_id, technician_id, single_day, assignment_date, status, response_time')
        .eq('job_id', selectedJobId)
        .eq('technician_id', technicianId)
        .maybeSingle();

      // For multi-date selection, keep the base row single-day scoped without implying full job coverage.
      const desiredSingleDay = coverageMode !== 'full';
      const desiredAssignmentDate = desiredSingleDay ? coverageDates[0] ?? null : null;
      const preserveExistingScopedDate =
        Boolean(existingRow) &&
        isModifyingSelectedJob &&
        modificationMode === 'add' &&
        coverageMode !== 'full' &&
        Boolean(existingRow?.assignment_date);
      const nextSingleDay = preserveExistingScopedDate ? existingRow?.single_day ?? desiredSingleDay : desiredSingleDay;
      const nextAssignmentDate = preserveExistingScopedDate
        ? existingRow?.assignment_date ?? desiredAssignmentDate
        : desiredAssignmentDate;

      if (existingRow) {
        // Update the existing base row (whole job or single) to align with the requested coverage
        const updatePayload: JobAssignmentUpdate = {
          sound_role: basePayload.sound_role,
          lights_role: basePayload.lights_role,
          video_role: basePayload.video_role,
          assigned_by: basePayload.assigned_by,
          assigned_at: basePayload.assigned_at,
          // Do not downgrade a confirmed assignment to invited
          status: existingRow.status === 'confirmed' && basePayload.status !== 'confirmed' ? 'confirmed' : basePayload.status,
          response_time: basePayload.status === 'confirmed' ? basePayload.response_time : existingRow.status === 'confirmed' ? existingRow.response_time ?? null : null,
          single_day: nextSingleDay,
          assignment_date: nextAssignmentDate,
          assignment_source: basePayload.assignment_source,
        };

        console.log('Updating existing assignment with data:', updatePayload);
        const { error } = await dataLayerClient.from('job_assignments')
          .update(updatePayload)
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId);
        if (error) throw error;
      } else {
        const row = { ...basePayload, single_day: desiredSingleDay, assignment_date: desiredAssignmentDate };
        console.log('Inserting assignment row:', row);
        const { error: insErr } = await dataLayerClient.from('job_assignments').insert(row);
        if (insErr) {
          if (insErr.code === '23505') {
            console.warn('Duplicate on insert. Updating existing base row.');
            const { error: updErr } = await dataLayerClient.from('job_assignments')
              .update({
                sound_role: row.sound_role,
                lights_role: row.lights_role,
                video_role: row.video_role,
                assigned_by: row.assigned_by,
                assigned_at: row.assigned_at,
                status: row.status,
                response_time: row.response_time,
                single_day: row.single_day,
                assignment_date: row.assignment_date,
                assignment_source: row.assignment_source,
              })
              .eq('job_id', selectedJobId)
              .eq('technician_id', technicianId);
            if (updErr) throw updErr;
          } else {
            throw insErr;
          }
        }
      }

      // Handle timesheet updates based on whether we're modifying the selected job
      let existingDates: string[] = [];
      if (isModifyingSelectedJob) {
        const { data: freshTimesheets, error: freshTimesheetsError } = await dataLayerClient.from('timesheets')
          .select('date')
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId)
          .eq('is_active', true);

        if (freshTimesheetsError) throw freshTimesheetsError;
        existingDates = freshTimesheets?.map((t) => t.date) || [];
      } else {
        existingDates = existingTimesheets || [];
      }

      // Smart timesheet management based on modification mode
      if (isModifyingSelectedJob) {
        if (modificationMode === 'add') {
          // Add mode: Keep existing dates + add new ones
          const datesToCreate = coverageDates.filter(d => !existingDates.includes(d));
          console.log('Add mode - creating timesheets for new dates:', datesToCreate);

          // Use Promise.allSettled for parallel execution with failure handling
          const results = await Promise.allSettled(datesToCreate.map(dateIso =>
            toggleTimesheetDay({
              jobId: selectedJobId,
              technicianId,
              dateIso,
              present: true,
              source: 'assignment-dialog'
            })
          ));

          const failures = results
            .map((result, idx) => ({ result, date: datesToCreate[idx] }))
            .filter(({ result }) => result.status === 'rejected');

          if (failures.length > 0) {
            console.error('Some timesheets failed to create in add mode:', failures);
            const failedDates = failures.map(({ date }) => date).join(', ');
            throw new Error(`Error al añadir hojas de hora para las fechas: ${failedDates}`);
          }
        } else {
          // Replace mode: Remove dates not in new coverage, add missing ones
          console.log('Replace mode - replacing timesheets. Old:', existingDates, 'New:', coverageDates);

          // Delete dates that are no longer needed (parallel execution with failure handling)
          const datesToRemove = existingDates.filter(d => !coverageDates.includes(d));
          const removeResults = await Promise.allSettled(datesToRemove.map(dateIso =>
            toggleTimesheetDay({
              jobId: selectedJobId,
              technicianId,
              dateIso,
              present: false,
              source: 'assignment-dialog'
            })
          ));

          const removeFailures = removeResults
            .map((result, idx) => ({ result, date: datesToRemove[idx] }))
            .filter(({ result }) => result.status === 'rejected');

          if (removeFailures.length > 0) {
            console.error('Some timesheets failed to remove in replace mode:', removeFailures);
            const failedDates = removeFailures.map(({ date }) => date).join(', ');
            throw new Error(`Error al eliminar hojas de hora para las fechas: ${failedDates}`);
          }

          // Create dates that don't exist yet (parallel execution with failure handling)
          const datesToCreate = coverageDates.filter(d => !existingDates.includes(d));
          const createResults = await Promise.allSettled(datesToCreate.map(dateIso =>
            toggleTimesheetDay({
              jobId: selectedJobId,
              technicianId,
              dateIso,
              present: true,
              source: 'assignment-dialog'
            })
          ));

          const createFailures = createResults
            .map((result, idx) => ({ result, date: datesToCreate[idx] }))
            .filter(({ result }) => result.status === 'rejected');

          if (createFailures.length > 0) {
            console.error('Some timesheets failed to create in replace mode:', createFailures);
            const failedDates = createFailures.map(({ date }) => date).join(', ');
            throw new Error(`Error al crear hojas de hora para las fechas: ${failedDates}`);
          }
        }
      } else {
        // Not modifying same job - delete all existing and create new (current behavior)
        console.log('Different job or new assignment - replacing all timesheets');
        const { error: deleteError } = await dataLayerClient.from('timesheets')
          .delete()
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId);

        if (deleteError) {
          console.error('Error deleting existing timesheets:', deleteError);
          throw new Error(`No se pudieron eliminar las hojas de hora existentes: ${deleteError.message}`);
        }

        // Use Promise.allSettled for parallel execution with failure handling
        const results = await Promise.allSettled(coverageDates.map(dateIso =>
          toggleTimesheetDay({
            jobId: selectedJobId,
            technicianId,
            dateIso,
            present: true,
            source: 'assignment-dialog'
          })
        ));

        const failures = results
          .map((result, idx) => ({ result, date: coverageDates[idx] }))
          .filter(({ result }) => result.status === 'rejected');

        if (failures.length > 0) {
          console.error('Some timesheets failed to create:', failures);
          const failedDates = failures.map(({ date }) => date).join(', ');
          throw new Error(`Error al crear hojas de hora para las fechas: ${failedDates}`);
        }
      }

      // Verification: ensure at least one assignment row now exists for this job/tech
      const verifyQuery = dataLayerClient.from('job_assignments')
        .select('job_id')
        .eq('job_id', selectedJobId)
        .eq('technician_id', technicianId)
        .limit(1);
      const { data: verifyData, error: verifyErr } = await verifyQuery;
      if (verifyErr) throw verifyErr;
      if (!verifyData || verifyData.length === 0) {
        throw new Error('La asignación no se guardó');
      }

      try {
        await syncTimesheetCategoriesForAssignment({
          jobId: selectedJobId,
          technicianId,
          soundRole: basePayload.sound_role,
          lightsRole: basePayload.lights_role,
          videoRole: basePayload.video_role,
        });
      } catch (syncError) {
        console.error('Error syncing timesheet category after assignment update:', syncError);
        toast.error('La asignación se guardó, pero no se pudo sincronizar la categoría de partes');
      }

      console.log('Assignment created successfully, now handling Flex crew assignments...');

      try {
        if (soundRole && soundRole !== 'none') {
          const { error: flexError } = await dataLayerClient.functions.invoke('manage-flex-crew-assignments', {
            body: {
              job_id: selectedJobId,
              technician_id: technicianId,
              department: 'sound',
              action: 'add'
            }
          });

          if (flexError) {
            console.error('Error adding to Flex crew (sound):', flexError);
          }
        }

        if (lightsRole && lightsRole !== 'none') {
          const { error: flexError } = await dataLayerClient.functions.invoke('manage-flex-crew-assignments', {
            body: {
              job_id: selectedJobId,
              technician_id: technicianId,
              department: 'lights',
              action: 'add'
            }
          });

          if (flexError) {
            console.error('Error adding to Flex crew (lights):', flexError);
          }
        }
      } catch (flexError) {
        console.error('Error with Flex crew assignments:', flexError);
      }

      const statusText = assignAsConfirmed ? 'confirmed' : 'invited';
      console.log('Assignment completed successfully');
      window.clearTimeout(timeoutId);
      toast.success(
        `${isReassignment ? 'Reasignado' : 'Asignado'} ${technician.first_name} ${technician.last_name} a ${selectedJob?.title} (${statusText})`
      );

      const recipientName = `${technician.first_name ?? ''} ${technician.last_name ?? ''}`.trim();
      const assignmentDepartments = getAssignmentNotificationDepartments(basePayload, technician.department);
      try {
        void dataLayerClient.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'job.assignment.direct',
            job_id: selectedJobId,
            recipient_id: technicianId,
            recipient_name: recipientName || undefined,
            assignment_status: assignAsConfirmed ? 'confirmed' : 'invited',
            target_date: coverageMode === 'single' ? `${assignmentDate}T00:00:00Z` : undefined,
            single_day: coverageMode !== 'full',
            department: assignmentDepartments[0],
            departments: assignmentDepartments,
          }
        });
      } catch (_) {
        /* best-effort push notification; ignore delivery failures */
      }

      window.dispatchEvent(new CustomEvent('assignment-updated', {
        detail: { technicianId, jobId: selectedJobId }
      }));

      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error: unknown) {
      window.clearTimeout(timeoutId);
      console.error('Error assigning job:', error);

      const errorMessage = getErrorMessage(error);
      if (getErrorCode(error) === '23505') {
        toast.error('Este técnico ya está asignado a este trabajo');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        toast.error('Error de red - por favor verifica tu conexión e intenta de nuevo');
      } else {
        toast.error(`Error al asignar el trabajo: ${errorMessage}`);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsAssigning(false);
    }
  };

  const handleAssign = () => {
    void attemptAssign();
  };

  const handleRemoveAssignment = async () => {
    if (!existingAssignment) return;
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      const { deleted_assignment } = await removeTimesheetAssignment({ jobId: existingAssignment.job_id, technicianId });

      if (!deleted_assignment) {
        const { error } = await dataLayerClient.from('job_assignments')
          .delete()
          .eq('job_id', existingAssignment.job_id)
          .eq('technician_id', technicianId);
        if (error) throw error;
      }

      const departmentsToRemove = determineFlexDepartmentsForAssignment(existingAssignment, technician?.department);
      if (existingAssignment?.job_id && departmentsToRemove.length > 0) {
        await Promise.allSettled(departmentsToRemove.map(async (department) => {
          try {
            const { error: flexError } = await dataLayerClient.functions.invoke('manage-flex-crew-assignments', {
              body: {
                job_id: existingAssignment.job_id,
                technician_id: technicianId,
                department,
                action: 'remove'
              }
            });

            if (flexError) {
              console.error(`Error removing from Flex crew (${department}):`, flexError);
            }
          } catch (flexError) {
            console.error(`Failed to remove from Flex crew (${department}):`, flexError);
          }
        }));
      }

      toast.success('Asignación eliminada');
      window.dispatchEvent(new CustomEvent('assignment-updated', { detail: { technicianId, jobId: existingAssignment.job_id } }));
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
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
    const key = formatDateKey(d);
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
          nextByKey.set(formatDateKey(currentDate), currentDate);
        }
      });
      existingTimesheetDateKeys.forEach((existingDateKey) => {
        const existingDate = parseDateKey(existingDateKey);
        if (isAllowedDate(existingDate)) {
          nextByKey.set(existingDateKey, existingDate);
        }
      });

      const nextDates = Array.from(nextByKey.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, nextDate]) => nextDate);
      const currentKey = currentDates.map(formatDateKey).sort().join('|');
      const nextKey = nextDates.map(formatDateKey).join('|');
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
      date={date}
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
