import { dataLayerClient } from "@/services/dataLayerClient";
import { isProductionDepartment } from "@/utils/permissions";

export type JobProducerClaim = {
  job_id: string;
  producer_id: string;
  display_name: string;
};

/**
 * A producer claim plus the contact details needed to actually reach them.
 * `phone`/`email` come from a separate RPC that only releases them to callers
 * entitled to the job (see 20260915154500_add_job_producer_contact_directory).
 */
export type JobProducerContact = JobProducerClaim & {
  phone: string | null;
  email: string | null;
};

// Feature code only keeps the candidate id and display name; every other
// profile-directory field is dropped at this boundary.
export type ProducerCandidate = {
  id: string;
  displayName: string;
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

export const fetchJobProducerContacts = async (jobIds: string[]): Promise<JobProducerContact[]> => {
  if (jobIds.length === 0) return [];
  const { data, error } = await dataLayerClient.rpc(
    "get_job_producer_contacts" as never,
    { p_job_ids: jobIds } as never,
  );
  if (error) throw error;
  return Array.isArray(data) ? data as unknown as JobProducerContact[] : [];
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

// Module-level cache so every card/dialog on a page shares one profile
// directory request instead of each issuing its own. Resolved data stays
// cached for the session; a failure clears the cache so the next caller
// retries instead of being stuck on a rejected promise.
let producerCandidatesPromise: Promise<ProducerCandidate[]> | null = null;

export const fetchProducerCandidates = (): Promise<ProducerCandidate[]> => {
  if (!producerCandidatesPromise) {
    producerCandidatesPromise = Promise.resolve(
      dataLayerClient.rpc("get_profile_directory" as never, { p_profile_ids: null } as never),
    )
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (error) throw error;
        const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        return rows
          .filter((row) => isProductionDepartment(row.department as string | null))
          .map((row) => ({
            id: row.id as string,
            displayName:
              [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
              (row.nickname as string) ||
              "Producción",
          }));
      })
      .catch((error: unknown) => {
        producerCandidatesPromise = null;
        throw error;
      });
  }
  return producerCandidatesPromise;
};

export const __resetProducerCandidatesCacheForTests = () => {
  producerCandidatesPromise = null;
};

/**
 * Add every producer carrying the job to a generated document's contact list.
 *
 * A producer already listed (same profile or same name) is not duplicated, but
 * its phone/email are backfilled: the existing entry usually comes from job
 * staffing and can be missing the contact columns this projection carries.
 */
export const mergeProducerClaimsIntoContacts = (
  contacts: DocumentContact[],
  claims: Array<JobProducerClaim | JobProducerContact>,
): DocumentContact[] => {
  const merged = [...contacts];

  for (const claim of claims) {
    const { producer_id, display_name } = claim;
    const phone = "phone" in claim ? claim.phone ?? undefined : undefined;
    const email = "email" in claim ? claim.email ?? undefined : undefined;

    const existingIndex = merged.findIndex(
      (contact) => contact.technician_id === producer_id || contact.name?.trim() === display_name,
    );

    if (existingIndex === -1) {
      merged.push({
        name: display_name,
        role: "Producción",
        technician_id: producer_id,
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      });
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      phone: existing.phone || phone,
      email: existing.email || email,
    };
  }

  return merged;
};
