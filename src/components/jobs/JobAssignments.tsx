
import { useQueryClient } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { Assignment } from "@/types/assignment";
import { Department } from "@/types/department";
import { User, X, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { SubscriptionIndicator } from "../ui/subscription-indicator";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useEffect, useState } from "react";
import { labelForCode } from '@/utils/roles';
import { format } from "date-fns";
import { getAssignmentRoleForDepartment, hasAssignmentRoleForDepartment } from "@/utils/assignmentRoles";


import { queryKeys } from "@/lib/react-query";
interface JobAssignmentsProps {
  jobId: string;
  department?: Department;
  userRole?: string | null;
}

export const JobAssignments = ({ jobId, department, userRole }: JobAssignmentsProps) => {
  const queryClient = useQueryClient();
  const { assignments, isLoading, isRefreshing, refetch } = useJobAssignmentsRealtime(jobId);
  const [isSyncing, setIsSyncing] = useState(false);

  // Set up additional real-time subscription to invalidate available technicians
  useEffect(() => {
    if (!jobId) return;

    console.log(`Setting up assignments real-time for job ${jobId}`);

    const channel = dataLayerClient.channel(`job-assignments-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log('Assignment changed for job, refreshing available technicians:', payload);
          // Invalidate available technicians queries when assignments change
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope("available-technicians")
          });
        }
      )
      .subscribe();

    return () => {
      console.log(`Cleaning up assignments subscription for job ${jobId}`);
      dataLayerClient.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  const handleDelete = async (technicianId: string) => {
    if (userRole === 'logistics') return;
    
    try {
      const { error } = await dataLayerClient.from("job_assignments")
        .delete()
        .eq("job_id", jobId)
        .eq("technician_id", technicianId);

      if (error) throw error;

      // Refresh both assignments and jobs data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("job-assignments", jobId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("available-technicians") })
      ]);

      toast.success("Assignment deleted successfully");
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
    }
  };

  const handleSyncFlex = async () => {
    if (!department) {
      toast.message('Select a department first to sync');
      return;
    }
    try {
      setIsSyncing(true);
      toast.info('Syncing crew to Flex…');
      const { data, error } = await dataLayerClient.functions.invoke('sync-flex-crew-for-job', {
        body: { job_id: jobId, departments: [department] }
      });
      if (error) {
        console.error('Flex sync error:', error);
        toast.error(`Flex sync failed: ${error.message}`);
        return;
      }
      if (data?.ok) {
        // Prefer current department summary if present, else show a compact aggregate
        const s = data.summary?.[department] || {};
        if (s.errors?.length) {
          toast.error(`Flex sync errors: ${s.errors.join('; ')}`);
        } else if (s.note) {
          toast.info(String(s.note));
        } else {
          toast.success(`Flex synced: +${s.added ?? 0}  −${s.removed ?? 0}  =${s.kept ?? 0}`);
        }
      } else if (data?.error) {
        toast.error(`Flex sync failed: ${data.error}`);
      } else {
        toast.success('Flex sync completed');
      }
    } catch (e: any) {
      console.error('Flex sync exception:', e);
      toast.error(`Flex sync failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-pulse text-sm text-muted-foreground">Loading assignments...</div>
      </div>
    );
  }

  if (!assignments?.length) return null;

  // Filter assignments based on department if specified
  const filteredAssignments = department
    ? assignments.filter(assignment => {
        const profileDepartment = assignment.profiles?.department;
        return profileDepartment === department || hasAssignmentRoleForDepartment(assignment, department);
      })
    : assignments;

  if (!filteredAssignments.length) return null;

  const getRoleForDepartment = (assignment: Assignment) => {
    switch (department) {
      case "sound":
      case "lights":
      case "video":
      case "production":
        return getAssignmentRoleForDepartment(assignment, department);
      default:
        return assignment.sound_role || assignment.lights_role || assignment.video_role || assignment.production_role;
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          <SubscriptionIndicator tables={["job_assignments"]} variant="compact" showRefreshButton onRefresh={refetch} />
          {department && ['sound','lights','video'].includes(department) && (
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2"
              disabled={isSyncing}
              onClick={handleSyncFlex}
              title="Sync crew to Flex"
            >
              {isSyncing ? 'Syncing…' : 'Sync Flex'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={isRefreshing}
            onClick={() => refetch()}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      {filteredAssignments.map((assignment) => {
        const role = getRoleForDepartment(assignment);
        const displayRole = role ? labelForCode(role) : null;
        if (!displayRole) return null;
        
        const technicianName = assignment.profiles
          ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`.trim()
          : (assignment as any).external_technician_name || "External technician";
        
        return (
          <div
            key={`${assignment.job_id}-${assignment.technician_id}`}
            className="flex items-center justify-between gap-2 text-sm text-muted-foreground bg-secondary/50 p-2 rounded-md"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {technicianName}
                  </span>
                  <span className="text-xs">({displayRole})</span>
                </div>
                {assignment.single_day && assignment.assignment_date && (
                  <span className="text-xs text-muted-foreground">
                    Single-day: {format(new Date(`${assignment.assignment_date}T00:00:00`), "PPP")}
                  </span>
                )}
              </div>
            </div>
            {userRole !== 'logistics' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleDelete(assignment.technician_id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};
