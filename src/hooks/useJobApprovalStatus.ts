import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobApprovalStatus {
  jobId: string;
  totalTimesheets: number;
  approvedTimesheets: number;
  rejectedTimesheets: number;
  pendingExtras: number;
  rejectedExtras: number;
  blockingReasons: string[];
  canApprove: boolean;
}

export function useJobApprovalStatus(jobId?: string) {
  return useQuery({
    queryKey: ['job-approval-status', jobId],
    enabled: Boolean(jobId),
    queryFn: async (): Promise<JobApprovalStatus> => {
      if (!jobId) {
        return {
          jobId: '',
          totalTimesheets: 0,
          approvedTimesheets: 0,
          rejectedTimesheets: 0,
          pendingExtras: 0,
          rejectedExtras: 0,
          blockingReasons: [],
          canApprove: false,
        };
      }

      const [{ data: timesheets, error: timesheetsError }, { data: extras, error: extrasError }] = await Promise.all([
        supabase
          .from('timesheets')
          .select('status')
          .eq('job_id', jobId),
        supabase
          .from('job_rate_extras')
          .select('status')
          .eq('job_id', jobId),
      ]);

      if (timesheetsError) throw timesheetsError;
      if (extrasError) throw extrasError;

      const totalTimesheets = timesheets?.length ?? 0;
      const approvedTimesheets = timesheets?.filter((row) => String(row.status ?? '').toLowerCase() === 'approved').length ?? 0;
      const rejectedTimesheets = timesheets?.filter((row) => String(row.status ?? '').toLowerCase() === 'rejected').length ?? 0;

      const pendingExtras = extras?.filter((row) => String(row.status ?? '').toLowerCase() === 'pending').length ?? 0;
      const rejectedExtras = extras?.filter((row) => String(row.status ?? '').toLowerCase() === 'rejected').length ?? 0;

      const blockingReasons: string[] = [];
      if (totalTimesheets === 0) {
        blockingReasons.push('No timesheets');
      } else if (rejectedTimesheets > 0) {
        blockingReasons.push('Timesheets rejected');
      } else if (approvedTimesheets < totalTimesheets) {
        blockingReasons.push('Timesheets pending');
      }

      if (pendingExtras > 0) {
        blockingReasons.push('Extras pending');
      }
      if (rejectedExtras > 0) {
        blockingReasons.push('Extras rejected');
      }

      // Remove duplicate reasons if both conditions added same label
      const dedupedBlocking = Array.from(new Set(blockingReasons));

      const canApprove = dedupedBlocking.length === 0 && totalTimesheets > 0;

      return {
        jobId,
        totalTimesheets,
        approvedTimesheets,
        rejectedTimesheets,
        pendingExtras,
        rejectedExtras,
        blockingReasons: dedupedBlocking,
        canApprove,
      };
    },
  });
}
