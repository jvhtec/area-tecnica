
import { supabase } from "@/lib/supabase";

interface FlexUuidResult {
  uuid: string | null;
  error: string | null;
}

/**
 * Service for retrieving flex folder UUIDs based on job type and department
 * Uses the flex_folders table with correct folder_type conditions
 */
export class FlexUuidService {
  /**
   * Get flex UUID for a job based on its type and user's department
   */
  static async getFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    try {
      console.log(`[FlexUuidService] Getting flex UUID for job ${jobId}, department: ${userDepartment}`);

      // First, get job information to determine job type
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, job_type, tour_id')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('[FlexUuidService] Error fetching job data:', jobError);
        return { uuid: null, error: 'Job not found' };
      }

      if (!jobData) {
        console.error('[FlexUuidService] No job data found for ID:', jobId);
        return { uuid: null, error: 'Job not found' };
      }

      console.log(`[FlexUuidService] Job type: ${jobData.job_type}, Tour ID: ${jobData.tour_id}`);

      // Handle each job type with correct folder_type logic
      switch (jobData.job_type) {
        case 'dryhire':
          return await this.getDryhireFlexUuid(jobId, userDepartment);
        
        case 'tourdate':
          return await this.getTourDateFlexUuid(jobId, userDepartment);
        
        default: // 'single' and other types
          return await this.getSingleJobFlexUuid(jobId, userDepartment);
      }
    } catch (error) {
      console.error('[FlexUuidService] Unexpected error in getFlexUuid:', error);
      return { uuid: null, error: 'Failed to fetch flex UUID' };
    }
  }

  /**
   * Get flex UUID for dryhire jobs
   * Uses flex_folders table with folder_type 'dryhire'
   */
  private static async getDryhireFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching dryhire UUID for job ${jobId}, department ${userDepartment}`);
    
    const { data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'dryhire')
      .maybeSingle();

    if (error) {
      console.error('[FlexUuidService] Error fetching dryhire flex folder:', error);
      return { uuid: null, error: 'Failed to fetch dryhire folder' };
    }

    if (!data) {
      console.log(`[FlexUuidService] No dryhire folder found for job ${jobId}, department ${userDepartment}`);
      return { uuid: null, error: 'Dryhire folder not found for this department' };
    }

    console.log(`[FlexUuidService] Found dryhire UUID: ${data.element_id}`);
    return { uuid: data.element_id, error: null };
  }

  /**
   * Get flex UUID for tourdate jobs
   * Uses flex_folders table with folder_type 'tourdate' or 'tourdate_subfolder'
   */
  private static async getTourDateFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching tourdate UUID for job ${jobId}, department ${userDepartment}`);
    
    // Try main tourdate folder first
    let { data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'tourdate')
      .maybeSingle();

    if (error) {
      console.error('[FlexUuidService] Error fetching tourdate flex folder:', error);
      return { uuid: null, error: 'Failed to fetch tourdate folder' };
    }

    if (data) {
      console.log(`[FlexUuidService] Found tourdate UUID: ${data.element_id}`);
      return { uuid: data.element_id, error: null };
    }

    // Try tourdate subfolder as fallback
    ({ data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'tourdate_subfolder')
      .maybeSingle());

    if (error) {
      console.error('[FlexUuidService] Error fetching tourdate subfolder:', error);
      return { uuid: null, error: 'Failed to fetch tourdate subfolder' };
    }

    if (!data) {
      console.log(`[FlexUuidService] No tourdate folder found for job ${jobId}, department ${userDepartment}`);
      return { uuid: null, error: 'Tourdate folder not found for this department' };
    }

    console.log(`[FlexUuidService] Found tourdate subfolder UUID: ${data.element_id}`);
    return { uuid: data.element_id, error: null };
  }

  /**
   * Get flex UUID for single jobs
   * Uses flex_folders table with folder_type 'department'
   */
  private static async getSingleJobFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching single job UUID for job ${jobId}, department ${userDepartment}`);
    
    const { data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'department')
      .maybeSingle();

    if (error) {
      console.error('[FlexUuidService] Error fetching single job flex folder:', error);
      return { uuid: null, error: 'Failed to fetch job folder' };
    }

    if (!data) {
      console.log(`[FlexUuidService] No department folder found for job ${jobId}, department ${userDepartment}`);
      return { uuid: null, error: 'Department folder not found' };
    }

    console.log(`[FlexUuidService] Found single job UUID: ${data.element_id}`);
    return { uuid: data.element_id, error: null };
  }
}
