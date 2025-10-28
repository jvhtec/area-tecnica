
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
  jobEndTime: string,
  assignmentDate?: string | null
) {
  try {
    // First, get all technicians from the specified department, plus flagged management users
    // Note: we include management here to avoid an extra query, then filter by assignable_as_tech in code
    const { data: profileData, error: profileError } = await supabase
      .rpc('get_profiles_with_skills');

    if (profileError) {
      throw profileError;
    }

    const allTechnicians = (profileData || []).filter((tech: any) => tech.department === department);

    if (allTechnicians.length === 0) {
      return [];
    }

    const eligibleTechnicians = allTechnicians.filter((tech: any) => {
      if (tech.role === 'management') {
        return !!tech.assignable_as_tech;
      }
      return tech.role === 'technician' || tech.role === 'house_tech';
    });

    if (eligibleTechnicians.length === 0) {
      return [];
    }

    // Get all job assignments for these technicians with job date information
    const technicianIds = eligibleTechnicians.map((tech: any) => tech.id);
    
    const { data: conflictingAssignments, error: assignmentError } = await supabase
      .from("job_assignments")
      .select(`
        technician_id,
        job_id,
        single_day,
        assignment_date,
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

    // Get availability schedules (including vacation-based unavailability)
    const normalizedTargetDate = assignmentDate
      ? new Date(assignmentDate).toISOString().split('T')[0]
      : null;

    const jobStartDate = normalizedTargetDate || new Date(jobStartTime).toISOString().split('T')[0];
    const jobEndDate = normalizedTargetDate || new Date(jobEndTime).toISOString().split('T')[0];
    
    const { data: unavailabilityData, error: unavailabilityError } = await supabase
      .from("availability_schedules")
      .select("user_id, date, status, source")
      .in("user_id", technicianIds)
      .eq("status", "unavailable")
      .gte("date", jobStartDate)
      .lte("date", jobEndDate);

    if (unavailabilityError) {
      console.error("Error fetching unavailability data:", unavailabilityError);
    }

    // Filter out technicians who have conflicts
    const availableTechnicians = eligibleTechnicians.filter((technician: any) => {
      // Check if technician is already assigned to this specific job
      const assignedToCurrentJob = conflictingAssignments?.some(assignment => {
        if (assignment.technician_id !== technician.id) {
          return false;
        }
        if (assignment.job_id !== jobId) {
          return false;
        }
        if (!assignment.single_day) {
          return true;
        }
        if (!normalizedTargetDate) {
          // Whole-job assignment - any single-day entry counts as conflict
          return true;
        }
        if (!assignment.assignment_date) {
          return true;
        }
        return assignment.assignment_date === normalizedTargetDate;
      });

      if (assignedToCurrentJob) {
        return false;
      }

      // Check if technician has conflicting dates with other jobs
      const hasJobConflict = conflictingAssignments?.some(assignment => {
        if (assignment.technician_id !== technician.id) {
          return false;
        }

        // Skip current job - already handled above
        if (assignment.job_id === jobId) {
          return false;
        }

        const jobData = assignment.jobs as any;
        if (assignment.single_day) {
          if (!assignment.assignment_date) {
            return true;
          }
          if (!normalizedTargetDate) {
            // For whole-job assignments, treat any single-day overlap within the job range as conflict
            const jobStartStr = new Date(jobStartTime).toISOString().split('T')[0];
            const jobEndStr = new Date(jobEndTime).toISOString().split('T')[0];
            return assignment.assignment_date >= jobStartStr && assignment.assignment_date <= jobEndStr;
          }
          return assignment.assignment_date === normalizedTargetDate;
        }

        if (normalizedTargetDate) {
          if (!jobData?.start_time || !jobData?.end_time) {
            return false;
          }
          const otherStart = new Date(jobData.start_time).toISOString().split('T')[0];
          const otherEnd = new Date(jobData.end_time).toISOString().split('T')[0];
          return otherStart <= normalizedTargetDate && otherEnd >= normalizedTargetDate;
        }

        return datesOverlap(
          jobStartTime,
          jobEndTime,
          jobData.start_time,
          jobData.end_time
        );
      });

      // Check if technician is unavailable (vacation, etc.) during job dates
      const hasUnavailabilityConflict = unavailabilityData?.some(availability => {
        if (availability.user_id !== technician.id) {
          return false;
        }
        
        const availDate = new Date(availability.date);
        const jobStart = new Date(jobStartTime);
        const jobEnd = new Date(jobEndTime);
        
        return availDate >= jobStart && availDate <= jobEnd;
      });

      return !hasJobConflict && !hasUnavailabilityConflict;
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

    // Get unavailability conflicts
    const jobStartDate = new Date(jobStartTime).toISOString().split('T')[0];
    const jobEndDate = new Date(jobEndTime).toISOString().split('T')[0];
    
    const { data: unavailabilityData, error: unavailabilityError } = await supabase
      .from("availability_schedules")
      .select("date, status, source, notes")
      .eq("user_id", technicianId)
      .eq("status", "unavailable")
      .gte("date", jobStartDate)
      .lte("date", jobEndDate);

    if (unavailabilityError) {
      console.error("Error fetching unavailability conflicts:", unavailabilityError);
    }

    const jobConflicts = assignments?.filter(assignment => {
      const jobData = assignment.jobs as any;
      return datesOverlap(
        jobStartTime,
        jobEndTime,
        jobData.start_time,
        jobData.end_time
      );
    }) || [];

    // Convert unavailability data to a format similar to job conflicts
    const unavailabilityConflicts = unavailabilityData?.map(availability => ({
      type: 'unavailable',
      date: availability.date,
      reason: availability.source === 'vacation' ? 'Vacation' : 'Unavailable',
      notes: availability.notes
    })) || [];

    return {
      jobConflicts,
      unavailabilityConflicts
    };
  } catch (error) {
    console.error("Error getting technician conflicts:", error);
    throw error;
  }
}
