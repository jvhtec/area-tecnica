
import { supabase } from "@/lib/supabase";

export interface JobDeletionResult {
  success: boolean;
  deletedJobId?: string;
  error?: string;
  details?: string;
}

export const deleteJobComprehensively = async (jobId: string): Promise<JobDeletionResult> => {
  try {
    console.log(`Starting comprehensive deletion for job: ${jobId}`);
    
    // Step 1: Get job info for potential cleanup
    const { data: jobData, error: jobFetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobFetchError) {
      console.error('Error fetching job:', jobFetchError);
      return { success: false, error: 'Job not found' };
    }

    // Step 2: Delete from storage buckets (job documents, artist files, etc.)
    await cleanupStorageForJob(jobId);

    // Step 3: Delete related data in dependency order
    await deleteJobRelatedData(jobId);

    // Step 4: Delete the job itself
    const { error: jobDeleteError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (jobDeleteError) {
      console.error('Error deleting job:', jobDeleteError);
      throw new Error(`Failed to delete job: ${jobDeleteError.message}`);
    }

    console.log(`Successfully deleted job: ${jobId}`);
    return { 
      success: true, 
      deletedJobId: jobId,
      details: 'Job and all related data deleted successfully'
    };

  } catch (error: any) {
    console.error('Error in comprehensive job deletion:', error);
    return { 
      success: false, 
      error: error.message,
      details: 'Failed to delete job and related data'
    };
  }
};

const cleanupStorageForJob = async (jobId: string) => {
  try {
    // Get all job documents for storage cleanup
    const { data: jobDocs } = await supabase
      .from('job_documents')
      .select('file_path')
      .eq('job_id', jobId);

    // Get festival artists first, then their files
    const { data: festivalArtists } = await supabase
      .from('festival_artists')
      .select('id')
      .eq('job_id', jobId);

    const artistIds = festivalArtists?.map(artist => artist.id) || [];

    let artistFiles: any[] = [];
    if (artistIds.length > 0) {
      const { data: files } = await supabase
        .from('festival_artist_files')
        .select('file_path')
        .in('artist_id', artistIds);
      artistFiles = files || [];
    }

    // Get festival logos
    const { data: festivalLogos } = await supabase
      .from('festival_logos')
      .select('file_path')
      .eq('job_id', jobId);

    // Collect all file paths
    const filePaths = [
      ...(jobDocs || []).map(doc => doc.file_path),
      ...artistFiles.map(file => file.file_path),
      ...(festivalLogos || []).map(logo => logo.file_path)
    ].filter(Boolean);

    // Delete files from storage
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('job_documents')
        .remove(filePaths);
      
      if (storageError) {
        console.warn('Storage cleanup warning:', storageError);
      }
    }
  } catch (error) {
    console.warn('Storage cleanup failed:', error);
  }
};

const deleteJobRelatedData = async (jobId: string) => {
  // Delete in reverse dependency order to avoid foreign key violations
  
  // 1. Delete task documents first (they reference tasks)
  await deleteTaskDocuments(jobId);
  
  // 2. Delete department-specific data
  await deleteDepartmentData(jobId);
  
  // 3. Delete job-specific data
  await deleteJobSpecificData(jobId);
  
  // 4. Delete festival-specific data if applicable
  await deleteFestivalData(jobId);
  
  // 5. Delete logistics and other supporting data
  await deleteLogisticsData(jobId);
  
  // 6. Delete assignments and notifications
  await deleteAssignmentData(jobId);
  
  // 7. Delete flexible folders
  await deleteFlexFolders(jobId);
};

const deleteTaskDocuments = async (jobId: string) => {
  try {
    // Get all task IDs for this job across all departments
    const [soundTasks, lightsTasks, videoTasks] = await Promise.all([
      supabase.from('sound_job_tasks').select('id').eq('job_id', jobId),
      supabase.from('lights_job_tasks').select('id').eq('job_id', jobId),
      supabase.from('video_job_tasks').select('id').eq('job_id', jobId)
    ]);

    const soundTaskIds = soundTasks.data?.map(t => t.id) || [];
    const lightsTaskIds = lightsTasks.data?.map(t => t.id) || [];
    const videoTaskIds = videoTasks.data?.map(t => t.id) || [];

    // Delete task documents for each department
    const deletePromises = [];
    
    if (soundTaskIds.length > 0) {
      deletePromises.push(
        supabase.from('task_documents').delete().in('sound_task_id', soundTaskIds)
      );
    }
    
    if (lightsTaskIds.length > 0) {
      deletePromises.push(
        supabase.from('task_documents').delete().in('lights_task_id', lightsTaskIds)
      );
    }
    
    if (videoTaskIds.length > 0) {
      deletePromises.push(
        supabase.from('task_documents').delete().in('video_task_id', videoTaskIds)
      );
    }

    await Promise.all(deletePromises);
  } catch (error) {
    console.warn('Task documents deletion failed:', error);
  }
};

const deleteDepartmentData = async (jobId: string) => {
  try {
    await Promise.all([
      // Department tasks
      supabase.from('sound_job_tasks').delete().eq('job_id', jobId),
      supabase.from('lights_job_tasks').delete().eq('job_id', jobId),
      supabase.from('video_job_tasks').delete().eq('job_id', jobId),
      
      // Department personnel
      supabase.from('sound_job_personnel').delete().eq('job_id', jobId),
      supabase.from('lights_job_personnel').delete().eq('job_id', jobId),
      supabase.from('video_job_personnel').delete().eq('job_id', jobId),
      
      // Memoria tecnica documents
      supabase.from('memoria_tecnica_documents').delete().eq('job_id', jobId),
      supabase.from('lights_memoria_tecnica_documents').delete().eq('job_id', jobId),
      supabase.from('video_memoria_tecnica_documents').delete().eq('job_id', jobId)
    ]);
  } catch (error) {
    console.warn('Department data deletion failed:', error);
  }
};

const deleteJobSpecificData = async (jobId: string) => {
  try {
    await Promise.all([
      // Job documents
      supabase.from('job_documents').delete().eq('job_id', jobId),
      
      // Job departments
      supabase.from('job_departments').delete().eq('job_id', jobId),
      
      // Job date types
      supabase.from('job_date_types').delete().eq('job_id', jobId),
      
      // Job milestones and definitions
      supabase.from('job_milestones').delete().eq('job_id', jobId),
      supabase.from('job_milestone_definitions').delete().eq('job_id', jobId),
      
      // Power requirement tables
      supabase.from('power_requirement_tables').delete().eq('job_id', jobId),
      
      // Hoja de ruta and related data
      deleteHojaDeRutaData(jobId)
    ]);
  } catch (error) {
    console.warn('Job specific data deletion failed:', error);
  }
};

const deleteHojaDeRutaData = async (jobId: string) => {
  try {
    // Get hoja de ruta ID first
    const { data: hojaData } = await supabase
      .from('hoja_de_ruta')
      .select('id')
      .eq('job_id', jobId)
      .single();

    if (hojaData) {
      const hojaId = hojaData.id;
      
      // Delete related hoja de ruta data
      await Promise.all([
        supabase.from('hoja_de_ruta_contacts').delete().eq('hoja_de_ruta_id', hojaId),
        supabase.from('hoja_de_ruta_images').delete().eq('hoja_de_ruta_id', hojaId),
        supabase.from('hoja_de_ruta_logistics').delete().eq('hoja_de_ruta_id', hojaId),
        supabase.from('hoja_de_ruta_rooms').delete().eq('hoja_de_ruta_id', hojaId),
        supabase.from('hoja_de_ruta_staff').delete().eq('hoja_de_ruta_id', hojaId),
        supabase.from('hoja_de_ruta_travel').delete().eq('hoja_de_ruta_id', hojaId)
      ]);
      
      // Delete the main hoja de ruta record
      await supabase.from('hoja_de_ruta').delete().eq('id', hojaId);
    }
  } catch (error) {
    console.warn('Hoja de ruta deletion failed:', error);
  }
};

const deleteFestivalData = async (jobId: string) => {
  try {
    // Get all festival artists for this job
    const { data: artists } = await supabase
      .from('festival_artists')
      .select('id')
      .eq('job_id', jobId);

    const artistIds = artists?.map(a => a.id) || [];

    if (artistIds.length > 0) {
      // Delete artist-related data
      await Promise.all([
        supabase.from('festival_artist_files').delete().in('artist_id', artistIds),
        supabase.from('festival_artist_form_submissions').delete().in('artist_id', artistIds),
        supabase.from('festival_artist_forms').delete().in('artist_id', artistIds)
      ]);
    }

    // Delete festival-specific data
    await Promise.all([
      supabase.from('festival_artists').delete().eq('job_id', jobId),
      supabase.from('festival_gear_setups').delete().eq('job_id', jobId),
      supabase.from('festival_logos').delete().eq('job_id', jobId),
      supabase.from('festival_settings').delete().eq('job_id', jobId),
      supabase.from('festival_shifts').delete().eq('job_id', jobId),
      supabase.from('festival_stages').delete().eq('job_id', jobId)
    ]);

    // Delete shift assignments (they reference shifts)
    const { data: shifts } = await supabase
      .from('festival_shifts')
      .select('id')
      .eq('job_id', jobId);

    const shiftIds = shifts?.map(s => s.id) || [];
    
    if (shiftIds.length > 0) {
      await supabase
        .from('festival_shift_assignments')
        .delete()
        .in('shift_id', shiftIds);
    }

    // Delete gear setup related data
    const { data: gearSetups } = await supabase
      .from('festival_gear_setups')
      .select('id')
      .eq('job_id', jobId);

    const gearSetupIds = gearSetups?.map(g => g.id) || [];
    
    if (gearSetupIds.length > 0) {
      await supabase
        .from('festival_stage_gear_setups')
        .delete()
        .in('gear_setup_id', gearSetupIds);
    }
  } catch (error) {
    console.warn('Festival data deletion failed:', error);
  }
};

const deleteLogisticsData = async (jobId: string) => {
  try {
    // Get logistics events for this job
    const { data: events } = await supabase
      .from('logistics_events')
      .select('id')
      .eq('job_id', jobId);

    const eventIds = events?.map(e => e.id) || [];

    if (eventIds.length > 0) {
      // Delete logistics event departments
      await supabase
        .from('logistics_event_departments')
        .delete()
        .in('event_id', eventIds);
    }

    // Delete logistics events
    await supabase
      .from('logistics_events')
      .delete()
      .eq('job_id', jobId);
  } catch (error) {
    console.warn('Logistics data deletion failed:', error);
  }
};

const deleteAssignmentData = async (jobId: string) => {
  try {
    await Promise.all([
      // Job assignments
      supabase.from('job_assignments').delete().eq('job_id', jobId),
      
      // Assignment notifications
      supabase.from('assignment_notifications').delete().eq('job_id', jobId),
      
      // Availability conflicts
      supabase.from('availability_conflicts').delete().eq('job_id', jobId)
    ]);
  } catch (error) {
    console.warn('Assignment data deletion failed:', error);
  }
};

const deleteFlexFolders = async (jobId: string) => {
  try {
    await supabase
      .from('flex_folders')
      .delete()
      .eq('job_id', jobId);
  } catch (error) {
    console.warn('Flex folders deletion failed:', error);
  }
};
