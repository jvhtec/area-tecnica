
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JobDeletionResult {
  success: boolean;
  deletedJobId?: string;
  error?: string;
  details?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();
    
    if (!jobId) {
      return new Response(JSON.stringify({ success: false, error: 'Job ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting background deletion for job: ${jobId}`);

    // Initialize Supabase client with service role key for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Start the comprehensive deletion in the background
    EdgeRuntime.waitUntil(performComprehensiveDeletion(supabase, jobId));

    // Return immediate success response
    return new Response(JSON.stringify({ 
      success: true, 
      deletedJobId: jobId,
      details: 'Job deletion initiated in background'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in background-job-deletion function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performComprehensiveDeletion(supabase: any, jobId: string): Promise<void> {
  try {
    console.log(`Background deletion started for job: ${jobId}`);
    
    // Get job info for potential cleanup
    const { data: jobData, error: jobFetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobFetchError) {
      console.error('Error fetching job:', jobFetchError);
      return;
    }

    console.log('Job found, proceeding with deletion:', jobData);

    // Step 1: Delete from storage buckets (job documents, artist files, etc.)
    await cleanupStorageForJob(supabase, jobId);

    // Step 2: Delete related data in dependency order
    await deleteJobRelatedData(supabase, jobId);

    // Step 3: Delete the job itself
    const { error: jobDeleteError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (jobDeleteError) {
      console.error('Error deleting job:', jobDeleteError);
      throw new Error(`Failed to delete job: ${jobDeleteError.message}`);
    }

    console.log(`Successfully completed background deletion for job: ${jobId}`);

  } catch (error: any) {
    console.error('Error in comprehensive job deletion:', error);
    // Could potentially notify user of failure through a notification system
  }
}

async function cleanupStorageForJob(supabase: any, jobId: string) {
  try {
    console.log(`Starting storage cleanup for job: ${jobId}`);
    
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

    const artistIds = festivalArtists?.map((artist: any) => artist.id) || [];

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
      ...(jobDocs || []).map((doc: any) => doc.file_path),
      ...artistFiles.map((file: any) => file.file_path),
      ...(festivalLogos || []).map((logo: any) => logo.file_path)
    ].filter(Boolean);

    console.log(`Found ${filePaths.length} files to delete from storage`);

    // Delete files from storage
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('job_documents')
        .remove(filePaths);
      
      if (storageError) {
        console.warn('Storage cleanup warning:', storageError);
      } else {
        console.log('Storage cleanup completed successfully');
      }
    }
  } catch (error) {
    console.warn('Storage cleanup failed:', error);
  }
}

async function deleteJobRelatedData(supabase: any, jobId: string) {
  console.log(`Starting related data deletion for job: ${jobId}`);
  
  // Delete in reverse dependency order to avoid foreign key violations
  
  // 1. Delete task documents first (they reference tasks)
  await deleteTaskDocuments(supabase, jobId);
  
  // 2. Delete department-specific data
  await deleteDepartmentData(supabase, jobId);
  
  // 3. Delete job-specific data
  await deleteJobSpecificData(supabase, jobId);
  
  // 4. Delete festival-specific data if applicable
  await deleteFestivalData(supabase, jobId);
  
  // 5. Delete logistics and other supporting data
  await deleteLogisticsData(supabase, jobId);
  
  // 6. Delete assignments and notifications
  await deleteAssignmentData(supabase, jobId);
  
  // 7. Delete flexible folders
  await deleteFlexFolders(supabase, jobId);
  
  console.log(`Completed related data deletion for job: ${jobId}`);
}

async function deleteTaskDocuments(supabase: any, jobId: string) {
  try {
    console.log(`Deleting task documents for job: ${jobId}`);
    
    // Get all task IDs for this job across all departments
    const [soundTasks, lightsTasks, videoTasks] = await Promise.all([
      supabase.from('sound_job_tasks').select('id').eq('job_id', jobId),
      supabase.from('lights_job_tasks').select('id').eq('job_id', jobId),
      supabase.from('video_job_tasks').select('id').eq('job_id', jobId)
    ]);

    const soundTaskIds = soundTasks.data?.map((t: any) => t.id) || [];
    const lightsTaskIds = lightsTasks.data?.map((t: any) => t.id) || [];
    const videoTaskIds = videoTasks.data?.map((t: any) => t.id) || [];

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
    console.log('Task documents deleted successfully');
  } catch (error) {
    console.warn('Task documents deletion failed:', error);
  }
}

async function deleteDepartmentData(supabase: any, jobId: string) {
  try {
    console.log(`Deleting department data for job: ${jobId}`);
    
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
    
    console.log('Department data deleted successfully');
  } catch (error) {
    console.warn('Department data deletion failed:', error);
  }
}

async function deleteJobSpecificData(supabase: any, jobId: string) {
  try {
    console.log(`Deleting job specific data for job: ${jobId}`);
    
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
      deleteHojaDeRutaData(supabase, jobId)
    ]);
    
    console.log('Job specific data deleted successfully');
  } catch (error) {
    console.warn('Job specific data deletion failed:', error);
  }
}

async function deleteHojaDeRutaData(supabase: any, jobId: string) {
  try {
    console.log(`Deleting hoja de ruta data for job: ${jobId}`);
    
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
      console.log('Hoja de ruta data deleted successfully');
    }
  } catch (error) {
    console.warn('Hoja de ruta deletion failed:', error);
  }
}

async function deleteFestivalData(supabase: any, jobId: string) {
  try {
    console.log(`Deleting festival data for job: ${jobId}`);
    
    // Get all festival artists for this job
    const { data: artists } = await supabase
      .from('festival_artists')
      .select('id')
      .eq('job_id', jobId);

    const artistIds = artists?.map((a: any) => a.id) || [];

    if (artistIds.length > 0) {
      // Delete artist-related data
      await Promise.all([
        supabase.from('festival_artist_files').delete().in('artist_id', artistIds),
        supabase.from('festival_artist_form_submissions').delete().in('artist_id', artistIds),
        supabase.from('festival_artist_forms').delete().in('artist_id', artistIds)
      ]);
    }

    // Get festival shifts for this job before deleting
    const { data: shifts } = await supabase
      .from('festival_shifts')
      .select('id')
      .eq('job_id', jobId);

    const shiftIds = shifts?.map((s: any) => s.id) || [];
    
    if (shiftIds.length > 0) {
      await supabase
        .from('festival_shift_assignments')
        .delete()
        .in('shift_id', shiftIds);
    }

    // Get gear setup related data
    const { data: gearSetups } = await supabase
      .from('festival_gear_setups')
      .select('id')
      .eq('job_id', jobId);

    const gearSetupIds = gearSetups?.map((g: any) => g.id) || [];
    
    if (gearSetupIds.length > 0) {
      await supabase
        .from('festival_stage_gear_setups')
        .delete()
        .in('gear_setup_id', gearSetupIds);
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

    console.log('Festival data deleted successfully');
  } catch (error) {
    console.warn('Festival data deletion failed:', error);
  }
}

async function deleteLogisticsData(supabase: any, jobId: string) {
  try {
    console.log(`Deleting logistics data for job: ${jobId}`);
    
    // Get logistics events for this job
    const { data: events } = await supabase
      .from('logistics_events')
      .select('id')
      .eq('job_id', jobId);

    const eventIds = events?.map((e: any) => e.id) || [];

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

    console.log('Logistics data deleted successfully');
  } catch (error) {
    console.warn('Logistics data deletion failed:', error);
  }
}

async function deleteAssignmentData(supabase: any, jobId: string) {
  try {
    console.log(`Deleting assignment data for job: ${jobId}`);
    
    await Promise.all([
      // Job assignments
      supabase.from('job_assignments').delete().eq('job_id', jobId),
      
      // Assignment notifications
      supabase.from('assignment_notifications').delete().eq('job_id', jobId),
      
      // Availability conflicts
      supabase.from('availability_conflicts').delete().eq('job_id', jobId)
    ]);
    
    console.log('Assignment data deleted successfully');
  } catch (error) {
    console.warn('Assignment data deletion failed:', error);
  }
}

async function deleteFlexFolders(supabase: any, jobId: string) {
  try {
    console.log(`Deleting flex folders for job: ${jobId}`);
    
    await supabase
      .from('flex_folders')
      .delete()
      .eq('job_id', jobId);
      
    console.log('Flex folders deleted successfully');
  } catch (error) {
    console.warn('Flex folders deletion failed:', error);
  }
}
