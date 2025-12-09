import { useMemo } from 'react';
import { addMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { getCategoryFromAssignment, type TechnicianCategory } from '@/utils/roleCategory';

// Type definitions
export interface TechnicianJobData {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  location_id?: string;
  job_type?: string;
  color?: string;
  status?: string;
  created_at?: string;
  location?: { name: string } | null;
  job_documents?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    visible_to_tech?: boolean;
    uploaded_at?: string;
    read_only?: boolean;
    template_type?: string | null;
  }>;
}

export interface TechnicianAssignment {
  id: string;
  job_id: string;
  technician_id: string;
  department: string;
  role: string;
  category: TechnicianCategory;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  single_day?: boolean | null;
  assignment_date?: string | null;
  jobs: TechnicianJobData;
}

interface UseAssignmentsOptions {
  userId?: string;
  queryKey?: string[];
  enabled?: boolean;
}

/**
 * Custom hook to fetch and manage technician job assignments.
 * Fetches assignments from the past 3 months to future 3 months.
 *
 * @param options - Configuration options
 * @param options.userId - The technician's user ID
 * @param options.queryKey - Optional custom query key (defaults to ['assignments-technician'])
 * @param options.enabled - Whether the query should be enabled (defaults to !!userId)
 * @returns Object containing assignments array and loading state
 */
export const useAssignments = ({
  userId,
  queryKey,
  enabled = true,
}: UseAssignmentsOptions) => {
  const assignmentsQueryKey = useMemo(
    () => queryKey || ['assignments-technician', userId],
    [queryKey, userId]
  );

  const { data: assignments = [], isLoading } = useRealtimeQuery(
    assignmentsQueryKey,
    async () => {
      if (!userId) return [];

      const startDate = addMonths(new Date(), -3);
      const endDate = addMonths(new Date(), 3);

      // Step 1: Fetch confirmed job assignments to get role/status info
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('job_id, sound_role, lights_role, video_role, status, assigned_at, single_day, assignment_date')
        .eq('technician_id', userId)
        .eq('status', 'confirmed');

      if (assignmentsError) {
        console.error('Error fetching job assignments:', assignmentsError);
        toast.error('Error loading assignment roles');
        return [];
      }

      if (!assignmentsData || assignmentsData.length === 0) {
        return [];
      }

      // Create a map for quick role lookup and a list of job IDs to fetch
      const assignmentsByJobId = new Map(
        assignmentsData.map((assignment) => [assignment.job_id, assignment])
      );
      const jobIds = Array.from(new Set(assignmentsData.map((assignment) => assignment.job_id)));

      // Step 2: Fetch timesheets (with jobs) for those assignments
      const { data: timesheetData, error } = await supabase
        .from('timesheets')
        .select(`
          job_id,
          technician_id,
          date,
          jobs!inner (
            id,
            title,
            description,
            start_time,
            end_time,
            timezone,
            location_id,
            job_type,
            color,
            status,
            location:locations(name),
            job_documents(
              id,
              file_name,
              file_path,
              visible_to_tech,
              uploaded_at,
              read_only,
              template_type
            )
          )
        `)
        .eq('technician_id', userId)
        .eq('is_active', true)
        .in('job_id', jobIds)
        .gte('jobs.start_time', startDate.toISOString())
        .lte('jobs.start_time', endDate.toISOString())
        .order('start_time', { referencedTable: 'jobs' });

      if (error) {
        console.error('Error fetching assignments:', error);
        toast.error('Error loading job details');
        return [];
      }

      // Deduplicate by job_id
      const seenJobIds = new Set<string>();
      const jobAssignments = (timesheetData || []).filter(row => {
        if (seenJobIds.has(row.job_id)) return false;
        seenJobIds.add(row.job_id);
        return true;
      });

      return jobAssignments
        .filter(row => row.jobs)
        .map(row => {
          let department = "unknown";
          const assignment = assignmentsByJobId.get(row.job_id);
          if (assignment?.sound_role) department = "sound";
          else if (assignment?.lights_role) department = "lights";
          else if (assignment?.video_role) department = "video";

          const category = getCategoryFromAssignment({
            sound_role: assignment?.sound_role,
            lights_role: assignment?.lights_role,
            video_role: assignment?.video_role
          });

          return {
            id: `job-${row.job_id}`,
            job_id: row.job_id,
            technician_id: row.technician_id,
            department,
            role: assignment?.sound_role || assignment?.lights_role || assignment?.video_role || "Assigned",
            category,
            sound_role: assignment?.sound_role,
            lights_role: assignment?.lights_role,
            video_role: assignment?.video_role,
            single_day: assignment?.single_day,
            assignment_date: assignment?.assignment_date,
            jobs: row.jobs
          };
        });
    },
    'timesheets',
    {
      enabled: enabled && !!userId,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
    }
  );

  return { assignments, isLoading };
};
