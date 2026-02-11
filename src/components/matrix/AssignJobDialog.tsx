import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Loader2, Calendar as CalendarIcon, Clock, CalendarDays, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { roleOptionsForDiscipline, codeForLabel, isRoleCode, labelForCode } from '@/utils/roles';
import { determineFlexDepartmentsForAssignment } from '@/utils/flexCrewAssignments';
import { checkTimeConflictEnhanced, ConflictCheckResult } from '@/utils/technicianAvailability';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';
import { removeTimesheetAssignment } from '@/services/removeTimesheetAssignment';

interface AssignJobDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  date: Date;
  availableJobs: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    status: string;
  }>;
  existingAssignment?: any;
  preSelectedJobId?: string;
}

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
  const [coverageMode, setCoverageMode] = useState<'full' | 'single' | 'multi'>(existingAssignment?.single_day ? 'single' : 'full');
  const [singleDate, setSingleDate] = useState<Date | null>(date);
  const [multiDates, setMultiDates] = useState<Date[]>(date ? [date] : []);
  const [assignAsConfirmed, setAssignAsConfirmed] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<{
    result: ConflictCheckResult;
    targetDate?: string;
    mode: 'full' | 'single' | 'multi';
  } | null>(null);
  // Modification mode: 'add' adds dates to existing, 'replace' replaces all dates
  const [modificationMode, setModificationMode] = useState<'add' | 'replace'>('add');

  // Get technician details
  const { data: technician } = useQuery({
    queryKey: ['technician', technicianId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
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
    queryKey: ['existing-timesheets', selectedJobId, technicianId],
    enabled: open && !!selectedJobId && !!technicianId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
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
      try { setSingleDate(new Date(`${existingAssignment.assignment_date}T00:00:00`)); } catch { }
    }
  }, [existingAssignment?.single_day, existingAssignment?.assignment_date]);

  // Update selected job when preSelectedJobId changes
  React.useEffect(() => {
    if (preSelectedJobId) {
      setSelectedJobId(preSelectedJobId);
    }
  }, [preSelectedJobId]);

  const checkForConflicts = async (): Promise<{
    result: ConflictCheckResult;
    targetDate?: string;
    mode: 'full' | 'single' | 'multi';
  } | null> => {
    if (!selectedJobId) {
      return null;
    }

    if (coverageMode === 'multi') {
      const uniqueKeys = Array.from(new Set((multiDates || []).map(d => format(d, 'yyyy-MM-dd'))));
      for (const key of uniqueKeys) {
        const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
          targetDateIso: key,
          singleDayOnly: true,
          includePending: true,
        });
        if (result.hasHardConflict || result.hasSoftConflict) {
          return { result, targetDate: key, mode: 'multi' };
        }
      }
      return null;
    }

    if (coverageMode === 'single') {
      const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
        targetDateIso: assignmentDate,
        singleDayOnly: true,
        includePending: true,
      });
      return (result.hasHardConflict || result.hasSoftConflict)
        ? { result, targetDate: assignmentDate, mode: 'single' }
        : null;
    }

    const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
      includePending: true,
    });
    return (result.hasHardConflict || result.hasSoftConflict)
      ? { result, mode: 'full' }
      : null;
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

    // Wait for existing timesheets query to complete when we need it
    if (isLoadingExistingTimesheets) {
      console.log('Waiting for existing timesheets to load...');
      toast.error('Cargando hojas de hora existentes, por favor espera...');
      return;
    }

    if (!skipConflictCheck) {
      const conflict = await checkForConflicts();
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

      // Before writing, check if an assignment already exists for this job + technician
      const { data: existingRow } = await supabase
        .from('job_assignments')
        .select('job_id, technician_id, single_day, assignment_date, status')
        .eq('job_id', selectedJobId)
        .eq('technician_id', technicianId)
        .maybeSingle();

      // For multi-date selection, mark as single_day=true with first date to avoid assigning full job span
      const desiredSingleDay = coverageMode !== 'full';
      const desiredAssignmentDate = coverageMode === 'single'
        ? assignmentDate
        : coverageMode === 'multi' && multiDates && multiDates.length > 0
          ? format(multiDates[0], 'yyyy-MM-dd')
          : null;

      if (existingRow) {
        // Update the existing base row (whole job or single) to align with the requested coverage
        const updatePayload: any = {
          sound_role: basePayload.sound_role,
          lights_role: basePayload.lights_role,
          video_role: basePayload.video_role,
          assigned_by: basePayload.assigned_by,
          assigned_at: basePayload.assigned_at,
          // Do not downgrade a confirmed assignment to invited
          status: existingRow.status === 'confirmed' && basePayload.status !== 'confirmed' ? 'confirmed' : basePayload.status,
          response_time: basePayload.status === 'confirmed' ? basePayload.response_time : existingRow.status === 'confirmed' ? (existingRow as any).response_time ?? null : null,
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

      // Handle timesheet updates based on whether we're modifying the selected job
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
          const uniqueKeys = Array.from(new Set((multiDates || []).map(d => format(d, 'yyyy-MM-dd'))));
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
          const { data: jobData } = await supabase
            .from('jobs')
            .select('start_time, end_time')
            .eq('id', selectedJobId)
            .single();

          if (jobData) {
            const startDate = new Date(jobData.start_time);
            const endDate = new Date(jobData.end_time);
            const dates: string[] = [];

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              dates.push(format(d, 'yyyy-MM-dd'));
            }
            return dates;
          }
        }
        return [];
      })();

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
        const { error: deleteError } = await supabase
          .from('timesheets')
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

      const statusText = assignAsConfirmed ? 'confirmed' : 'invited';
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
      } catch (_) {
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

  const handleCheckboxChange = (checked: boolean | "indeterminate") => {
    // Convert CheckedState to boolean, treating "indeterminate" as false
    setAssignAsConfirmed(checked === true);
  };

  // Build selected job date range to constrain calendar selection
  const selectedJobMeta = useMemo(() => {
    const j = selectedJob;
    if (!j) return null as null | { start?: Date; end?: Date };
    const s = j.start_time ? new Date(j.start_time) : undefined;
    const e = j.end_time ? new Date(j.end_time) : s;
    if (s) s.setHours(0, 0, 0, 0);
    if (e) e.setHours(0, 0, 0, 0);
    return { start: s, end: e };
  }, [selectedJob]);

  const isAllowedDate = (d: Date) => {
    if (!selectedJobMeta?.start || !selectedJobMeta?.end) return true;
    const t = new Date(d); t.setHours(0, 0, 0, 0);
    return t >= selectedJobMeta.start && t <= selectedJobMeta.end;
  };

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
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isReassignment ? 'Reasignar Trabajo' : 'Asignar Trabajo'}</DialogTitle>
            <DialogDescription>
              {isReassignment ? 'Reasignar a' : 'Asignar a'} {technician?.first_name} {technician?.last_name} a un trabajo el{' '}
              {format(date, 'EEEE, d MMMM, yyyy')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {technician && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Técnico:</span>
                <span>{technician.first_name} {technician.last_name}</span>
                <Badge variant="outline">{technician.department}</Badge>
              </div>
            )}

            {isReassignment && existingAssignment?.jobs && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="text-sm font-medium text-yellow-800">Asignación Actual:</div>
                <div className="text-sm text-yellow-700">{existingAssignment.jobs.title}</div>
                <div className="text-xs text-yellow-600">
                  Estado: <Badge variant="secondary">{existingAssignment.status}</Badge>
                </div>
              </div>
            )}

            {!preSelectedJobId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Seleccionar Trabajo</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un trabajo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredJobs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No hay trabajos disponibles para esta fecha
                      </div>
                    ) : (
                      filteredJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{job.title}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(job.start_time), 'HH:mm')} - {format(new Date(job.end_time), 'HH:mm')}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedJobId && technician && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Seleccionar Rol ({technician.department})
                </label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un rol..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedJobId && selectedRole && (
              <div className="space-y-4">
                {/* Modification mode toggle - only show when modifying the same job */}
                {isModifyingSelectedJob && coverageMode !== 'full' && existingTimesheets && existingTimesheets.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="text-sm font-medium text-blue-900 block mb-2">
                      Modo de Modificación
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={modificationMode === 'add' ? 'default' : 'outline'}
                        onClick={() => setModificationMode('add')}
                        className="flex-1"
                      >
                        Añadir Fechas
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={modificationMode === 'replace' ? 'default' : 'outline'}
                        onClick={() => setModificationMode('replace')}
                        className="flex-1"
                      >
                        Reemplazar Fechas
                      </Button>
                    </div>
                    <p className="text-xs text-blue-700 mt-2">
                      {modificationMode === 'add'
                        ? `Añadir: Las fechas seleccionadas se añadirán a las ${existingTimesheets.length} fecha(s) existente(s).`
                        : `Reemplazar: Las fechas existentes serán reemplazadas por las fechas seleccionadas.`
                      }
                    </p>
                  </div>
                )}

                <Tabs value={coverageMode} onValueChange={(v) => setCoverageMode(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="full">
                      <CalendarRange className="h-4 w-4 mr-2" />
                      Completo
                    </TabsTrigger>
                    <TabsTrigger value="single">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Día Suelto
                    </TabsTrigger>
                    <TabsTrigger value="multi">
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Varios Días
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="full" className="mt-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground flex items-center gap-3">
                      <CalendarRange className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Asignación Completa</p>
                        <p>El técnico será asignado a todos los días de este trabajo.</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="single" className="mt-4 space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Seleccionar Fecha</label>
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {singleDate ? format(singleDate, 'PPP') : <span>Elige una fecha</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPicker
                              mode="single"
                              selected={singleDate ?? undefined}
                              onSelect={(d) => { if (d && isAllowedDate(d)) setSingleDate(d); }}
                              disabled={(d) => !isAllowedDate(d)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="text-xs text-muted-foreground">Crea una asignación de un solo día para la fecha seleccionada.</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="multi" className="mt-4 space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Seleccionar Días</label>
                      <div className="border rounded-md p-2 flex justify-center">
                        <CalendarPicker
                          mode="multiple"
                          selected={multiDates}
                          onSelect={(ds) => setMultiDates((ds || []).filter(d => isAllowedDate(d)))}
                          disabled={(d) => !isAllowedDate(d)}
                          className="rounded-md border-none shadow-none"
                          numberOfMonths={1}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Selecciona varios días para esta asignación.</p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Checkbox
                    id="confirm-assignment"
                    checked={assignAsConfirmed}
                    onCheckedChange={handleCheckboxChange}
                  />
                  <label
                    htmlFor="confirm-assignment"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Asignar como confirmado (omitir invitación)
                  </label>
                </div>
              </div>
            )}

            {selectedJob && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-medium">{selectedJob.title}</span>
                  <Badge variant="secondary">{selectedJob.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(selectedJob.start_time), 'HH:mm')} - {format(new Date(selectedJob.end_time), 'HH:mm')}
                  </div>
                </div>
                {selectedRole && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Role: {labelForCode(selectedRole)}
                  </div>
                )}
                {assignAsConfirmed && (
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    Se asignará como confirmado
                  </div>
                )}
                {coverageMode === 'single' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cobertura de un solo día para {singleDate ? format(singleDate, 'PPP') : format(date, 'PPP')}
                  </div>
                )}
                {coverageMode === 'multi' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {multiDates.length} día(s) seleccionado(s) para cobertura de un solo día
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <div className="mr-auto">
              {isReassignment && (
                <Button
                  variant="destructive"
                  onClick={handleRemoveAssignment}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    'Eliminar Asignación'
                  )}
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedJobId || !selectedRole || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                `${isReassignment ? 'Reasignar' : 'Asignar'} Trabajo`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!conflictWarning}
        onOpenChange={(openState) => {
          if (!openState) {
            setConflictWarning(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflictWarning?.result.hasHardConflict ? '⛔ Conflicto de Horario' : '⚠️ Conflicto Potencial'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {conflictWarning && (
                  <>
                    <p className="text-sm">
                      {technician ? `${technician.first_name} ${technician.last_name}` : 'Este técnico'} tiene conflictos
                      con <strong>{selectedJob?.title}</strong>
                      {conflictWarning.mode === 'full' && targetJobRange ? ` (${targetJobRange})` : ''}
                      {conflictWarning.mode !== 'full' && conflictTargetDateLabel ? ` el ${conflictTargetDateLabel}` : ''}:
                    </p>

                    {/* Hard Conflicts */}
                    {conflictWarning.result.hardConflicts.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="font-semibold text-red-900 mb-2">Asignaciones Confirmadas:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {conflictWarning.result.hardConflicts.map((conflict, idx) => (
                            <li key={idx} className="text-red-800 text-sm">
                              <strong>{conflict.title}</strong>
                              {' '}({formatJobRange(conflict.start_time, conflict.end_time)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Soft Conflicts */}
                    {conflictWarning.result.softConflicts.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="font-semibold text-yellow-900 mb-2">Invitaciones Pendientes:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {conflictWarning.result.softConflicts.map((conflict, idx) => (
                            <li key={idx} className="text-yellow-800 text-sm">
                              <strong>{conflict.title}</strong>
                              {' '}({formatJobRange(conflict.start_time, conflict.end_time)})
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-yellow-700 mt-2">
                          El técnico aún no ha respondido a estas invitaciones.
                        </p>
                      </div>
                    )}

                    {/* Unavailability */}
                    {conflictWarning.result.unavailabilityConflicts.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="font-semibold text-red-900 mb-2">Fechas No Disponibles:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {conflictWarning.result.unavailabilityConflicts.map((unav, idx) => (
                            <li key={idx} className="text-red-800 text-sm">
                              {formatDateLabel(unav.date)} - {unav.reason}
                              {unav.notes && <span className="text-xs"> ({unav.notes})</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-sm text-gray-600 mt-3">
                      {conflictWarning.result.hasHardConflict
                        ? 'Continuar creará una doble reserva. ¿Estás seguro?'
                        : 'El técnico podría no estar disponible. ¿Quieres continuar de todos modos?'}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictWarning(null)}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConflictWarning(null);
                void attemptAssign(true);
              }}
              className={conflictWarning?.result.hasHardConflict ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {conflictWarning?.result.hasHardConflict ? 'Forzar asignación de todos modos' : 'Continuar de todos modos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
