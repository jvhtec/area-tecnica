import { dataLayerClient } from '@/services/dataLayerClient';

export interface SetPreventiveResourceResult {
  success: boolean;
  job_id: string;
  technician_id: string | null;
  previous_technician_id: string | null;
  email_sent: boolean;
  email_error?: string;
}

export async function setJobPreventiveResource(
  jobId: string,
  technicianId: string | null,
): Promise<SetPreventiveResourceResult> {
  const { data, error } = await dataLayerClient.functions.invoke<SetPreventiveResourceResult>(
    'set-job-preventive-resource',
    {
      body: {
        jobId,
        technicianId,
      },
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error('No se pudo actualizar el recurso preventivo');
  }

  return data;
}
