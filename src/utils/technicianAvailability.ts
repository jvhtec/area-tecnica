
import { supabase } from "@/lib/supabase";

/**
 * Check if two date ranges overlap
 */
export function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const startDate1 = new Date(start1);
  const endDate1 = new Date(end1);
  const startDate2 = new Date(start2);
  const endDate2 = new Date(end2);

  return startDate1 <= endDate2 && startDate2 <= endDate1;
}

/**
 * Get all technicians with their conflict information for a specific job
 */
export async function getAvailableTechnicians(
  department: string,
  jobId: string,
  jobStartTime: string,
  jobEndTime: string
) {
  try {
    // First, get all technicians from the specified department
    const { data: allTechnicians, error: techError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, department, role")
      .eq("department", department);

    if (techError) {
      throw techError;
    }

    if (!allTechnicians) {
      return [];
    }

    // Get all job assignments for these technicians with job date information
    const technicianIds = allTechnicians.map(tech => tech.id);
    
    const { data: conflictingAssignments, error: assignmentError } = await supabase
      .from("job_assignments")
      .select(`
        technician_id,
        job_id,
        jobs!inner (
          id,
          start_time,
          end_time,
          title
        )
      `)
      .in("technician_id", technicianIds);

    if (assignmentError) {
      throw assignmentError;
    }

    // Filter out technicians who have conflicts
    const availableTechnicians = allTechnicians.filter(technician => {
      // Check if technician is already assigned to this specific job
      const assignedToCurrentJob = conflictingAssignments?.some(
        assignment => 
          assignment.technician_id === technician.id && 
          assignment.job_id === jobId
      );

      if (assignedToCurrentJob) {
        return false;
      }

      // Check if technician has conflicting dates with other jobs
      const hasDateConflict = conflictingAssignments?.some(assignment => {
        if (assignment.technician_id !== technician.id) {
          return false;
        }

        const jobData = assignment.jobs as any;
        return datesOverlap(
          jobStartTime,
          jobEndTime,
          jobData.start_time,
          jobData.end_time
        );
      });

      return !hasDateConflict;
    });

    return availableTechnicians;
  } catch (error) {
    console.error("Error getting available technicians:", error);
    throw error;
  }
}

/**
 * Get conflict information for a technician
 */
export async function getTechnicianConflicts(
  technicianId: string,
  jobStartTime: string,
  jobEndTime: string
) {
  try {
    const { data: assignments, error } = await supabase
      .from("job_assignments")
      .select(`
        job_id,
        jobs!inner (
          id,
          start_time,
          end_time,
          title
        )
      `)
      .eq("technician_id", technicianId);

    if (error) {
      throw error;
    }

    if (!assignments) {
      return [];
    }

    return assignments.filter(assignment => {
      const jobData = assignment.jobs as any;
      return datesOverlap(
        jobStartTime,
        jobEndTime,
        jobData.start_time,
        jobData.end_time
      );
    });
  } catch (error) {
    console.error("Error getting technician conflicts:", error);
    throw error;
  }
}
