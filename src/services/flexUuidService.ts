
import { supabase } from "@/lib/supabase";

interface FlexUuidResult {
  uuid: string | null;
  error: string | null;
}

/**
 * Optimized service for retrieving flex folder UUIDs based on job type and department
 */
export class FlexUuidService {
  /**
   * Get flex UUID for a job based on its type and user's department
   */
  static async getFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    try {
      console.log(`Getting flex UUID for job ${jobId}, department: ${userDepartment}`);

      // First, get job information with a single query
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          id,
          job_type,
          tour_id,
          tour_date_id,
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

      if (jobError || !jobData) {
        console.error('Error fetching job data:', jobError);
        return { uuid: null, error: 'Job not found' };
      }

      // Handle different job types with optimized logic
      switch (jobData.job_type) {
        case 'dryhire':
          return await this.getDryhireFlexUuid(jobId, userDepartment);
        
        case 'tourdate':
          return await this.getTourDateFlexUuid(jobData, userDepartment);
        
        default: // 'single' and other types
          return await this.getSingleJobFlexUuid(jobId, userDepartment);
      }
    } catch (error) {
      console.error('Error in getFlexUuid:', error);
      return { uuid: null, error: 'Failed to fetch flex UUID' };
    }
  }

  /**
   * Get flex UUID for dryhire jobs (uses element_id from flex_folders)
   */
  private static async getDryhireFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    const { data, error } = await supabase
      .from('flex_folders')
      .select('element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'dryhire')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching dryhire flex folder:', error);
      return { uuid: null, error: 'Failed to fetch dryhire folder' };
    }

    return { uuid: data?.element_id || null, error: null };
  }

  /**
   * Get flex UUID for tourdate jobs (uses department-specific column from tours table)
   */
  private static async getTourDateFlexUuid(jobData: any, userDepartment: string): Promise<FlexUuidResult> {
    if (!jobData.tours) {
      return { uuid: null, error: 'Tour data not found' };
    }

    const tourData = jobData.tours;
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
      // Default to production if department not found
      const uuid = tourData.flex_production_folder_id || tourData.flex_main_folder_id;
      return { uuid, error: null };
    }

    const uuid = tourData[departmentColumn] || tourData.flex_main_folder_id;
    return { uuid, error: null };
  }

  /**
   * Get flex UUID for single jobs (uses parent_id or element_id from flex_folders)
   */
  private static async getSingleJobFlexUuid(jobId: string, userDepartment: string): Promise<FlexUuidResult> {
    const { data, error } = await supabase
      .from('flex_folders')
      .select('parent_id, element_id')
      .eq('job_id', jobId)
      .eq('department', userDepartment)
      .eq('folder_type', 'department')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching single job flex folder:', error);
      return { uuid: null, error: 'Failed to fetch job folder' };
    }

    if (!data) {
      return { uuid: null, error: null };
    }

    // For single jobs, prefer parent_id, fallback to element_id
    const uuid = data.parent_id || data.element_id;
    return { uuid, error: null };
  }
}
