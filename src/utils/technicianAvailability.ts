
import { supabase } from "@/lib/supabase";

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
 * OPTIMIZED: Get all technicians with their conflict information for a specific job
 * Uses timesheets table to determine actual work dates (simplified architecture)
 */
export async function getAvailableTechnicians(
  department: string,
  jobId: string,
  jobStartTime: string,
  jobEndTime: string,
  assignmentDate?: string | null
) {
  try {
    // First, get all technicians from the specified department
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
      if (tech.role === 'management' || tech.role === 'admin') {
        return !!tech.assignable_as_tech;
      }
      return tech.role === 'technician' || tech.role === 'house_tech';
    });

    if (eligibleTechnicians.length === 0) {
      return [];
    }

    const technicianIds = eligibleTechnicians.map((tech: any) => tech.id);

    // OPTIMIZED: Query timesheets directly to see which days technicians are actually working
    const normalizedTargetDate = assignmentDate
      ? new Date(assignmentDate).toISOString().split('T')[0]
      : null;

    const jobStartDate = normalizedTargetDate || new Date(jobStartTime).toISOString().split('T')[0];
    const jobEndDate = normalizedTargetDate || new Date(jobEndTime).toISOString().split('T')[0];

    // Get all ACTIVE timesheets for these technicians in the relevant date range
    // Filter by is_active to exclude voided timesheets (day-off/travel dates)
    const { data: timesheets, error: timesheetsError } = await supabase
      .from("timesheets")
      .select("technician_id, job_id, date")
      .in("technician_id", technicianIds)
      .eq("is_active", true)
      .gte("date", jobStartDate)
      .lte("date", jobEndDate);

    if (timesheetsError) {
      throw timesheetsError;
    }

    // Get job info for conflicting jobs
    const conflictingJobIds = Array.from(new Set((timesheets || []).map(ts => ts.job_id)));
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, start_time, end_time, title")
      .in("id", conflictingJobIds);

    if (jobsError) {
      throw jobsError;
    }

    const jobMap = new Map<string, any>();
    (jobs || []).forEach(job => jobMap.set(job.id, job));

    // Get unavailability data
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

    // Build a map of technician -> dates they're working
    const technicianWorkDates = new Map<string, Set<string>>();
    (timesheets || []).forEach(ts => {
      const key = ts.technician_id;
      if (!technicianWorkDates.has(key)) {
        technicianWorkDates.set(key, new Set());
      }
      technicianWorkDates.get(key)!.add(ts.date);
    });

    // Build a map of technician -> jobs they're assigned to
    const technicianJobs = new Map<string, Set<string>>();
    (timesheets || []).forEach(ts => {
      const key = ts.technician_id;
      if (!technicianJobs.has(key)) {
        technicianJobs.set(key, new Set());
      }
      technicianJobs.get(key)!.add(ts.job_id);
    });

    // Filter out technicians who have conflicts
    const availableTechnicians = eligibleTechnicians.filter((technician: any) => {
      // Check if already assigned to current job
      const assignedJobs = technicianJobs.get(technician.id);
      if (assignedJobs?.has(jobId)) {
        return false; // Already assigned to this job
      }

      // Check for date conflicts with other jobs
      const workDates = technicianWorkDates.get(technician.id);
      if (!workDates || workDates.size === 0) {
        // No existing work dates, check unavailability only
        const hasUnavailability = unavailabilityData?.some(avail =>
          avail.user_id === technician.id
        );
        return !hasUnavailability;
      }

      // Generate target dates to check
      const targetDates: string[] = [];
      if (normalizedTargetDate) {
        // Single date check
        targetDates.push(normalizedTargetDate);
      } else {
        // Whole job - check all dates in range
        const start = new Date(jobStartDate);
        const end = new Date(jobEndDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          targetDates.push(d.toISOString().split('T')[0]);
        }
      }

      // Check if any target date conflicts with existing work dates
      const hasDateConflict = targetDates.some(date => workDates.has(date));
      if (hasDateConflict) {
        return false;
      }

      // Check unavailability
      const hasUnavailability = unavailabilityData?.some(avail =>
        avail.user_id === technician.id &&
        targetDates.includes(avail.date)
      );

      return !hasUnavailability;
    });

    return availableTechnicians;
  } catch (error) {
    console.error("Error getting available technicians:", error);
    throw error;
  }
}

/**
 * OPTIMIZED: Check if a technician has a confirmed overlapping job for the given target job.
 * Uses timesheets to determine actual work dates instead of deprecated assignment fields.
 * When `targetDateIso` is provided, the check is scoped to that specific day.
 */
export async function checkTimeConflict(
  technicianId: string,
  targetJobId: string,
  targetDateIso?: string,
  singleDayOnly?: boolean  // Kept for backward compatibility but not used
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

    // Determine date range to check
    const startDate = targetDateIso || (targetJob.start_time ? new Date(targetJob.start_time).toISOString().split('T')[0] : null);
    const endDate = targetDateIso || (targetJob.end_time ? new Date(targetJob.end_time).toISOString().split('T')[0] : null);

    if (!startDate || !endDate) {
      return null;
    }

    // OPTIMIZED: Query ACTIVE timesheets to see which days technician is actually working
    // Filter by is_active to exclude voided timesheets (day-off/travel dates)
    const { data: timesheets, error: timesheetsError } = await supabase
      .from("timesheets")
      .select("job_id, date")
      .eq("technician_id", technicianId)
      .eq("is_active", true)
      .gte("date", startDate)
      .lte("date", endDate)
      .neq("job_id", targetJobId);  // Exclude target job

    if (timesheetsError || !timesheets?.length) {
      return null;
    }

    // Get unique conflicting job IDs
    const conflictingJobIds = Array.from(new Set(timesheets.map(ts => ts.job_id)));

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,start_time,end_time")
      .in("id", conflictingJobIds);

    if (jobsError || !jobs?.length) {
      return null;
    }

    // Return first conflicting job (if multiple, user needs to handle them)
    const conflictingJob = jobs[0];
    return conflictingJob
      ? {
          id: conflictingJob.id,
          title: conflictingJob.title,
          start_time: conflictingJob.start_time!,
          end_time: conflictingJob.end_time!,
        }
      : null;
  } catch (error) {
    console.warn("Conflict pre-check error", error);
    return null;
  }
}

/**
 * OPTIMIZED: Get conflict information for a technician
 * Uses timesheets to determine actual work dates
 */
export async function getTechnicianConflicts(
  technicianId: string,
  jobStartTime: string,
  jobEndTime: string
) {
  try {
    const jobStartDate = new Date(jobStartTime).toISOString().split('T')[0];
    const jobEndDate = new Date(jobEndTime).toISOString().split('T')[0];

    // OPTIMIZED: Query ACTIVE timesheets to see which days technician is working
    // Filter by is_active to exclude voided timesheets (day-off/travel dates)
    const { data: timesheets, error: timesheetsError } = await supabase
      .from("timesheets")
      .select("job_id, date")
      .eq("technician_id", technicianId)
      .eq("is_active", true)
      .gte("date", jobStartDate)
      .lte("date", jobEndDate);

    if (timesheetsError) {
      throw timesheetsError;
    }

    // Get unique job IDs from timesheets
    const jobIds = Array.from(new Set((timesheets || []).map(ts => ts.job_id)));

    // Fetch job details
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, start_time, end_time, title")
      .in("id", jobIds);

    if (jobsError) {
      throw jobsError;
    }

    // Get unavailability conflicts
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

    // Format job conflicts with proper structure
    const jobConflicts = (jobs || []).map(job => ({
      job_id: job.id,
      jobs: job
    }));

    // Convert unavailability data
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
