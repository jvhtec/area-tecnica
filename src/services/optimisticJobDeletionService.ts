
import { deleteJobWithCleanup } from "./jobDeletionService";
import { getErrorMessage } from '@/utils/errorMessage';

interface DeletionResult {
  success: boolean;
  error?: string;
  details?: string;
}

export const deleteJobOptimistically = async (jobId: string): Promise<DeletionResult> => {
  try {
    console.log("Optimistic deletion service: Starting job deletion for:", jobId);
    
    await deleteJobWithCleanup(jobId);
    
    return {
      success: true,
      details: "Job deleted successfully and cleanup completed"
    };
  } catch (error) {
    console.error("Optimistic deletion service: Error deleting job:", error);
    return {
      success: false,
      error: getErrorMessage(error) || "Unknown deletion error"
    };
  }
};
