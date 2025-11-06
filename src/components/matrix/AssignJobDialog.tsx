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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { roleOptionsForDiscipline, codeForLabel, isRoleCode, labelForCode } from '@/utils/roles';

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
  // IMPORTANT: use local yyyy-MM-dd, not toISOString (which is UTC)
  const assignmentDate = React.useMemo(() => format((singleDate ?? date), 'yyyy-MM-dd'), [date, singleDate]);

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
      try { setSingleDate(new Date(`${existingAssignment.assignment_date}T00:00:00`)); } catch {}
    }
  }, [existingAssignment?.single_day, existingAssignment?.assignment_date]);

  // Update selected job when preSelectedJobId changes
  React.useEffect(() => {
    if (preSelectedJobId) {
      setSelectedJobId(preSelectedJobId);
    }
  }, [preSelectedJobId]);

  const handleAssign = async () => {
    if (!selectedJobId || !selectedRole || !technician) {
      toast.error('Please select both a job and role');
      return;
    }

    // Prevent re-assigning a declined technician to the same job
    if (existingAssignment?.status === 'declined' && selectedJobId === existingAssignment.job_id) {
      toast.error('This technician already declined this job');
      return;
    }

    if (isAssigning) {
      console.log('Assignment already in progress, ignoring duplicate click');
      return;
    }

    setIsAssigning(true);
    console.log('Starting assignment:', { selectedJobId, selectedRole, technicianId, isReassignment });

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('Assignment timeout after 10 seconds');
      setIsAssigning(false);
      toast.error('Assignment timed out - please try again');
    }, 10000);

    try {
      // Determine role assignment based on department
      const soundRole = technician.department === 'sound' ? selectedRole : 'none';
      const lightsRole = technician.department === 'lights' ? selectedRole : 'none';
      const videoRole = technician.department === 'video' ? selectedRole : 'none';

      console.log('Role assignments:', { soundRole, lightsRole, videoRole, department: technician.department });

      if (isReassignment) {
        // For reassignments, we need to remove the old assignment and create a new one
        // First remove the old assignment
        const { error: deleteError } = await supabase
          .from('job_assignments')
          .delete()
          .eq('job_id', existingAssignment.job_id)
          .eq('technician_id', technicianId);

        if (deleteError) {
          console.error('Error removing old assignment:', deleteError);
          throw deleteError;
        }
      }

      // Create new assignment(s)
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
      } as const;

      let insertError: any = null;
      if (coverageMode === 'multi') {
        const uniqueKeys = Array.from(new Set((multiDates || []).map(d => format(d, 'yyyy-MM-dd'))));
        if (uniqueKeys.length === 0) {
          throw new Error('Select at least one date');
        }
        const rows = uniqueKeys.map(dk => ({ ...basePayload, single_day: true, assignment_date: dk }));
        console.log('Creating multi single-day assignments:', rows);
        const { error } = await supabase.from('job_assignments').insert(rows);
        insertError = error;
      } else {
        const payload = { ...basePayload, single_day: coverageMode === 'single', assignment_date: coverageMode === 'single' ? assignmentDate : null };
        console.log('Creating assignment with data:', payload);
        const { error } = await supabase.from('job_assignments').insert(payload);
        insertError = error;
      }

      if (insertError) {
        console.error('Error creating assignment:', insertError);
        throw insertError;
      }

      console.log('Assignment created successfully, now handling Flex crew assignments...');

      // Handle Flex crew assignments for sound/lights departments
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
            // Don't fail the whole assignment for Flex errors
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
            // Don't fail the whole assignment for Flex errors
          }
        }
      } catch (flexError) {
        console.error('Error with Flex crew assignments:', flexError);
        // Continue without failing the assignment
      }
      
      const statusText = assignAsConfirmed ? 'confirmed' : 'invited';
      console.log('Assignment completed successfully');
      clearTimeout(timeoutId);
      toast.success(
        `${isReassignment ? 'Reassigned' : 'Assigned'} ${technician.first_name} ${technician.last_name} to ${selectedJob?.title} (${statusText})`
      );

      // Send push notification for direct assignments
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
        // Non-blocking push failure
      }

      // Force refresh of queries by dispatching a custom event
      window.dispatchEvent(new CustomEvent('assignment-updated', {
        detail: { technicianId, jobId: selectedJobId }
      }));
      
      // Small delay to ensure the toast is visible before closing
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error assigning job:', error);
      
      // Provide more specific error messages
      if (error.code === '23505') {
        toast.error('This technician is already assigned to this job');
      } else if (error.message?.includes('timeout') || error.message?.includes('network')) {
        toast.error('Network error - please check your connection and try again');
      } else {
        toast.error(`Failed to assign job: ${error.message || 'Unknown error'}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!existingAssignment) return;
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', existingAssignment.job_id)
        .eq('technician_id', technicianId);
      if (error) throw error;
      toast.success('Assignment removed');
      window.dispatchEvent(new CustomEvent('assignment-updated', { detail: { technicianId, jobId: existingAssignment.job_id } }));
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove assignment');
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
    if (s) s.setHours(0,0,0,0);
    if (e) e.setHours(0,0,0,0);
    return { start: s, end: e };
  }, [selectedJob]);

  const isAllowedDate = (d: Date) => {
    if (!selectedJobMeta?.start || !selectedJobMeta?.end) return true;
    const t = new Date(d); t.setHours(0,0,0,0);
    return t >= selectedJobMeta.start && t <= selectedJobMeta.end;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isReassignment ? 'Reassign Job' : 'Assign Job'}</DialogTitle>
          <DialogDescription>
            {isReassignment ? 'Reassign' : 'Assign'} {technician?.first_name} {technician?.last_name} to a job on{' '}
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {technician && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Technician:</span>
              <span>{technician.first_name} {technician.last_name}</span>
              <Badge variant="outline">{technician.department}</Badge>
            </div>
          )}

          {isReassignment && existingAssignment?.jobs && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <div className="text-sm font-medium text-yellow-800">Current Assignment:</div>
              <div className="text-sm text-yellow-700">{existingAssignment.jobs.title}</div>
              <div className="text-xs text-yellow-600">
                Status: <Badge variant="secondary">{existingAssignment.status}</Badge>
              </div>
            </div>
          )}

          {!preSelectedJobId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Job</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a job..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredJobs.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No jobs available for this date
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
                Select Role ({technician.department})
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role..." />
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
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Coverage</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="coverage" checked={coverageMode === 'full'} onChange={() => setCoverageMode('full')} />
                    <span>Full job span</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="coverage" checked={coverageMode === 'single'} onChange={() => setCoverageMode('single')} />
                    <span>Single day</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="coverage" checked={coverageMode === 'multi'} onChange={() => setCoverageMode('multi')} />
                    <span>Multiple days</span>
                  </label>
                </div>
              </div>
              {coverageMode === 'single' && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {singleDate ? format(singleDate, 'PPP') : 'Select date'}
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
                  <p className="text-xs text-muted-foreground">Creates one single-day assignment.</p>
                </div>
              )}
              {coverageMode === 'multi' && (
                <div className="space-y-2">
                  <CalendarPicker
                    mode="multiple"
                    selected={multiDates}
                    onSelect={(ds) => setMultiDates((ds || []).filter(d => isAllowedDate(d)))}
                    disabled={(d) => !isAllowedDate(d)}
                    numberOfMonths={2}
                  />
                  <p className="text-xs text-muted-foreground">Creates one single-day assignment per selected date.</p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-assignment"
                  checked={assignAsConfirmed}
                  onCheckedChange={handleCheckboxChange}
                />
                <label
                  htmlFor="confirm-assignment"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Assign as confirmed (skip invitation)
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
                  Will be assigned as confirmed
                </div>
              )}
              {coverageMode === 'single' && (
                <div className="text-xs text-muted-foreground mt-1">
                  Single-day coverage for {singleDate ? format(singleDate, 'PPP') : format(date, 'PPP')}
                </div>
              )}
              {coverageMode === 'multi' && (
                <div className="text-xs text-muted-foreground mt-1">
                  {multiDates.length} day(s) selected for single-day coverage
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
                    Removing...
                  </>
                ) : (
                  'Remove Assignment'
                )}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedJobId || !selectedRole || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `${isReassignment ? 'Reassign' : 'Assign'} Job`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
