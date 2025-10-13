import { supabase } from "@/lib/supabase";
import { addDays, startOfDay } from "date-fns";
import { fromJobTimezone, toJobTimezone } from "@/utils/timezoneUtils";

export type JobStatus = "Tentativa" | "Confirmado" | "Completado" | "Cancelado";

/**
 * Checks if a job should be automatically completed based on its end date
 */
export const shouldAutoComplete = (job: any): boolean => {
  if (!job?.end_time || job.status === "Cancelado" || job.status === "Completado") {
    return false;
  }

  const end = new Date(job.end_time);
  if (Number.isNaN(end.getTime())) {
    return false;
  }

  const timezone = job.timezone || "Europe/Madrid";
  const now = new Date();
  // Only auto-complete starting the day AFTER the job ends (D+1 at 00:00 job local time)
  const endLocal = toJobTimezone(end, timezone);
  const nextDayStartLocal = startOfDay(addDays(endLocal, 1));
  const nextDayStartUTC = fromJobTimezone(nextDayStartLocal, timezone);

  return now >= nextDayStartUTC;
};

/**
 * Automatically updates job statuses for past jobs
 */
export const autoCompleteJobs = async (jobs: any[]): Promise<{ updatedJobs: any[], updatedCount: number }> => {
  const jobsToUpdate = jobs.filter(shouldAutoComplete);
  
  if (jobsToUpdate.length === 0) {
    return { updatedJobs: jobs, updatedCount: 0 };
  }

  try {
    // Update jobs in database
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'Completado' })
      .in('id', jobsToUpdate.map(job => job.id))
      .neq('status', 'Cancelado'); // Extra safety check

    if (error) throw error;

    // Update local job data
    const updatedJobs = jobs.map(job => {
      if (jobsToUpdate.some(updateJob => updateJob.id === job.id)) {
        return { ...job, status: 'Completado' };
      }
      return job;
    });

    return { updatedJobs, updatedCount: jobsToUpdate.length };
  } catch (error) {
    console.error('Error auto-completing jobs:', error);
    return { updatedJobs: jobs, updatedCount: 0 };
  }
};

/**
 * Database function to auto-complete all past jobs
 */
export const autoCompleteAllPastJobs = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('auto_complete_past_jobs');
    
    if (error) throw error;
    
    return data || 0;
  } catch (error) {
    console.error('Error calling auto_complete_past_jobs:', error);
    return 0;
  }
};
