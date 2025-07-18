import { supabase } from "@/lib/supabase";

interface FlexUuidResult {
  uuid: string | null;
  error: string | null;
}

/**
 * Service for retrieving flex folder UUIDs based on job type, tour, and department
 * Handles job IDs, tour date IDs, and tour IDs
 */
export class FlexUuidService {
  /**
   * Get flex UUID for a job, tour date, or tour based on context
   */
  static async getFlexUuid(identifier: string, userDepartment: string): Promise<FlexUuidResult> {
    try {
      console.log(`[FlexUuidService] Getting flex UUID for identifier ${identifier}, department: ${userDepartment}`);

      // First, determine the type of identifier by checking each table
      const identifierType = await this.determineIdentifierType(identifier);
      console.log(`[FlexUuidService] Identifier type determined: ${identifierType}`);

      switch (identifierType) {
        case 'tour_date':
          return await this.getTourDateFlexUuidDirect(identifier, userDepartment);
        
        case 'tour':
          return await this.getTourFlexUuid(identifier, userDepartment);
        
        case 'job':
          return await this.getJobFlexUuid(identifier, userDepartment);
        
        default:
          console.error('[FlexUuidService] Unknown identifier type for:', identifier);
          return { uuid: null, error: 'Unknown identifier type' };
      }
    } catch (error) {
      console.error('[FlexUuidService] Unexpected error in getFlexUuid:', error);
      return { uuid: null, error: 'Failed to fetch flex UUID' };
    }
  }

  /**
   * Determine what type of identifier we're dealing with
   */
  private static async determineIdentifierType(identifier: string): Promise<'tour_date' | 'tour' | 'job' | 'unknown'> {
    // Check if it's a tour date ID
    const { data: tourDateData } = await supabase
      .from('tour_dates')
      .select('id')
      .eq('id', identifier)
      .maybeSingle();

    if (tourDateData) {
      return 'tour_date';
    }

    // Check if it's a tour ID
    const { data: tourData } = await supabase
      .from('tours')
      .select('id')
      .eq('id', identifier)
      .maybeSingle();

    if (tourData) {
      return 'tour';
    }

    // Check if it's a job ID
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', identifier)
      .maybeSingle();

    if (jobData) {
      return 'job';
    }

    return 'unknown';
  }

  /**
   * Get flex UUID for tour-level folders - now checks tour table first
   */
  private static async getTourFlexUuid(tourId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching tour-level UUID for tour ${tourId}, department ${userDepartment}`);
    
    // First, check for tour-level folder IDs in the tours table
    const { data: tourData, error: tourError } = await supabase
      .from('tours')
      .select('flex_sound_folder_id, flex_lights_folder_id, flex_video_folder_id, flex_production_folder_id, flex_personnel_folder_id')
      .eq('id', tourId)
      .maybeSingle();

    if (tourError) {
      console.error('[FlexUuidService] Error fetching tour data:', tourError);
      return { uuid: null, error: 'Failed to fetch tour data' };
    }

    if (tourData) {
      // Map department to the corresponding flex folder column
      const departmentToColumn: Record<string, string> = {
        'sound': 'flex_sound_folder_id',
        'lights': 'flex_lights_folder_id', 
        'video': 'flex_video_folder_id',
        'production': 'flex_production_folder_id',
        'personnel': 'flex_personnel_folder_id'
      };

      const columnName = departmentToColumn[userDepartment];
      if (columnName && tourData[columnName as keyof typeof tourData]) {
        const folderId = tourData[columnName as keyof typeof tourData];
        console.log(`[FlexUuidService] Found tour-level folder for ${userDepartment}: ${folderId}`);
        return { uuid: folderId, error: null };
      }

      console.log(`[FlexUuidService] No tour-level folder found for department ${userDepartment}, falling back to job-based lookup`);
    }

    // Fallback to job-based lookup for backward compatibility
    return await this.getTourFlexUuidFromJobs(tourId, userDepartment);
  }

  /**
   * Get flex UUID for tour-level folders by finding jobs within the tour (fallback method)
   */
  private static async getTourFlexUuidFromJobs(tourId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Falling back to job-based lookup for tour ${tourId}, department ${userDepartment}`);
    
    // Get all jobs in this tour, ordered by start time to get the first chronologically
    const { data: tourJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, start_time')
      .eq('tour_id', tourId)
      .order('start_time', { ascending: true });

    if (jobsError) {
      console.error('[FlexUuidService] Error fetching tour jobs:', jobsError);
      return { uuid: null, error: 'Failed to fetch tour jobs' };
    }

    if (!tourJobs || tourJobs.length === 0) {
      console.log(`[FlexUuidService] No jobs found for tour ${tourId}`);
      return { uuid: null, error: 'No jobs found in this tour' };
    }

    console.log(`[FlexUuidService] Found ${tourJobs.length} jobs in tour, checking for flex folders...`);

    // Try to find a flex folder for any job in the tour
    for (const job of tourJobs) {
      console.log(`[FlexUuidService] Checking job ${job.id} for flex folders...`);
      
      // Try department-specific tourdate folder first
      let { data, error } = await supabase
        .from('flex_folders')
        .select('element_id')
        .eq('job_id', job.id)
        .eq('department', userDepartment)
        .eq('folder_type', 'tourdate')
        .maybeSingle();

      if (error) {
        console.error(`[FlexUuidService] Error checking tourdate folder for job ${job.id}:`, error);
        continue;
      }

      if (data) {
        console.log(`[FlexUuidService] Found tourdate folder for job ${job.id}: ${data.element_id}`);
        return { uuid: data.element_id, error: null };
      }

      // Try department-specific folder
      ({ data, error } = await supabase
        .from('flex_folders')
        .select('element_id')
        .eq('job_id', job.id)
        .eq('department', userDepartment)
        .eq('folder_type', 'department')
        .maybeSingle());

      if (error) {
        console.error(`[FlexUuidService] Error checking department folder for job ${job.id}:`, error);
        continue;
      }

      if (data) {
        console.log(`[FlexUuidService] Found department folder for job ${job.id}: ${data.element_id}`);
        return { uuid: data.element_id, error: null };
      }

      // Try general job folder as final fallback
      ({ data, error } = await supabase
        .from('flex_folders')
        .select('element_id')
        .eq('job_id', job.id)
        .eq('folder_type', 'job')
        .maybeSingle());

      if (error) {
        console.error(`[FlexUuidService] Error checking job folder for job ${job.id}:`, error);
        continue;
      }

      if (data) {
        console.log(`[FlexUuidService] Found job folder for job ${job.id}: ${data.element_id}`);
        return { uuid: data.element_id, error: null };
      }
    }

    console.log(`[FlexUuidService] No flex folders found for any job in tour ${tourId}, department ${userDepartment}`);
    return { uuid: null, error: 'No flex folders found for this tour' };
  }

  /**
   * Handle job-based flex UUID requests
   */
  private static async getJobFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    const jobData = await this.getJobData(jobId);
    
    if (!jobData) {
      console.error('[FlexUuidService] No job found for identifier:', jobId);
      return { uuid: null, error: 'Job not found' };
    }

    console.log(`[FlexUuidService] Job type: ${jobData.job_type}, Tour Date ID: ${jobData.tour_date_id}`);

    // Handle each job type
    switch (jobData.job_type) {
      case 'dryhire':
        return await this.getDryhireFlexUuid(jobData.id, userDepartment);
      
      case 'tourdate':
        // For tour date jobs, use the tour_date_id if available
        if (jobData.tour_date_id) {
          return await this.getTourDateFlexUuidDirect(jobData.tour_date_id, userDepartment);
        }
        // Fallback to job-based lookup for legacy data
        return await this.getTourDateFlexUuidByJob(jobData.id, userDepartment);
      
      default: // 'single' and other types including festivals
        return await this.getSingleJobFlexUuid(jobData.id, userDepartment);
    }
  }

  private static async getJobData(jobId: string) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_type, tour_id, tour_date_id')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error('[FlexUuidService] Error fetching job data:', error);
      return null;
    }

    return data;
  }

  /**
   * Get flex UUID for tour date using tour_date_id directly
   */
  private static async getTourDateFlexUuidDirect(tourDateId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching tourdate UUID directly for tour_date_id ${tourDateId}, department ${userDepartment}`);
    
    // Try main tourdate folder first
    let { data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('tour_date_id', tourDateId)
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
      .eq('tour_date_id', tourDateId)
      .eq('department', userDepartment)
      .eq('folder_type', 'tourdate_subfolder')
      .maybeSingle());

    if (error) {
      console.error('[FlexUuidService] Error fetching tourdate subfolder:', error);
      return { uuid: null, error: 'Failed to fetch tourdate subfolder' };
    }

    if (!data) {
      console.log(`[FlexUuidService] No tourdate folder found for tour_date_id ${tourDateId}, department ${userDepartment}`);
      return { uuid: null, error: 'Tourdate folder not found for this department' };
    }

    console.log(`[FlexUuidService] Found tourdate subfolder UUID: ${data.element_id}`);
    return { uuid: data.element_id, error: null };
  }

  /**
   * Get flex UUID for dryhire jobs
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
   * Get flex UUID for tourdate jobs using job_id (legacy fallback)
   */
  private static async getTourDateFlexUuidByJob(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching tourdate UUID by job for job ${jobId}, department ${userDepartment}`);
    
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
   * Get flex UUID for single jobs (including festivals)
   */
  private static async getSingleJobFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching single job UUID for job ${jobId}, department ${userDepartment}`);
    
    // Try department-specific folder first
    let { data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'department')
      .maybeSingle();

    if (error) {
      console.error('[FlexUuidService] Error fetching department flex folder:', error);
    }

    if (data) {
      console.log(`[FlexUuidService] Found department UUID: ${data.element_id}`);
      return { uuid: data.element_id, error: null };
    }

    // Try general job folder as fallback
    ({ data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('folder_type', 'job')
      .maybeSingle());

    if (error) {
      console.error('[FlexUuidService] Error fetching job flex folder:', error);
    }

    if (data) {
      console.log(`[FlexUuidService] Found job UUID: ${data.element_id}`);
      return { uuid: data.element_id, error: null };
    }

    console.log(`[FlexUuidService] No folder found for job ${jobId}, department ${userDepartment}`);
    return { uuid: null, error: 'Job folder not found for this department' };
  }
}
