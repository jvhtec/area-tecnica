import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { isProductionDepartment } from "@/utils/permissions";
import {
  claimJobForProducer,
  fetchJobProducerClaims,
  releaseJobForProducer,
  type JobProducerClaim,
} from "@/features/jobs/producer-claims/producerClaims";

export const useJobProducerClaims = (
  jobId: string,
  initialClaims?: JobProducerClaim[],
) => {
  const { user, userDepartment } = useOptimizedAuth();
  const [claims, setClaims] = useState<JobProducerClaim[] | undefined>(initialClaims);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (initialClaims !== undefined) {
      setClaims(initialClaims);
      return;
    }

    setClaims(undefined);
    void fetchJobProducerClaims([jobId]).then(setClaims, () => setClaims([]));
  }, [initialClaims, jobId]);

  const producerId = user?.id;
  const currentClaims = claims ?? [];
  const isClaimedByCurrentUser = Boolean(
    producerId && currentClaims.some((claim) => claim.producer_id === producerId),
  );

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

  return {
    claims: currentClaims,
    canClaim: Boolean(producerId && isProductionDepartment(userDepartment)),
    isClaimedByCurrentUser,
    isLoading: claims === undefined,
    isPending,
    toggleClaim: () => void toggleClaim(),
  };
};
