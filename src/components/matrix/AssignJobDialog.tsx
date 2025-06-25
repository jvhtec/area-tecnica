
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
}

export const AssignJobDialog = ({ 
  open, 
  onClose, 
  technicianId, 
  date, 
  availableJobs 
}: AssignJobDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
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

  const handleAssign = async () => {
    if (!selectedJobId || !selectedRole || !technician) {
      toast.error('Please select both a job and role');
      return;
    }

    setIsAssigning(true);

    try {
      // Use the existing assignment system
      const { addAssignment } = useJobAssignmentsRealtime(selectedJobId);
      
      // Determine role assignment based on department
      const soundRole = technician.department === 'sound' ? selectedRole : '';
      const lightsRole = technician.department === 'lights' ? selectedRole : '';
      const videoRole = technician.department === 'video' ? selectedRole : '';

      await addAssignment(technicianId, soundRole, lightsRole);
      
      toast.success(`Assigned ${technician.first_name} ${technician.last_name} to ${selectedJob?.title}`);
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
          <DialogTitle>Assign Job</DialogTitle>
          <DialogDescription>
            Assign {technician?.first_name} {technician?.last_name} to a job on{' '}
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
              'Assign Job'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
