import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { isDryHireJobType } from "@/utils/jobType";
import { canAssignJobProducerClaims, isProductionDepartment } from "@/utils/permissions";
import {
  claimJobForProducer,
  fetchJobProducerClaims,
  fetchProducerCandidates,
  releaseJobForProducer,
  type JobProducerClaim,
  type ProducerCandidate,
} from "@/features/jobs/producer-claims/producerClaims";

export const useJobProducerClaims = (
  jobId: string,
  jobType: string | null | undefined,
  initialClaims?: JobProducerClaim[],
) => {
  const { user, userRole, userDepartment } = useOptimizedAuth();
  const [claims, setClaims] = useState<JobProducerClaim[] | undefined>(initialClaims);
  const [isPending, setIsPending] = useState(false);
  const [candidates, setCandidates] = useState<ProducerCandidate[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const isDryHire = isDryHireJobType(jobType);

  useEffect(() => {
    if (isDryHire) {
      setClaims([]);
      return;
    }
    if (initialClaims !== undefined) {
      setClaims(initialClaims);
      return;
    }

    setClaims(undefined);
    void fetchJobProducerClaims([jobId]).then(setClaims, () => setClaims([]));
  }, [isDryHire, initialClaims, jobId]);

  const producerId = user?.id;
  const currentClaims = claims ?? [];
  const isClaimedByCurrentUser = Boolean(
    producerId && currentClaims.some((claim) => claim.producer_id === producerId),
  );
  const canAssign = !isDryHire && canAssignJobProducerClaims(userRole, userDepartment);

  useEffect(() => {
    if (!canAssign) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    void fetchProducerCandidates().then(
      (rows) => { if (!cancelled) setCandidates(rows); },
      () => { if (!cancelled) setCandidates([]); },
    );
    return () => {
      cancelled = true;
    };
  }, [canAssign]);

  const claimedIds = new Set(currentClaims.map((claim) => claim.producer_id));
  const assignableCandidates = canAssign
    ? candidates.filter((candidate) => candidate.id !== producerId && !claimedIds.has(candidate.id))
    : [];

  const toggleClaim = async () => {
    if (!producerId) return;
    setIsPending(true);
    try {
      await (isClaimedByCurrentUser
        ? releaseJobForProducer(jobId, producerId)
        : claimJobForProducer(jobId, producerId));
      setClaims(await fetchJobProducerClaims([jobId]));
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setIsPending(false);
    }
  };

  const assignProducer = async (candidateId: string) => {
    setIsAssigning(true);
    try {
      await claimJobForProducer(jobId, candidateId);
      setClaims(await fetchJobProducerClaims([jobId]));
    } catch {
      toast.error("No se pudo asignar");
    } finally {
      setIsAssigning(false);
    }
  };

  return {
    claims: currentClaims,
    canClaim: !isDryHire && Boolean(producerId && isProductionDepartment(userDepartment)),
    isClaimedByCurrentUser,
    isLoading: claims === undefined,
    isPending,
    toggleClaim: () => void toggleClaim(),
    canAssign,
    candidates: assignableCandidates,
    isAssigning,
    assignProducer: (candidateId: string) => void assignProducer(candidateId),
  };
};
