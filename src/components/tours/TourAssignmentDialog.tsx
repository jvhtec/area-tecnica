
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Users, Eye, Info, Target } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { roleOptionsForDiscipline, labelForCode } from '@/utils/roles';
import { TourRequirementsDialog } from '@/components/tours/TourRequirementsDialog';

interface TourAssignment {
  id: string;
  tour_id: string;
  technician_id?: string;
  external_technician_name?: string;
  department: string;
  role: string;
  assigned_by?: string;
  assigned_at: string;
  notes?: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface TourAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  readOnly?: boolean;
}

const DEPARTMENTS = [
  { value: 'sound', label: 'Sound' },
  { value: 'lights', label: 'Lights' },
  { value: 'video', label: 'Video' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'production', label: 'Production' }
];

// Centralized technical roles (sound/lights/video) come from the roles registry and are stored as codes.
// For non-technical departments we keep simple label lists.
const NON_TECH_ROLE_LABELS: Record<string, string[]> = {
  logistics: ['Logistics Coordinator', 'Transport Manager', 'Load Manager'],
  production: ['Tour Manager', 'Production Manager', 'Stage Manager', 'Backline Technician']
};

export const TourAssignmentDialog = ({ 
  open, 
  onOpenChange, 
  tourId, 
  readOnly = false 
}: TourAssignmentDialogProps) => {
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();
  
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [assignmentType, setAssignmentType] = useState<'internal' | 'external'>('internal');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [externalName, setExternalName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [reqOpen, setReqOpen] = useState(false);

  // Fetch existing tour assignments
  const { data: assignments = [], refetch } = useQuery({
    queryKey: ['tour-assignments', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_assignments')
        .select(`
          *,
          profiles:technician_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq('tour_id', tourId)
        .order('department', { ascending: true });

      if (error) throw error;
      return data as TourAssignment[];
    },
    enabled: open && !!tourId
  });

  // Fetch available technicians for selected department
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', selectedDepartment],
    queryFn: async () => {
      if (!selectedDepartment) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, department, role, assignable_as_tech')
        .eq('department', selectedDepartment)
        .or('role.in.(technician,house_tech),and(role.eq.management,assignable_as_tech.eq.true)')
        .order('first_name');

      if (error) throw error;
      return data;
    },
    enabled: !!selectedDepartment && assignmentType === 'internal'
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignmentData: any) => {
      const { error } = await supabase
        .from('tour_assignments')
        .insert({
          tour_id: tourId,
          technician_id: assignmentType === 'internal' ? selectedTechnician : null,
          external_technician_name: assignmentType === 'external' ? externalName : null,
          department: selectedDepartment,
          role: selectedRole,
          assigned_by: user?.id,
          notes: notes || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Assignment created successfully - automatically applied to all tour jobs');
      refetch();
      resetForm();
      // Invalidate job assignments as they're automatically synced
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create assignment: ${error.message}`);
    }
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('tour_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Assignment removed successfully - automatically removed from all tour jobs');
      refetch();
      // Invalidate job assignments as they're automatically synced
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to remove assignment: ${error.message}`);
    }
  });

  const resetForm = () => {
    setSelectedDepartment('');
    setSelectedRole('');
    setAssignmentType('internal');
    setSelectedTechnician('');
    setExternalName('');
    setNotes('');
  };

  const handleCreateAssignment = () => {
    if (!selectedDepartment || !selectedRole) {
      toast.error('Please select department and role');
      return;
    }

    if (assignmentType === 'internal' && !selectedTechnician) {
      toast.error('Please select a technician');
      return;
    }

    if (assignmentType === 'external' && !externalName.trim()) {
      toast.error('Please enter external technician name');
      return;
    }

    createAssignmentMutation.mutate({});
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (confirm('Are you sure you want to remove this assignment? This will also remove it from all jobs in this tour.')) {
      deleteAssignmentMutation.mutate(assignmentId);
    }
  };

  const getAvailableRoles = () => {
    if (!selectedDepartment) return [] as Array<{ value: string; label: string }>;
    // Technical departments: use role codes registry
    if (['sound','lights','video'].includes(selectedDepartment)) {
      return roleOptionsForDiscipline(selectedDepartment).map(opt => ({ value: opt.code, label: opt.label }));
    }
    // Non-technical: use static labels
    const labels = NON_TECH_ROLE_LABELS[selectedDepartment] || [];
    return labels.map(l => ({ value: l, label: l }));
  };

  const groupedAssignments = assignments.reduce((acc, assignment) => {
    if (!acc[assignment.department]) {
      acc[assignment.department] = [];
    }
    acc[assignment.department].push(assignment);
    return acc;
  }, {} as Record<string, TourAssignment[]>);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {readOnly ? 'Tour Team Members' : 'Tour Team Assignments'}
            {readOnly && (
              <Badge variant="secondary">
                <Eye className="h-3 w-3 mr-1" />
                View Only
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Auto-sync info */}
          {!readOnly && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Automatic Job Sync</p>
                  <p>Tour assignments are automatically applied to all jobs in this tour. When you add or remove team members here, they will be instantly assigned to or removed from all tour jobs.</p>
                </div>
              </div>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => setReqOpen(true)} className="gap-2">
                  <Target className="h-4 w-4" />
                  Set Tour‑wide Personnel Requirements
                </Button>
              </div>
            </div>
          )}

          {/* Current Assignments */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {readOnly ? 'Team Members' : 'Current Team'}
            </h3>
            {Object.keys(groupedAssignments).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No team members assigned yet.
                {!readOnly && " Add assignments below."}
              </p>
            ) : (
              <div className="space-y-4">
                {DEPARTMENTS.map(dept => {
                  const deptAssignments = groupedAssignments[dept.value] || [];
                  if (deptAssignments.length === 0) return null;

                  return (
                    <div key={dept.value} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                        {dept.label}
                      </h4>
                      <div className="space-y-2">
                        {deptAssignments.map(assignment => (
                          <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {assignment.profiles 
                                    ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
                                    : assignment.external_technician_name
                                  }
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {labelForCode(assignment.role) || assignment.role}
                                </Badge>
                                {assignment.external_technician_name && (
                                  <Badge variant="secondary" className="text-xs">
                                    External
                                  </Badge>
                                )}
                              </div>
                              {assignment.profiles?.email && (
                                <p className="text-sm text-muted-foreground">{assignment.profiles.email}</p>
                              )}
                              {assignment.notes && (
                                <p className="text-sm text-muted-foreground italic">{assignment.notes}</p>
                              )}
                            </div>
                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAssignment(assignment.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Assignment - Only show for management */}
          {!readOnly && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Add Team Member</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept.value} value={dept.value}>
                          {dept.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Role</Label>
                  <Select 
                    value={selectedRole} 
                    onValueChange={setSelectedRole}
                    disabled={!selectedDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>Assignment Type</Label>
                  <Select value={assignmentType} onValueChange={(value: 'internal' | 'external') => setAssignmentType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Technician</SelectItem>
                      <SelectItem value="external">External Team/Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {assignmentType === 'internal' ? (
                  <div className="md:col-span-2">
                    <Label>Technician</Label>
                    <Select 
                      value={selectedTechnician} 
                      onValueChange={setSelectedTechnician}
                      disabled={!selectedDepartment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map(tech => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.first_name} {tech.last_name} ({tech.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <Label>External Team/Contractor Name</Label>
                    <Input
                      value={externalName}
                      onChange={(e) => setExternalName(e.target.value)}
                      placeholder="Enter name or company"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this assignment"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={resetForm}>
                  Clear
                </Button>
                <Button 
                  onClick={handleCreateAssignment}
                  disabled={createAssignmentMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Assignment
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {/* Tour-wide Personnel Requirements */}
    {!readOnly && (
      <TourRequirementsDialog open={reqOpen} onOpenChange={setReqOpen} tourId={tourId} />
    )}
    </>
  );
};
