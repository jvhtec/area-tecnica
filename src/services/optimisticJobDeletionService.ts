
import { supabase } from "@/lib/supabase";

export interface OptimisticJobDeletionResult {
  success: boolean;
  deletedJobId?: string;
  error?: string;
  details?: string;
}

/**
 * Performs optimistic job deletion - immediately removes from UI and handles cleanup in background
 */
export const deleteJobOptimistically = async (jobId: string): Promise<OptimisticJobDeletionResult> => {
  try {
    console.log(`Starting optimistic deletion for job: ${jobId}`);
    
    // Step 1: Verify user permissions first
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!userProfile || !['admin', 'management'].includes(userProfile.role)) {
      return { success: false, error: 'Insufficient permissions to delete jobs' };
    }

    // Step 2: Verify job exists
    const { data: jobData, error: jobFetchError } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('id', jobId)
      .single();

    if (jobFetchError || !jobData) {
      console.error('Job not found:', jobFetchError);
      return { success: false, error: 'Job not found' };
    }

    // Step 3: Call the background deletion edge function (fire and forget)
    try {
      // Don't await this - let it run in background
      supabase.functions.invoke('background-job-deletion', {
        body: { jobId }
      }).then(response => {
        if (response.error) {
          console.error('Background deletion error:', response.error);
        } else {
          console.log('Background deletion initiated successfully');
        }
      }).catch(error => {
        console.error('Failed to initiate background deletion:', error);
      });
    } catch (error) {
      console.warn('Background deletion call failed, but continuing with optimistic deletion:', error);
    }

    console.log(`Optimistic deletion completed for job: ${jobId}`);
    return { 
      success: true, 
      deletedJobId: jobId,
      details: `Job "${jobData.title}" deleted successfully`
    };

  } catch (error: any) {
    console.error('Error in optimistic job deletion:', error);
    return { 
      success: false, 
      error: error.message,
      details: 'Failed to delete job'
    };
  }
};
