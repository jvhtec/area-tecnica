import React, { useState } from 'react';
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
import { Loader2, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
  const [assignAsConfirmed, setAssignAsConfirmed] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

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

  // Get department-specific roles
  const getDepartmentRoles = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'sound':
        return ['FOH Engineer', 'Monitor Engineer', 'RF Technician', 'PA Technician'];
      case 'lights':
        return ['Lighting Designer', 'Lighting Technician', 'Follow Spot', 'Rigger'];
      case 'video':
        return ['Video Director', 'Video Technician', 'Camera Operator', 'Playback Technician'];
      default:
        return ['FOH Engineer', 'Monitor Engineer', 'RF Technician', 'PA Technician'];
    }
  };

  const selectedJob = availableJobs.find(job => job.id === selectedJobId);
  const roles = technician ? getDepartmentRoles(technician.department) : [];
  const isReassignment = !!existingAssignment;

  // Set initial role if reassigning
  React.useEffect(() => {
    if (existingAssignment && technician) {
      const currentRole = existingAssignment.sound_role || 
                         existingAssignment.lights_role || 
                         existingAssignment.video_role;
      if (currentRole) {
        setSelectedRole(currentRole);
      }
    }
  }, [existingAssignment, technician]);

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

      // Create new assignment using the same logic as the robust hook
      console.log('Creating assignment with data:', {
        job_id: selectedJobId,
        technician_id: technicianId,
        sound_role: soundRole !== 'none' ? soundRole : null,
        lights_role: lightsRole !== 'none' ? lightsRole : null,
        video_role: videoRole !== 'none' ? videoRole : null,
        status: assignAsConfirmed ? 'confirmed' : 'invited'
      });

      const { error } = await supabase
        .from('job_assignments')
        .insert({
          job_id: selectedJobId,
          technician_id: technicianId,
          sound_role: soundRole !== 'none' ? soundRole : null,
          lights_role: lightsRole !== 'none' ? lightsRole : null,
          video_role: videoRole !== 'none' ? videoRole : null,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          assigned_at: new Date().toISOString(),
          status: assignAsConfirmed ? 'confirmed' : 'invited',
          response_time: assignAsConfirmed ? new Date().toISOString() : null,
        });

      if (error) {
        console.error('Error creating assignment:', error);
        throw error;
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

  const handleCheckboxChange = (checked: boolean | "indeterminate") => {
    // Convert CheckedState to boolean, treating "indeterminate" as false
    setAssignAsConfirmed(checked === true);
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
                  {availableJobs.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No jobs available for this date
                    </div>
                  ) : (
                    availableJobs.map((job) => (
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
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedJobId && selectedRole && (
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
          )}

          {selectedJob && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{selectedJob.title}</span>
                <Badge variant="secondary">{selectedJob.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(selectedJob.start_time), 'HH:mm')} - {format(new Date(selectedJob.end_time), 'HH:mm')}
                </div>
              </div>
              {assignAsConfirmed && (
                <div className="text-xs text-green-600 mt-1 font-medium">
                  Will be assigned as confirmed
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
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
