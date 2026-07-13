import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { queryKeys } from '@/lib/react-query';

export type TransportRequestSummary = {
  id: string;
  department?: string;
  status: string;
  note: string | null;
  description: string | null;
  created_by?: string | null;
  created_at: string;
  is_hoja_relevant: boolean;
  items: { id: string; transport_type: string; leftover_space_meters: number | null }[];
};

const REQUEST_SELECT =
  'id, department, status, note, description, created_by, created_at, is_hoja_relevant, items:transport_request_items(id, transport_type, leftover_space_meters)';

const TECH_DEPARTMENTS = ['sound', 'lights', 'video'];

/**
 * Active transport requests for a job. A department can have several
 * concurrent requests per job, so consumers always receive lists.
 */
export function useJobTransportRequests(
  jobId: string | undefined,
  currentUserDepartment: string | null,
  canManageTransportRequests: boolean,
) {
  const queryClient = useQueryClient();

  const { data: myTransportRequests = [] } = useQuery({
    queryKey: queryKeys.scope('transport-request', jobId, currentUserDepartment),
    queryFn: async () => {
      if (!currentUserDepartment || !TECH_DEPARTMENTS.includes(currentUserDepartment)) return [];
      const { data, error } = await dataLayerClient.from('transport_requests')
        .select(REQUEST_SELECT)
        .eq('job_id', jobId!)
        .eq('department', currentUserDepartment)
        .eq('status', 'requested')
        .order('created_at', { ascending: true });
      if (error) return [];
      return (data || []) as unknown as TransportRequestSummary[];
    },
    enabled: !!jobId && !!currentUserDepartment,
  });

  const { data: allRequests = [], isLoading: isAllRequestsLoading } = useQuery({
    queryKey: queryKeys.scope('transport-requests-all', jobId),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('transport_requests')
        .select(REQUEST_SELECT)
        .eq('job_id', jobId!)
        .eq('status', 'requested')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []) as unknown as TransportRequestSummary[];
    },
    enabled: !!jobId && canManageTransportRequests,
  });

  // Auto-fulfill a request once it has both a load and an unload event linked
  // to it (logistics_events.transport_request_id), so fulfilling one request
  // never closes another request from the same department by accident.
  const checkAndFulfillRequest = useCallback(
    async (requestId: string, departmentForReq: string) => {
      try {
        const { data: events } = await dataLayerClient.from('logistics_events')
          .select('id, event_type')
          .eq('transport_request_id' as never, requestId);
        const logisticsEvents = (events || []) as { id: string; event_type: string }[];
        const hasLoad = logisticsEvents.some((e) => e.event_type === 'load');
        const hasUnload = logisticsEvents.some((e) => e.event_type === 'unload');
        if (hasLoad && hasUnload) {
          await dataLayerClient.from('transport_requests').update({ status: 'fulfilled' }).eq('id', requestId);
          queryClient.invalidateQueries({ queryKey: queryKeys.scope('transport-request', jobId, departmentForReq) });
          queryClient.invalidateQueries({ queryKey: queryKeys.scope('transport-requests-all', jobId) });
        }
      } catch (err) {
        console.error('checkAndFulfillRequest failed', err);
      }
    },
    [jobId, queryClient],
  );

  const cancelRequest = useCallback(
    async (requestId: string): Promise<{ error: string | null }> => {
      const { error } = await dataLayerClient.from('transport_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) return { error: error.message };
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('transport-requests-all', jobId) });
      return { error: null };
    },
    [jobId, queryClient],
  );

  return { myTransportRequests, allRequests, isAllRequestsLoading, checkAndFulfillRequest, cancelRequest };
}
