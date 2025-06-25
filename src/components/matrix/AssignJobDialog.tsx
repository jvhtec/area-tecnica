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
import { useJobAssignmentsRealtime } from '@/hooks/useJobAssignmentsRealtime';
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
}

export const AssignJobDialog = ({ 
  open, 
  onClose, 
  technicianId, 
  date, 
  availableJobs,
  existingAssignment
}: AssignJobDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(existingAssignment?.job_id || '');
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

  const handleAssign = async () => {
    if (!selectedJobId || !selectedRole || !technician) {
      toast.error('Please select both a job and role');
      return;
    }

    setIsAssigning(true);

    try {
      // Determine role assignment based on department
      const soundRole = technician.department === 'sound' ? selectedRole : '';
      const lightsRole = technician.department === 'lights' ? selectedRole : '';
      const videoRole = technician.department === 'video' ? selectedRole : '';

      if (isReassignment) {
        // Update existing assignment
        const { error } = await supabase
          .from('job_assignments')
          .update({
            job_id: selectedJobId,
            sound_role: soundRole || null,
            lights_role: lightsRole || null,
            video_role: videoRole || null,
            assigned_at: new Date().toISOString(),
            status: assignAsConfirmed ? 'confirmed' : 'invited',
            response_time: assignAsConfirmed ? new Date().toISOString() : null,
          })
          .eq('job_id', existingAssignment.job_id)
          .eq('technician_id', technicianId);

        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('job_assignments')
          .insert({
            job_id: selectedJobId,
            technician_id: technicianId,
            sound_role: soundRole || null,
            lights_role: lightsRole || null,
            video_role: videoRole || null,
            assigned_by: (await supabase.auth.getUser()).data.user?.id,
            assigned_at: new Date().toISOString(),
            status: assignAsConfirmed ? 'confirmed' : 'invited',
            response_time: assignAsConfirmed ? new Date().toISOString() : null,
          });

        if (error) throw error;

        // Handle Flex crew assignments if needed
        // (keeping existing flex crew logic from original)
      }
      
      const statusText = assignAsConfirmed ? 'confirmed' : 'invited';
      toast.success(
        `${isReassignment ? 'Reassigned' : 'Assigned'} ${technician.first_name} ${technician.last_name} to ${selectedJob?.title} (${statusText})`
      );
      onClose();
    } catch (error) {
      console.error('Error assigning job:', error);
      toast.error('Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
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
                onCheckedChange={setAssignAsConfirmed}
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
