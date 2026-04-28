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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { roleOptionsForDiscipline, codeForLabel, isRoleCode, labelForCode } from '@/utils/roles';
import { formatInJobTimezone } from '@/utils/timezoneUtils';
import { CoverageModeSelector } from '@/components/matrix/assign-job-dialog/CoverageModeSelector';
import { ConflictReviewDialog } from '@/components/matrix/assign-job-dialog/ConflictReviewDialog';
import { type ConflictWarningPayload } from '@/components/matrix/assign-job-dialog/conflictUtils';
import { useAssignJobMutations } from '@/components/matrix/assign-job-dialog/useAssignJobMutations';

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
  const [conflictWarning, setConflictWarning] = useState<ConflictWarningPayload | null>(null);
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
  const assignmentDate = React.useMemo(
    () => formatInJobTimezone(singleDate ?? date, 'yyyy-MM-dd'),
    [date, singleDate]
  );

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

  const {
    attemptAssign,
    handleRemoveAssignment,
    isAssigning,
    isRemoving,
  } = useAssignJobMutations({
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
  });

  const handleAssign = () => {
    void attemptAssign();
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

  const targetJobRange = selectedJob
    ? `${formatInJobTimezone(selectedJob.start_time, 'PPP', 'Europe/Madrid', { locale: es })} – ${formatInJobTimezone(selectedJob.end_time, 'PPP', 'Europe/Madrid', { locale: es })}`
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isReassignment ? 'Reasignar Trabajo' : 'Asignar Trabajo'}</DialogTitle>
            <DialogDescription>
              {isReassignment ? 'Reasignar a' : 'Asignar a'} {technician?.first_name} {technician?.last_name} a un trabajo el{' '}
              {formatInJobTimezone(date, 'EEEE, d MMMM, yyyy', 'Europe/Madrid', { locale: es })}
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
                                {formatInJobTimezone(job.start_time, 'HH:mm', 'Europe/Madrid', { locale: es })} - {formatInJobTimezone(job.end_time, 'HH:mm', 'Europe/Madrid', { locale: es })}
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
              <CoverageModeSelector
                coverageMode={coverageMode}
                setCoverageMode={setCoverageMode}
                isModifyingSelectedJob={isModifyingSelectedJob}
                existingTimesheets={existingTimesheets}
                modificationMode={modificationMode}
                setModificationMode={setModificationMode}
                singleDate={singleDate}
                setSingleDate={setSingleDate}
                multiDates={multiDates}
                setMultiDates={setMultiDates}
                isAllowedDate={isAllowedDate}
                assignAsConfirmed={assignAsConfirmed}
                handleCheckboxChange={handleCheckboxChange}
              />
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
                    {formatInJobTimezone(selectedJob.start_time, 'HH:mm', 'Europe/Madrid', { locale: es })} - {formatInJobTimezone(selectedJob.end_time, 'HH:mm', 'Europe/Madrid', { locale: es })}
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
                    Cobertura de un solo día para {singleDate
                      ? formatInJobTimezone(singleDate, 'PPP', 'Europe/Madrid', { locale: es })
                      : formatInJobTimezone(date, 'PPP', 'Europe/Madrid', { locale: es })}
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
      <ConflictReviewDialog
        conflictWarning={conflictWarning}
        technicianName={technician ? `${technician.first_name} ${technician.last_name}` : ''}
        selectedJobTitle={selectedJob?.title}
        targetJobRange={targetJobRange}
        onClose={() => setConflictWarning(null)}
        onContinue={() => {
          setConflictWarning(null);
          void attemptAssign(true);
        }}
      />
    </>
  );
};
