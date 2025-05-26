
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface TourAssignment {
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
    department: string;
  };
}

export const useTourAssignments = (tourId: string) => {
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tour-assignments', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_assignments')
        .select(`
          *,
          profiles:technician_id (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .eq('tour_id', tourId)
        .order('department', { ascending: true });

      if (error) throw error;
      return data as TourAssignment[];
    },
    enabled: !!tourId
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (assignmentData: {
      technician_id?: string;
      external_technician_name?: string;
      department: string;
      role: string;
      notes?: string;
      assigned_by: string;
    }) => {
      const { error } = await supabase
        .from('tour_assignments')
        .insert({
          tour_id: tourId,
          ...assignmentData
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Assignment created successfully - automatically applied to all tour jobs');
      queryClient.invalidateQueries({ queryKey: ['tour-assignments', tourId] });
      // Also invalidate job assignments since they're automatically synced
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create assignment: ${error.message}`);
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ['tour-assignments', tourId] });
      // Also invalidate job assignments since they're automatically synced
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to remove assignment: ${error.message}`);
    }
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ assignmentId, updates }: { 
      assignmentId: string; 
      updates: Partial<TourAssignment> 
    }) => {
      const { error } = await supabase
        .from('tour_assignments')
        .update(updates)
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Assignment updated successfully');
      queryClient.invalidateQueries({ queryKey: ['tour-assignments', tourId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    }
  });

  // Helper function to check if user has tour access
  const checkTourAccess = async (userId: string) => {
    const { data, error } = await supabase
      .from('tour_assignments')
      .select('id')
      .eq('tour_id', tourId)
      .eq('technician_id', userId)
      .maybeSingle();

    return { hasAccess: !!data, error };
  };

  // Helper function to get assignments by department
  const getAssignmentsByDepartment = (department: string) => {
    return assignments.filter(assignment => assignment.department === department);
  };

  // Helper function to get all assigned technician IDs
  const getAssignedTechnicianIds = () => {
    return assignments
      .filter(assignment => assignment.technician_id)
      .map(assignment => assignment.technician_id!)
      .filter(Boolean);
  };

  return {
    assignments,
    isLoading,
    error,
    refetch,
    createAssignment: createAssignmentMutation.mutate,
    deleteAssignment: deleteAssignmentMutation.mutate,
    updateAssignment: updateAssignmentMutation.mutate,
    isCreating: createAssignmentMutation.isPending,
    isDeleting: deleteAssignmentMutation.isPending,
    isUpdating: updateAssignmentMutation.isPending,
    checkTourAccess,
    getAssignmentsByDepartment,
    getAssignedTechnicianIds
  };
};
