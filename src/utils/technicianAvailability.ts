
import { supabase } from "@/lib/supabase";

interface TechnicianTimesheetRow {
  job_id: string;
  technician_id: string;
  date: string;
  jobs?: {
    id: string;
    start_time: string | null;
    end_time: string | null;
    title: string | null;
  };
}

function normalizeDateOnly(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().split('T')[0];
}

function dateFallsInRange(date: string, start?: string | null, end?: string | null): boolean {
  if (start && date < start) {
    return false;
  }
  if (end && date > end) {
    return false;
  }
  return true;
}

export interface TechnicianJobConflict {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

/**
 * Enhanced conflict check result with hard/soft conflict distinction
 */
export interface ConflictCheckResult {
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  hardConflicts: Array<TechnicianJobConflict & { status: string }>;
  softConflicts: Array<TechnicianJobConflict & { status: string }>;
  unavailabilityConflicts: Array<{
    date: string;
    reason: string;
    source: string;
    notes?: string;
  }>;
}

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

    // Get all per-day timesheets for these technicians within the relevant window
    const technicianIds = eligibleTechnicians.map((tech: any) => tech.id);

    const normalizedTargetDate = normalizeDateOnly(assignmentDate);
    const jobStartDate = normalizedTargetDate || normalizeDateOnly(jobStartTime);
    const jobEndDate = normalizedTargetDate || normalizeDateOnly(jobEndTime);

    const timesheetQuery = supabase
      .from("timesheets")
      .select(`
        job_id,
        technician_id,
        date,
        jobs!inner (
          id,
          start_time,
          end_time,
          title
        )
      `)
      .in("technician_id", technicianIds)
      .eq("is_schedule_only", false);

    if (jobStartDate) {
      timesheetQuery.gte("date", jobStartDate);
    }
    if (jobEndDate) {
      timesheetQuery.lte("date", jobEndDate);
    }

    const { data: conflictingTimesheets, error: timesheetError } = await timesheetQuery;

    if (timesheetError) {
      throw timesheetError;
    }

    // Get availability schedules (including vacation-based unavailability)
    const { data: unavailabilityData, error: unavailabilityError } = await (() => {
      const query = supabase
        .from("availability_schedules")
        .select("user_id, date, status, source")
        .in("user_id", technicianIds)
        .eq("status", "unavailable");

      if (jobStartDate) {
        query.gte("date", jobStartDate);
      }
      if (jobEndDate) {
        query.lte("date", jobEndDate);
      }

      return query;
    })();

    if (unavailabilityError) {
      console.error("Error fetching unavailability data:", unavailabilityError);
    }

    // Filter out technicians who have conflicts
    const timesheetsByTechnician = new Map<string, TechnicianTimesheetRow[]>();
    (conflictingTimesheets || []).forEach((timesheet) => {
      const bucket = timesheetsByTechnician.get(timesheet.technician_id) || [];
      bucket.push(timesheet as TechnicianTimesheetRow);
      timesheetsByTechnician.set(timesheet.technician_id, bucket);
    });

    const availableTechnicians = eligibleTechnicians.filter((technician: any) => {
      const technicianTimesheets = timesheetsByTechnician.get(technician.id) || [];

      // Check if technician is already assigned to this specific job
      const assignedToCurrentJob = technicianTimesheets.some(timesheet => {
        if (timesheet.job_id !== jobId) {
          return false;
        }
        if (normalizedTargetDate) {
          return timesheet.date === normalizedTargetDate;
        }
        return dateFallsInRange(timesheet.date, jobStartDate, jobEndDate);
      });

      if (assignedToCurrentJob) {
        return false;
      }

      // Check if technician has conflicting dates with other jobs
      const hasJobConflict = technicianTimesheets.some(timesheet => {
        if (timesheet.job_id === jobId) {
          return false;
        }

        if (normalizedTargetDate) {
          return timesheet.date === normalizedTargetDate;
        }

        return dateFallsInRange(timesheet.date, jobStartDate, jobEndDate);
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
 * Check if a technician has a confirmed overlapping job for the given target job.
 * When `singleDayOnly` and `targetDateIso` are provided, the check is scoped to a
 * specific day instead of the full job span.
 */
export async function checkTimeConflict(
  technicianId: string,
  targetJobId: string,
  targetDateIso?: string,
  singleDayOnly?: boolean
): Promise<TechnicianJobConflict | null> {
  try {
    const { data: targetJob, error: jobError } = await supabase
      .from("jobs")
      .select("id,title,start_time,end_time")
      .eq("id", targetJobId)
      .maybeSingle();

    if (jobError || !targetJob) {
      return null;
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("job_assignments")
      .select("job_id,status,single_day,assignment_date")
      .eq("technician_id", technicianId)
      .eq("status", "confirmed");

    if (assignmentsError || !assignments?.length) {
      return null;
    }

    const filteredAssignments = assignments.filter((assignment) => {
      if (assignment.job_id === targetJobId) {
        return false;
      }

      if (singleDayOnly && targetDateIso) {
        if (assignment.single_day && assignment.assignment_date && assignment.assignment_date !== targetDateIso) {
          return false;
        }
      }

      return true;
    });

    const otherIds = filteredAssignments.map((assignment) => assignment.job_id);
    if (!otherIds.length) {
      return null;
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,start_time,end_time")
      .in("id", otherIds);

    if (jobsError || !jobs?.length) {
      return null;
    }

    const targetStart = singleDayOnly && targetDateIso
      ? new Date(`${targetDateIso}T00:00:00Z`)
      : (targetJob.start_time ? new Date(targetJob.start_time) : null);

    const targetEnd = singleDayOnly && targetDateIso
      ? new Date(`${targetDateIso}T23:59:59Z`)
      : (targetJob.end_time ? new Date(targetJob.end_time) : null);

    if (!targetStart || !targetEnd) {
      return null;
    }

    const overlap = jobs.find((job) => {
      if (!job.start_time || !job.end_time) {
        return false;
      }

      const jobStart = new Date(job.start_time);
      const jobEnd = new Date(job.end_time);

      return jobStart < targetEnd && jobEnd > targetStart;
    });

    return overlap
      ? {
          id: overlap.id,
          title: overlap.title,
          start_time: overlap.start_time!,
          end_time: overlap.end_time!,
        }
      : null;
  } catch (error) {
    console.warn("Conflict pre-check error", error);
    return null;
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
    const jobStartDate = normalizeDateOnly(jobStartTime);
    const jobEndDate = normalizeDateOnly(jobEndTime);
    
    const unavailabilityQuery = supabase
      .from("availability_schedules")
      .select("date, status, source, notes")
      .eq("user_id", technicianId)
      .eq("status", "unavailable");

    if (jobStartDate) {
      unavailabilityQuery.gte("date", jobStartDate);
    }
    if (jobEndDate) {
      unavailabilityQuery.lte("date", jobEndDate);
    }

    const { data: unavailabilityData, error: unavailabilityError } = await unavailabilityQuery;

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

/**
 * Enhanced conflict checking using the database RPC function
 * Distinguishes between hard conflicts (confirmed) and soft conflicts (pending)
 */
export async function checkTimeConflictEnhanced(
  technicianId: string,
  targetJobId: string,
  options?: {
    targetDateIso?: string;
    singleDayOnly?: boolean;
    includePending?: boolean;
  }
): Promise<ConflictCheckResult> {
  try {
    const { data, error } = await supabase.rpc('check_technician_conflicts', {
      _technician_id: technicianId,
      _target_job_id: targetJobId,
      _target_date: options?.targetDateIso || null,
      _single_day: options?.singleDayOnly || false,
      _include_pending: options?.includePending !== false, // Default to true
    });

    if (error) {
      console.error('Enhanced conflict check error:', error);
      return {
        hasHardConflict: false,
        hasSoftConflict: false,
        hardConflicts: [],
        softConflicts: [],
        unavailabilityConflicts: [],
      };
    }

    return data as ConflictCheckResult;
  } catch (error) {
    console.error('Enhanced conflict check error:', error);
    return {
      hasHardConflict: false,
      hasSoftConflict: false,
      hardConflicts: [],
      softConflicts: [],
      unavailabilityConflicts: [],
    };
  }
}
