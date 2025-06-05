import { deleteJobAssignments } from "./deleteJobAssignments";
import { deleteJobDepartments } from "./deleteJobDepartments";
import { deleteJobDateTypes } from "./deleteJobDateTypes";
import { deleteFestivalLogos } from "./deleteFestivalLogos";
import { deleteFlexFolders } from "./flexFolderDeletionService";
import { supabase } from "@/lib/supabase";

const removeFlexCrewAssignments = async (jobId: string) => {
  try {
    console.log(`Removing Flex crew assignments for job ${jobId}`);
    
    // Get all crew calls for this job
    const { data: crewCalls, error: crewCallsError } = await supabase
      .from('flex_crew_calls')
      .select(`
        id,
        department,
        flex_crew_assignments (
          id,
          technician_id,
          flex_line_item_id
        )
      `)
      .eq('job_id', jobId);

    if (crewCallsError) {
      console.error('Error fetching crew calls for job deletion:', crewCallsError);
      return;
    }

    if (!crewCalls || crewCalls.length === 0) {
      console.log('No crew calls found for job');
      return;
    }

    // Remove all assignments from Flex
    for (const crewCall of crewCalls) {
      for (const assignment of crewCall.flex_crew_assignments) {
        try {
          const { error } = await supabase.functions.invoke('manage-flex-crew-assignments', {
            body: {
              job_id: jobId,
              technician_id: assignment.technician_id,
              department: crewCall.department,
              action: 'remove'
            }
          });

          if (error) {
            console.error(`Error removing Flex assignment for technician ${assignment.technician_id}:`, error);
          }
        } catch (error) {
          console.error(`Failed to remove Flex assignment for technician ${assignment.technician_id}:`, error);
        }
      }
    }

    console.log('Completed Flex crew assignment cleanup');
  } catch (error) {
    console.error('Error in removeFlexCrewAssignments:', error);
  }
};

export const deleteJobWithCleanup = async (jobId: string): Promise<void> => {
  try {
    console.log(`Starting deletion process for job ${jobId}`);

    // Remove Flex crew assignments first
    await removeFlexCrewAssignments(jobId);

    // Delete job assignments
    await deleteJobAssignments(jobId);

    // Delete job departments
    await deleteJobDepartments(jobId);

    // Delete job date types
    await deleteJobDateTypes(jobId);

    // Delete festival logos
    await deleteFestivalLogos(jobId);

    // Delete flex folders
    await deleteFlexFolders(jobId);

    // Finally, delete the job itself
    const { error: jobError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (jobError) {
      console.error("Error deleting job:", jobError);
      throw jobError;
    }

    console.log(`Job ${jobId} and all related data deleted successfully`);
  } catch (error) {
    console.error(`Error deleting job ${jobId}:`, error);
    throw error;
  }
};

export const deleteMultipleJobsWithCleanup = async (jobIds: string[]): Promise<void> => {
  try {
    console.log(`Starting deletion process for jobs ${jobIds.join(', ')}`);

    for (const jobId of jobIds) {
      await deleteJobWithCleanup(jobId);
    }

    console.log(`Jobs ${jobIds.join(', ')} and all related data deleted successfully`);
  } catch (error) {
    console.error(`Error deleting jobs ${jobIds.join(', ')}:`, error);
    throw error;
  }
};
