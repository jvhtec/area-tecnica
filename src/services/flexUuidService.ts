
import { supabase } from "@/lib/supabase";

interface FlexUuidResult {
  uuid: string | null;
  error: string | null;
}

/**
 * Definitive service for retrieving flex folder UUIDs based on job type and department
 * - Dryhire: Uses flex_folders table with folder_type 'dryhire' -> element_id
 * - Tourdate: Uses tour department columns from tours table -> department-specific column
 * - Single: Uses flex_folders table with folder_type 'department' -> element_id
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
        .select(`
          id,
          job_type,
          tour_id,
          tours (
            flex_main_folder_id,
            flex_sound_folder_id,
            flex_lights_folder_id,
            flex_video_folder_id,
            flex_production_folder_id,
            flex_personnel_folder_id,
            flex_comercial_folder_id
          )
        `)
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

      // Handle each job type according to specifications
      switch (jobData.job_type) {
        case 'dryhire':
          return await this.getDryhireFlexUuid(jobId, userDepartment);
        
        case 'tourdate':
          return await this.getTourDateFlexUuid(jobData, userDepartment);
        
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
   * Uses flex_folders table with folder_type 'dryhire' -> element_id
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
   * Uses tour department columns from tours table
   */
  private static async getTourDateFlexUuid(jobData: any, userDepartment: string): Promise<FlexUuidResult> {
    console.log(`[FlexUuidService] Fetching tourdate UUID for department ${userDepartment}`);
    
    if (!jobData.tours) {
      console.error('[FlexUuidService] No tour data found for tourdate job');
      return { uuid: null, error: 'Tour data not found' };
    }

    const tourData = jobData.tours;
    
    // Map user department to tour flex folder column
    const departmentMapping: { [key: string]: string } = {
      'sound': 'flex_sound_folder_id',
      'lights': 'flex_lights_folder_id',
      'video': 'flex_video_folder_id',
      'production': 'flex_production_folder_id',
      'logistics': 'flex_production_folder_id', // logistics maps to production
      'personnel': 'flex_personnel_folder_id',
      'comercial': 'flex_comercial_folder_id'
    };

    const departmentColumn = departmentMapping[userDepartment.toLowerCase()];
    
    if (!departmentColumn) {
      console.log(`[FlexUuidService] Unknown department ${userDepartment}, using main folder`);
      const uuid = tourData.flex_main_folder_id;
      return { uuid, error: uuid ? null : 'No main folder found for tour' };
    }

    // Get department-specific folder, fallback to main folder
    const uuid = tourData[departmentColumn] || tourData.flex_main_folder_id;
    
    if (!uuid) {
      console.log(`[FlexUuidService] No folder found for department ${userDepartment} or main folder`);
      return { uuid: null, error: 'No folder found for this department' };
    }

    console.log(`[FlexUuidService] Found tourdate UUID: ${uuid}`);
    return { uuid, error: null };
  }

  /**
   * Get flex UUID for single jobs
   * Uses flex_folders table with folder_type 'department' -> element_id
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
