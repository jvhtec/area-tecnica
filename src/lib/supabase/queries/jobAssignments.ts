import { supabase } from '@/integrations/supabase/client';

/**
 * Update the tour multiplier override flag for a specific job assignment
 * @param jobId - The job ID
 * @param technicianId - The technician ID
 * @param useTourMultipliers - Whether to force tour multipliers for this assignment
 * @returns The updated job assignment
 */
export async function updateJobAssignmentMultiplierOverride(
  jobId: string,
  technicianId: string,
  useTourMultipliers: boolean
) {
  const { data, error } = await supabase
    .from('job_assignments')
    .update({
      use_tour_multipliers: useTourMultipliers,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .eq('technician_id', technicianId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the tour multiplier override status for a specific job assignment
 * @param jobId - The job ID
 * @param technicianId - The technician ID
 * @returns Whether the override is enabled
 */
export async function getJobAssignmentMultiplierOverride(
  jobId: string,
  technicianId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('job_assignments')
    .select('use_tour_multipliers')
    .eq('job_id', jobId)
    .eq('technician_id', technicianId)
    .single();

  if (error) throw error;
  return data?.use_tour_multipliers ?? false;
}
