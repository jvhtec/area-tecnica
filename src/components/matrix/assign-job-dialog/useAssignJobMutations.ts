import { useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import type { TablesInsert } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { determineFlexDepartmentsForAssignment } from '@/utils/flexCrewAssignments';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';
import { removeTimesheetAssignment } from '@/services/removeTimesheetAssignment';
import { syncTimesheetCategoriesForAssignment } from '@/services/syncTimesheetCategories';
import { getConflictWarning, type ConflictWarningPayload } from '@/components/matrix/assign-job-dialog/conflictUtils';

interface UseAssignJobMutationsProps {
  selectedJobId: string;
  selectedRole: string;
  technicianId: string;
  technician?: { first_name?: string; last_name?: string; department?: string } | null;
  selectedJob?: { id: string; title: string; start_time: string; end_time: string; status: string };
  existingAssignment?: any;
  isReassignment: boolean;
  isModifyingSameJobByContext: boolean;
  isModifyingSelectedJob: boolean;
  isLoadingExistingTimesheets: boolean;
  existingTimesheets?: string[];
  coverageMode: 'full' | 'single' | 'multi';
  assignmentDate: string;
  multiDates: Date[];
  modificationMode: 'add' | 'replace';
  assignAsConfirmed: boolean;
  setConflictWarning: (warning: ConflictWarningPayload | null) => void;
  onClose: () => void;
}

export const useAssignJobMutations = ({
  selectedJobId,
  selectedRole,
  technicianId,
  technician,
  selectedJob,
  existingAssignment,
  isReassignment,
  isModifyingSameJobByContext,
  isModifyingSelectedJob,
  isLoadingExistingTimesheets,
  existingTimesheets,
  coverageMode,
  assignmentDate,
  multiDates,
  modificationMode,
  assignAsConfirmed,
  setConflictWarning,
  onClose,
}: UseAssignJobMutationsProps) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const computeResponseTime = (existingRow: any, baseStatus: 'confirmed' | 'invited', baseResponseTime: string | null) => {
    if (baseStatus === 'confirmed') return baseResponseTime;
    if (existingRow?.status === 'confirmed') return existingRow?.response_time ?? null;
    return null;
  };
  const syncCoverageTimesheets = async (
    desiredDates: string[],
    existingDatesForSelectedJob: string[],
  ) => {
    const uniqueDates = Array.from(new Set(desiredDates));
    if (uniqueDates.length === 0) {
      throw new Error('Selecciona al menos una fecha de cobertura');
    }

    const upsertRows = uniqueDates.map((dateIso) => ({
      job_id: selectedJobId,
      technician_id: technicianId,
      date: dateIso,
      status: 'draft',
      source: 'assignment-dialog',
      is_active: true,
    })) as Array<TablesInsert<'timesheets'> & { is_active: boolean }>;

    const { error: upsertError } = await supabase
      .from('timesheets')
      .upsert(upsertRows, { onConflict: 'job_id,technician_id,date' });

    if (upsertError) {
      throw new Error(`No se pudieron actualizar las hojas de hora: ${upsertError.message}`);
    }

    const datesToRemove = existingDatesForSelectedJob.filter((dateIso) => !uniqueDates.includes(dateIso));
    if (datesToRemove.length === 0) {
      return;
    }

    const removeResults = await Promise.allSettled(
      datesToRemove.map((dateIso) =>
        supabase
          .from('timesheets')
          .delete()
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId)
          .eq('date', dateIso),
      ),
    );

    const removeFailures = removeResults
      .map((result, index) => ({ result, date: datesToRemove[index] }))
      .filter(({ result }) => result.status === 'rejected');

    if (removeFailures.length > 0) {
      const failedDates = removeFailures.map(({ date }) => date).join(', ');
      throw new Error(`No se pudieron limpiar las hojas de hora antiguas: ${failedDates}`);
    }

    const deleteErrors = removeResults
      .filter((result): result is PromiseFulfilledResult<{ error?: { message?: string } | null }> => result.status === 'fulfilled')
      .map((result) => result.value?.error)
      .filter((error): error is { message?: string } => Boolean(error));

    if (deleteErrors.length > 0) {
      throw new Error(`No se pudieron limpiar las hojas de hora antiguas: ${deleteErrors[0].message ?? 'error desconocido'}`);
    }
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

    if (isAssigning) {
      console.log('Assignment already in progress, ignoring duplicate click');
      return;
    }

    if (isLoadingExistingTimesheets) {
      console.log('Waiting for existing timesheets to load...');
      toast.error('Cargando hojas de hora existentes, por favor espera...');
      return;
    }

    if (!skipConflictCheck) {
      try {
        const conflict = await getConflictWarning({
          selectedJobId,
          coverageMode,
          technicianId,
          assignmentDate,
          multiDates,
        });
        if (conflict) {
          setConflictWarning(conflict);
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo comprobar los conflictos de agenda';
        toast.error(message);
        return;
      }
    }

    setIsAssigning(true);
    console.log('Starting assignment:', { selectedJobId, selectedRole, technicianId, isReassignment });

    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      console.error('Assignment timeout after 10 seconds');
      toast.error('La asignación está tardando más de lo esperado. Espera a que termine antes de reintentar.');
    }, 10000);

    try {
      const soundRole = technician.department === 'sound' ? selectedRole : 'none';
      const lightsRole = technician.department === 'lights' ? selectedRole : 'none';
      const videoRole = technician.department === 'video' ? selectedRole : 'none';

      console.log('Role assignments:', { soundRole, lightsRole, videoRole, department: technician.department });

      if (isReassignment && !isModifyingSameJobByContext) {
        const { deleted_assignment } = await removeTimesheetAssignment({ jobId: existingAssignment.job_id, technicianId });

        if (!deleted_assignment) {
          const { error: deleteError } = await supabase
            .from('job_assignments')
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
              const { error: flexError } = await supabase.functions.invoke('manage-flex-crew-assignments', {
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
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
        assigned_at: new Date().toISOString(),
        status: assignAsConfirmed ? 'confirmed' : 'invited',
        response_time: assignAsConfirmed ? new Date().toISOString() : null,
        assignment_source: 'direct' as const,
      } as const;

      const { data: existingRow, error: existingRowError } = await supabase
        .from('job_assignments')
        .select('job_id, technician_id, single_day, assignment_date, status, response_time')
        .eq('job_id', selectedJobId)
        .eq('technician_id', technicianId)
        .maybeSingle();
      if (existingRowError) {
        throw new Error(`No se pudo comprobar la asignación existente: ${existingRowError.message}`);
      }

      const desiredSingleDay = coverageMode !== 'full';
      const desiredAssignmentDate = coverageMode === 'single'
        ? assignmentDate
        : coverageMode === 'multi' && multiDates && multiDates.length > 0
          ? format(multiDates[0], 'yyyy-MM-dd')
          : null;

      if (existingRow) {
        const updatePayload: any = {
          sound_role: basePayload.sound_role,
          lights_role: basePayload.lights_role,
          video_role: basePayload.video_role,
          assigned_by: basePayload.assigned_by,
          assigned_at: basePayload.assigned_at,
          status: existingRow.status === 'confirmed' && basePayload.status !== 'confirmed' ? 'confirmed' : basePayload.status,
          response_time: computeResponseTime(existingRow, basePayload.status, basePayload.response_time),
          single_day: desiredSingleDay,
          assignment_date: desiredAssignmentDate,
          assignment_source: basePayload.assignment_source,
        };

        console.log('Updating existing assignment with data:', updatePayload);
        const { error } = await supabase
          .from('job_assignments')
          .update(updatePayload)
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId);
        if (error) throw error;
      } else {
        const row = { ...basePayload, single_day: desiredSingleDay, assignment_date: desiredAssignmentDate };
        console.log('Inserting assignment row:', row);
        const { error: insErr } = await supabase.from('job_assignments').insert(row);
        if (insErr) {
          if (insErr.code === '23505') {
            console.warn('Duplicate on insert. Updating existing base row.');
            const { error: updErr } = await supabase
              .from('job_assignments')
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

      let existingDates: string[] = [];
      if (isModifyingSelectedJob) {
        const { data: freshTimesheets, error: freshTimesheetsError } = await supabase
          .from('timesheets')
          .select('date')
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId)
          .eq('is_active', true);

        if (freshTimesheetsError) throw freshTimesheetsError;
        existingDates = freshTimesheets?.map((t) => t.date) || [];
      } else {
        existingDates = existingTimesheets || [];
      }

      const coverageDates: string[] = await (async () => {
        if (coverageMode === 'multi') {
          const uniqueKeys = Array.from(new Set((multiDates || []).map((d) => format(d, 'yyyy-MM-dd'))));
          if (uniqueKeys.length === 0) {
            throw new Error('Selecciona al menos una fecha');
          }
          return uniqueKeys;
        }
        if (coverageMode === 'single' && assignmentDate) {
          return [assignmentDate];
        }
        if (coverageMode === 'full') {
          const { data: jobData, error: jobDataError } = await supabase
            .from('jobs')
            .select('start_time, end_time')
            .eq('id', selectedJobId)
            .single();
          if (jobDataError) {
            throw new Error(`No se pudo cargar la cobertura del trabajo: ${jobDataError.message}`);
          }

          if (jobData) {
            const startDate = startOfDay(new Date(jobData.start_time));
            const endDate = startOfDay(new Date(jobData.end_time));

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
              throw new Error('El trabajo no tiene fechas válidas para calcular la cobertura');
            }

            if (endDate < startDate) {
              throw new Error('El rango de fechas del trabajo no es válido para generar la cobertura');
            }

            const dates: string[] = [];

            let i = 0;
            while (addDays(startDate, i) <= endDate) {
              dates.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
              i += 1;
            }
            return dates;
          }
        }
        return [];
      })();

      if (coverageDates.length === 0) {
        throw new Error(
          coverageMode === 'full'
            ? 'El trabajo no tiene un rango de fechas válido para generar hojas de hora'
            : 'Selecciona al menos una fecha de cobertura',
        );
      }

      if (isModifyingSelectedJob) {
        if (modificationMode === 'add') {
          const datesToCreate = coverageDates.filter((d) => !existingDates.includes(d));
          console.log('Add mode - creating timesheets for new dates:', datesToCreate);

          const results = await Promise.allSettled(datesToCreate.map((dateIso) =>
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
          console.log('Replace mode - replacing timesheets. Old:', existingDates, 'New:', coverageDates);

          const datesToRemove = existingDates.filter((d) => !coverageDates.includes(d));
          const removeResults = await Promise.allSettled(datesToRemove.map((dateIso) =>
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

          const datesToCreate = coverageDates.filter((d) => !existingDates.includes(d));
          const createResults = await Promise.allSettled(datesToCreate.map((dateIso) =>
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
        console.log('Different job or new assignment - synchronizing timesheets without destructive delete-first');
        const { data: freshTimesheets, error: freshTimesheetsError } = await supabase
          .from('timesheets')
          .select('date')
          .eq('job_id', selectedJobId)
          .eq('technician_id', technicianId)
          .eq('is_active', true);

        if (freshTimesheetsError) {
          console.error('Error loading existing timesheets before sync:', freshTimesheetsError);
          throw new Error(`No se pudieron cargar las hojas de hora existentes: ${freshTimesheetsError.message}`);
        }

        await syncCoverageTimesheets(
          coverageDates,
          freshTimesheets?.map((timesheet) => timesheet.date) || [],
        );
      }

      const verifyQuery = supabase
        .from('job_assignments')
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
          const { error: flexError } = await supabase.functions.invoke('manage-flex-crew-assignments', {
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
          const { error: flexError } = await supabase.functions.invoke('manage-flex-crew-assignments', {
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

      const statusText = assignAsConfirmed ? 'confirmado' : 'invitado';
      console.log('Assignment completed successfully');
      window.clearTimeout(timeoutId);
      toast.success(
        `${isReassignment ? 'Reasignado' : 'Asignado'} ${technician.first_name} ${technician.last_name} a ${selectedJob?.title} (${statusText})`
      );

      const recipientName = `${technician.first_name ?? ''} ${technician.last_name ?? ''}`.trim();
      try {
        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'job.assignment.direct',
            job_id: selectedJobId,
            recipient_id: technicianId,
            recipient_name: recipientName || undefined,
            assignment_status: assignAsConfirmed ? 'confirmed' : 'invited',
            target_date: coverageMode === 'single' ? `${assignmentDate}T00:00:00Z` : undefined,
            single_day: coverageMode !== 'full'
          }
        });
      } catch {
        // Push failures are non-blocking for the assignment flow.
      }

      window.dispatchEvent(new CustomEvent('assignment-updated', {
        detail: { technicianId, jobId: selectedJobId }
      }));

      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error: any) {
      window.clearTimeout(timeoutId);
      console.error('Error assigning job:', error);

      if (didTimeout) {
        return;
      }

      if (error.code === '23505') {
        toast.error('Este técnico ya está asignado a este trabajo');
      } else if (error.message?.includes('timeout') || error.message?.includes('network')) {
        toast.error('Error de red - por favor verifica tu conexión e intenta de nuevo');
      } else {
        toast.error(`Error al asignar el trabajo: ${error.message || 'Error desconocido'}`);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!existingAssignment) return;
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      const { deleted_assignment } = await removeTimesheetAssignment({ jobId: existingAssignment.job_id, technicianId });

      if (!deleted_assignment) {
        const { error } = await supabase
          .from('job_assignments')
          .delete()
          .eq('job_id', existingAssignment.job_id)
          .eq('technician_id', technicianId);
        if (error) throw error;
      }

      const departmentsToRemove = determineFlexDepartmentsForAssignment(existingAssignment, technician?.department);
      if (existingAssignment?.job_id && departmentsToRemove.length > 0) {
        await Promise.allSettled(departmentsToRemove.map(async (department) => {
          try {
            const { error: flexError } = await supabase.functions.invoke('manage-flex-crew-assignments', {
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
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar la asignación');
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    attemptAssign,
    handleRemoveAssignment,
    isAssigning,
    isRemoving,
  };
};
