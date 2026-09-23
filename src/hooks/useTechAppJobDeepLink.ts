import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

type Options<Job> = {
  /** True once the technician's assignments have loaded. */
  isReady: boolean;
  /** Returns the job from the technician's own assignments, if they have it. */
  resolveJob: (jobId: string) => Job | undefined;
  onOpenDetails: (job: Job) => void;
};

/**
 * Handles `/tech-app?open=details&jobId=<id>` — the link a push notification
 * about a job carries for a freelance technician (see
 * `supabase/functions/push/recipientDestinations.ts`). Opens that job's details
 * once assignments load, then drops the params so a refresh does not reopen it.
 */
export function useTechAppJobDeepLink<Job>({ isReady, resolveJob, onOpenDetails }: Options<Job>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef<string | null>(null);
  const resolveJobRef = useRef(resolveJob);
  const onOpenDetailsRef = useRef(onOpenDetails);
  resolveJobRef.current = resolveJob;
  onOpenDetailsRef.current = onOpenDetails;

  const open = searchParams.get('open');
  const jobId = searchParams.get('jobId');

  useEffect(() => {
    if (open !== 'details' || !jobId) {
      // Params cleared: a later tap on a push for the same job must reopen it.
      handledRef.current = null;
      return;
    }
    if (!isReady || handledRef.current === jobId) return;
    handledRef.current = jobId;

    const job = resolveJobRef.current(jobId);
    if (job) {
      onOpenDetailsRef.current(job);
    } else {
      // The job may have been cancelled or the assignment removed since the
      // push was sent; say so instead of silently showing the list.
      toast.info('Este trabajo ya no figura en tu agenda');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('open');
    nextParams.delete('jobId');
    setSearchParams(nextParams, { replace: true });
  }, [isReady, jobId, open, searchParams, setSearchParams]);
}
