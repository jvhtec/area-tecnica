import { Button } from "@/components/ui/button";
import type { JobProducerClaim } from "@/features/jobs/producer-claims/producerClaims";
import { useJobProducerClaims } from "@/features/jobs/producer-claims/useJobProducerClaims";
import { isDryHireJobType } from "@/utils/jobType";

type Props = {
  jobId: string;
  jobType: string | null | undefined;
  initialClaims?: JobProducerClaim[];
};

export const JobProducerClaims = ({ jobId, jobType, initialClaims }: Props) => {
  const claimState = useJobProducerClaims(jobId, jobType, initialClaims);
  if (isDryHireJobType(jobType) || claimState.isLoading) return null;

  const claimedNames = claimState.claims.map((claim) => claim.display_name).join(", ");

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted/25 px-2.5 py-2"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Producción</span>
        <span className="min-w-0 truncate text-xs" title={claimedNames || undefined}>
          {claimState.claims.length ? claimedNames : "Sin responsable"}
        </span>
      </div>

      {(claimState.canClaim || claimState.canAssign) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {claimState.canClaim && (
            <Button
              type="button"
              size="sm"
              variant={claimState.isClaimedByCurrentUser ? "outline" : "secondary"}
              className="h-7 px-2.5 text-xs"
              disabled={claimState.isPending || claimState.isAssigning}
              title={claimState.isClaimedByCurrentUser
                ? "¿Ya te has arrepentido?"
                : "¿Estás seguro de que quieres hacerte cargo de este marrón?"}
              onClick={claimState.toggleClaim}
            >
              {claimState.isClaimedByCurrentUser ? "Dejar de llevarlo" : "Hacerme cargo"}
            </Button>
          )}

          {claimState.canAssign && (
            <select
              value=""
              onChange={(event) => claimState.assignProducer(event.target.value)}
              disabled={claimState.isPending || claimState.isAssigning}
              aria-label="Asignar a otro usuario de producción"
              title="Pasarle el marrón a otro"
              className="h-7 min-w-[7.5rem] rounded-md border border-input bg-background px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>Asignar</option>
              {claimState.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
};
