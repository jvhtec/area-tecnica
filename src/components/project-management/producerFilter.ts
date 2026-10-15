/** Filter value for confirmable jobs nobody in production has claimed yet. */
export const UNASSIGNED_PRODUCER = "__sin_responsable__";

type ProducerClaimLike = { producer_id: string; display_name?: string | null };

export type ProducerFilterJob = {
  job_type?: string | null;
  job_producer_claims?: ProducerClaimLike[] | null;
};

export type ProducerOption = { id: string; label: string; isCurrentUser: boolean };

const isDryHire = (jobType?: string | null) => {
  const type = String(jobType ?? "").toLowerCase();
  return type === "dryhire" || type === "dry_hire" || type === "dry-hire";
};

/**
 * A job matches when one of its producers is selected, or when "Sin
 * responsable" is selected and the job has none. Dry-hire jobs can never be
 * claimed (DB trigger), so they are not "sin responsable".
 */
export const matchesProducerFilter = (job: ProducerFilterJob, selectedIds: string[]) => {
  if (selectedIds.length === 0) return true;
  const claims = job.job_producer_claims ?? [];
  if (claims.length === 0) {
    return selectedIds.includes(UNASSIGNED_PRODUCER) && !isDryHire(job.job_type);
  }
  return claims.some((claim) => selectedIds.includes(claim.producer_id));
};

/**
 * Producers claiming the loaded jobs, sorted by name with the current user
 * first. Selected producers who have no job in the current view stay listed
 * (named from `knownNames`) so they can still be cleared.
 */
export const buildProducerOptions = (
  jobs: ProducerFilterJob[],
  currentUserId: string | null | undefined,
  selectedIds: string[],
  knownNames: ReadonlyMap<string, string>,
): ProducerOption[] => {
  const names = new Map<string, string>();
  for (const job of jobs) {
    for (const claim of job.job_producer_claims ?? []) {
      if (!names.has(claim.producer_id)) {
        names.set(claim.producer_id, claim.display_name?.trim() || knownNames.get(claim.producer_id) || "Sin nombre");
      }
    }
  }
  for (const id of selectedIds) {
    if (id !== UNASSIGNED_PRODUCER && !names.has(id)) {
      names.set(id, knownNames.get(id) ?? "Productor");
    }
  }

  return Array.from(names, ([id, label]) => ({ id, label, isCurrentUser: id === currentUserId }))
    .sort((a, b) => {
      if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });
};

export const producerOptionLabel = (option: ProducerOption) =>
  option.isCurrentUser ? `Yo · ${option.label}` : option.label;

/** Remembers display names across months so a selected producer keeps its label. */
export const collectProducerNames = (jobs: ProducerFilterJob[], into: Map<string, string>) => {
  for (const job of jobs) {
    for (const claim of job.job_producer_claims ?? []) {
      const name = claim.display_name?.trim();
      if (name) into.set(claim.producer_id, name);
    }
  }
  return into;
};
