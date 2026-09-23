import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { DETAILS_MODAL_TABS } from '@/components/technician/details-modal/constants';
import type { TabId } from '@/components/technician/details-modal/types';

type Options<Job> = {
  /** True once the technician's assignments have loaded. */
  isReady: boolean;
  /** Returns the job from the technician's own assignments, if they have it. */
  resolveJob: (jobId: string) => Job | undefined;
  onOpenDetails: (job: Job) => void;
};

const OPEN_PARAM = 'open';
const JOB_PARAM = 'jobId';
const DETAILS_TAB_PARAM = 'detailsTab';

const isDetailsTab = (value: string | null): value is TabId =>
  DETAILS_MODAL_TABS.some((tab) => tab.id === value);

/**
 * Keeps the open job-details modal in the URL:
 * `/tech-app?open=details&jobId=<id>&detailsTab=<tab>`.
 *
 * Two things depend on it:
 * - Push notifications about a job link freelancers straight to it (see
 *   `supabase/functions/push/recipientDestinations.ts`).
 * - Opening a document leaves the app (new window / system viewer). When the
 *   technician closes it the PWA or native shell can reload the page; with the
 *   state in the URL they come back to the same job and tab instead of the
 *   dashboard.
 *
 * URL updates use `replace`, so the back button behaves exactly as before.
 */
export function useTechAppJobDeepLink<Job>({ isReady, resolveJob, onOpenDetails }: Options<Job>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef<string | null>(null);
  const resolveJobRef = useRef(resolveJob);
  const onOpenDetailsRef = useRef(onOpenDetails);
  resolveJobRef.current = resolveJob;
  onOpenDetailsRef.current = onOpenDetails;

  const open = searchParams.get(OPEN_PARAM);
  const jobId = searchParams.get(JOB_PARAM);
  const rawDetailsTab = searchParams.get(DETAILS_TAB_PARAM);
  const detailsTab: TabId | undefined = isDetailsTab(rawDetailsTab) ? rawDetailsTab : undefined;

  const updateParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      mutate(next);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearDetailsParams = useCallback(() => {
    updateParams((params) => {
      params.delete(OPEN_PARAM);
      params.delete(JOB_PARAM);
      params.delete(DETAILS_TAB_PARAM);
    });
  }, [updateParams]);

  useEffect(() => {
    if (open !== 'details' || !jobId) {
      // Params cleared: a later link to the same job must reopen it.
      handledRef.current = null;
      return;
    }
    if (!isReady || handledRef.current === jobId) return;
    handledRef.current = jobId;

    const job = resolveJobRef.current(jobId);
    if (job) {
      onOpenDetailsRef.current(job);
      return;
    }
    // The job may have been cancelled or the assignment removed since the
    // link was made; say so instead of silently showing the list.
    toast.info('Este trabajo ya no figura en tu agenda');
    clearDetailsParams();
  }, [clearDetailsParams, isReady, jobId, open]);

  /** Record that the details modal is open for `id` (call when opening it). */
  const rememberOpenDetails = useCallback((id: string) => {
    handledRef.current = id;
    updateParams((params) => {
      params.set(OPEN_PARAM, 'details');
      params.set(JOB_PARAM, id);
      params.delete(DETAILS_TAB_PARAM);
    });
  }, [updateParams]);

  const rememberDetailsTab = useCallback((tab: TabId) => {
    updateParams((params) => {
      if (params.get(OPEN_PARAM) !== 'details') return;
      if (tab === 'Info') params.delete(DETAILS_TAB_PARAM);
      else params.set(DETAILS_TAB_PARAM, tab);
    });
  }, [updateParams]);

  return {
    /** Details tab to restore when the modal reopens from the URL. */
    detailsTab,
    rememberOpenDetails,
    rememberDetailsTab,
    /** Call when the details modal closes. */
    forgetOpenDetails: clearDetailsParams,
  };
}
