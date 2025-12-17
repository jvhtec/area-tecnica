import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JobPayoutTotals } from '@/types/jobExtras';

export interface UseJobPayoutTotalsOptions {
  enabled?: boolean;
}

export function useJobPayoutTotals(
  jobId: string,
  technicianId?: string,
  options?: UseJobPayoutTotalsOptions
) {
  return useQuery({
    queryKey: ['job-tech-payout', jobId, technicianId],
    queryFn: async (): Promise<JobPayoutTotals[]> => {
      // 1. Fetch totals from view
      let query = supabase
        .from('v_job_tech_payout_2025')
        .select('*')
        .eq('job_id', jobId);
      
      if (technicianId) {
        query = query.eq('technician_id', technicianId);
      }
      
      const { data: viewData, error: viewError } = await query;
      if (viewError) throw viewError;

      // 2. Fetch approval status from timesheets
      // We want to know if ALL timesheets for a tech on this job are approved.
      // If a tech has NO timesheets, this query won't return them, which defaults to false/undefined.
      // However, usually they have a timesheet if they are in the payout view.
      let approvalsQuery = supabase
        .from('timesheets')
        .select('technician_id, approved_by_manager')
        .eq('job_id', jobId);

      if (technicianId) {
        approvalsQuery = approvalsQuery.eq('technician_id', technicianId);
      }

      const { data: approvalsData, error: approvalsError } = await approvalsQuery;
      if (approvalsError) throw approvalsError;

      // Map technician_id -> boolean (true if all timesheets are approved)
      const approvalMap = new Map<string, boolean>();
      
      // Group by technician
      const techApprovals = new Map<string, boolean[]>();
      (approvalsData || []).forEach(t => {
        if (!t.technician_id) return;
        const current = techApprovals.get(t.technician_id) || [];
        current.push(t.approved_by_manager || false);
        techApprovals.set(t.technician_id, current);
      });

      techApprovals.forEach((statuses, techId) => {
        // Approved if ALL statuses are true (and there is at least one)
        const allApproved = statuses.length > 0 && statuses.every(s => s === true);
        approvalMap.set(techId, allApproved);
      });
      
      return (viewData || []).map((item) => ({
        ...item,
        extras_total_eur: Number(item.extras_total_eur ?? 0),
        expenses_total_eur: Number(item.expenses_total_eur ?? 0),
        total_eur: Number(item.total_eur ?? 0),
        extras_breakdown: (item.extras_breakdown ?? {}) as JobPayoutTotals['extras_breakdown'],
        expenses_breakdown: (item.expenses_breakdown ?? []) as unknown as JobPayoutTotals['expenses_breakdown'],
        payout_approved: approvalMap.get(item.technician_id) ?? false,
      }));
    },
    enabled: (!!jobId) && (options?.enabled ?? true),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useMyJobPayoutTotals() {
  return useQuery({
    queryKey: ['my-job-payout-totals'],
    queryFn: async (): Promise<JobPayoutTotals[]> => {
      const { data, error } = await supabase
        .from('v_job_tech_payout_2025')
        .select('*')
        .order('job_id');
      
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        extras_total_eur: Number(item.extras_total_eur ?? 0),
        expenses_total_eur: Number(item.expenses_total_eur ?? 0),
        total_eur: Number(item.total_eur ?? 0),
        extras_breakdown: (item.extras_breakdown ?? {}) as JobPayoutTotals['extras_breakdown'],
        expenses_breakdown: (item.expenses_breakdown ?? []) as JobPayoutTotals['expenses_breakdown'],
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}