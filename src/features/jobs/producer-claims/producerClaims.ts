import { dataLayerClient } from "@/services/dataLayerClient";

export type JobProducerClaim = {
  job_id: string;
  producer_id: string;
  display_name: string;
};

export type DocumentContact = {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
  technician_id?: string;
};

const claimsTable = "job_producer_claims" as never;

export const fetchJobProducerClaims = async (jobIds: string[]): Promise<JobProducerClaim[]> => {
  if (jobIds.length === 0) return [];
  const { data, error } = await dataLayerClient.rpc(
    "get_job_producer_claims" as never,
    { p_job_ids: jobIds } as never,
  );
  if (error) throw error;
  return Array.isArray(data) ? data as unknown as JobProducerClaim[] : [];
};

export const claimJobForProducer = async (jobId: string, producerId: string) => {
  const { error } = await dataLayerClient
    .from(claimsTable)
    .insert({ job_id: jobId, producer_id: producerId } as never);
  if (error) throw error;
};

export const releaseJobForProducer = async (jobId: string, producerId: string) => {
  const { error } = await dataLayerClient
    .from(claimsTable)
    .delete()
    .eq("job_id", jobId)
    .eq("producer_id", producerId);
  if (error) throw error;
};

export const mergeProducerClaimsIntoContacts = (
  contacts: DocumentContact[],
  claims: JobProducerClaim[],
): DocumentContact[] => {
  const merged = [...contacts];

  for (const { producer_id, display_name } of claims) {
    const listed = merged.some(
      (contact) => contact.technician_id === producer_id || contact.name?.trim() === display_name,
    );
    if (!listed) merged.push({ name: display_name, role: "Producción", technician_id: producer_id });
  }

  return merged;
};
