import { bulkCompleteTasks, Department } from '@/services/taskCompletion';

/**
 * Auto-completion utility for tasks triggered by successful document uploads.
 * 
 * This module provides functionality to automatically mark relevant tasks as completed
 * when calculator PDFs (Pesos, Consumos) are successfully uploaded. The automation
 * creates an audit trail with completion metadata including timestamp, user, and source.
 * 
 * This module now delegates to the centralized task completion service for consistency.
 * 
 * Usage:
 * - Call autoCompleteTasksAfterUpload after a successful PDF upload
 * - Provide jobId, taskType (e.g., "Pesos", "Consumos"), and optional department
 * - Function handles cases where no matching tasks exist gracefully
 * 
 * Examples:
 * - PesosTool: autoCompleteTasksAfterUpload(jobId, "Pesos") // Completes all Pesos tasks
 * - ConsumosTool (sound): autoCompleteTasksAfterUpload(jobId, "Consumos", "sound") // Only sound
 */

interface AutoCompleteTasksParams {
  jobId: string;
  taskType: string;
  department?: Department;
  completionSource?: string;
}

interface AutoCompleteResult {
  success: boolean;
  completedCount: number;
  error?: string;
}

/**
 * Auto-completes tasks matching the given criteria after a successful document upload.
 * 
 * This function now delegates to the centralized bulkCompleteTasks service for consistency.
 * 
 * @param params - Configuration for task completion
 * @param params.jobId - The job ID to match tasks against
 * @param params.taskType - The task type to complete (e.g., "Pesos", "Consumos")
 * @param params.department - Optional department filter (sound/lights/video)
 * @param params.completionSource - Optional custom source identifier (defaults to auto_{taskType}_doc)
 * @returns Promise<AutoCompleteResult> - Result containing success status and completion count
 */
export async function autoCompleteTasksAfterUpload(
  params: AutoCompleteTasksParams
): Promise<AutoCompleteResult> {
  const { jobId, taskType, department, completionSource } = params;

  // Delegate to the centralized bulk completion service
  return bulkCompleteTasks({
    jobId,
    taskType,
    department,
    source: completionSource,
  });
}

/**
 * Helper function specifically for Pesos tool uploads.
 * Auto-completes all "Pesos" tasks for the given job across all departments.
 * 
 * @param jobId - The job ID
 * @returns Promise<AutoCompleteResult> - Result containing success status and completion count
 */
export async function autoCompletePesosTasks(jobId: string): Promise<AutoCompleteResult> {
  return autoCompleteTasksAfterUpload({
    jobId,
    taskType: 'Pesos',
    completionSource: 'auto_pesos_doc',
  });
}

/**
 * Helper function specifically for Consumos tool uploads.
 * Auto-completes "Consumos" tasks for the specified department only.
 * 
 * @param jobId - The job ID
 * @param department - The department (sound/lights/video)
 * @returns Promise<AutoCompleteResult> - Result containing success status and completion count
 */
export async function autoCompleteConsumosTasks(
  jobId: string,
  department: Department
): Promise<AutoCompleteResult> {
  return autoCompleteTasksAfterUpload({
    jobId,
    taskType: 'Consumos',
    department,
    completionSource: `auto_consumos_${department}_doc`,
  });
}
