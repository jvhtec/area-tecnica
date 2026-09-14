import { Button } from "@/components/ui/button";
import type { JobProducerClaim } from "@/features/jobs/producer-claims/producerClaims";
import { useJobProducerClaims } from "@/features/jobs/producer-claims/useJobProducerClaims";

type Props = {
  jobId: string;
  initialClaims?: JobProducerClaim[];
};

export const JobProducerClaims = ({ jobId, initialClaims }: Props) => {
  const claimState = useJobProducerClaims(jobId, initialClaims);
  if (claimState.isLoading) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/25 px-2.5 py-2"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="text-xs font-medium text-muted-foreground">Producción</span>
      <span className="min-w-0 flex-1 truncate text-xs">
        {claimState.claims.length
          ? claimState.claims.map((claim) => claim.display_name).join(", ")
          : "Sin responsable"}
      </span>
      {claimState.canClaim && (
        <Button
          type="button"
          size="sm"
          variant={claimState.isClaimedByCurrentUser ? "outline" : "secondary"}
          className="h-7 shrink-0 px-2.5 text-xs"
          disabled={claimState.isPending}
          onClick={claimState.toggleClaim}
        >
          {claimState.isClaimedByCurrentUser ? "Dejar de llevarlo" : "Hacerme cargo"}
        </Button>
      )}
    </div>
  );
};
