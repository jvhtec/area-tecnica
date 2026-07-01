import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { useToast } from '@/hooks/use-toast';
import type { ActivityCatalogEntry, ActivityLogEntry, ActivityPreferences, ActivitySeverity } from '../types';
import { getActivityMeta } from '../catalog';
import { getActivityPreferences } from '../api';


import { queryKeys } from "@/lib/react-query";
interface UseActivityRealtimeOptions {
  jobId?: string;
  userId?: string;
  autoToasts?: boolean;
}

type ToastContent = {
  title: string;
  description?: string;
};

const severityToVariant: Record<ActivitySeverity, 'default' | 'destructive' | 'success' | 'warning' | 'info'> = {
  info: 'info',
  success: 'success',
  warn: 'warning',
  error: 'destructive',
};

function mapToast(row: ActivityLogEntry, meta?: ActivityCatalogEntry): ToastContent | null {
  const payload = (row.payload ?? {}) as Record<string, unknown>;

  switch (row.code) {
    case 'job.created':
      return { title: meta?.label ?? 'Job created', description: String(payload.title ?? '') || undefined };
    case 'job.updated':
      return {
        title: meta?.label ?? 'Job updated',
        description: payload.diff ? Object.keys(payload.diff as Record<string, unknown>).join(', ') : undefined,
      };
    case 'document.uploaded':
      return { title: meta?.label ?? 'Document uploaded', description: String(payload.file_name ?? '') || undefined };
    case 'document.deleted':
      return { title: meta?.label ?? 'Document deleted', description: String(payload.file_name ?? '') || undefined };
    case 'flex.folders.created':
      return { title: meta?.label ?? 'Flex folders created', description: String(payload.folder ?? '') || undefined };
    case 'flex.crew.updated':
      return { title: meta?.label ?? 'Flex crew updated', description: undefined };
    case 'assignment.created':
      return { title: meta?.label ?? 'Assignment created' };
    case 'assignment.updated':
      return { title: meta?.label ?? 'Assignment updated' };
    case 'assignment.removed':
      return { title: meta?.label ?? 'Assignment removed' };
    case 'staffing.offer.confirmed':
      return { title: meta?.label ?? 'Offer accepted' };
    case 'staffing.offer.declined':
      return { title: meta?.label ?? 'Offer declined' };
    case 'staffing.availability.confirmed':
      return { title: meta?.label ?? 'Availability confirmed' };
    case 'staffing.availability.declined':
      return { title: meta?.label ?? 'Availability declined' };
    case 'timesheet.submitted':
      return { title: meta?.label ?? 'Timesheet submitted' };
    case 'timesheet.approved':
      return { title: meta?.label ?? 'Timesheet approved' };
    case 'timesheet.rejected':
      return { title: meta?.label ?? 'Timesheet rejected' };
    case 'hoja.updated':
      return { title: meta?.label ?? 'Hoja de ruta updated' };
    case 'announcement.posted':
      return {
        title: meta?.label ?? 'Announcement posted',
        description: String(payload.title ?? payload.message ?? '') || undefined,
      };
    default:
      if (!meta) {
        return { title: row.code.replace(/\./g, ' ') };
      }
      return { title: meta.label };
  }
}

async function ensurePreferencesCached(
  prefsRef: MutableRefObject<ActivityPreferences | null>,
  fetcher: () => Promise<ActivityPreferences | null>
) {
  if (!prefsRef.current) {
    prefsRef.current = await fetcher();
  }
  return prefsRef.current;
}

export function useActivityRealtime(options: UseActivityRealtimeOptions = {}): void {
  const { jobId, userId, autoToasts = true } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  const prefsRef = useRef<ActivityPreferences | null>(null);
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  );
  const ownerIdRef = useRef(`activity-realtime-${Math.random().toString(36).slice(2)}`);

  const fetchPrefs = useCallback(async () => {
    if (!userId) return null;
    const prefs = await getActivityPreferences(userId);
    prefsRef.current = prefs;
    return prefs;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const ownerRoute = ownerIdRef.current;

    fetchPrefs().catch((error) => {
      console.warn('[activity] Failed to load activity preferences', error);
    });

    const filter = jobId
      ? { event: 'INSERT' as const, schema: 'public', filter: `job_id=eq.${jobId}` }
      : { event: 'INSERT' as const, schema: 'public' };

    subscriptionManager.subscribeToTable(
      'activity_log',
      queryKeys.scope('activity', jobId ?? 'all'),
      filter,
      'medium',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: async (payload) => {
          if (cancelled) return;

          const row = payload.new as unknown as ActivityLogEntry | null;
          if (!row || !row.id) return;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);

          queryClient.invalidateQueries({ queryKey: queryKeys.scope('activity', jobId ?? 'all') });

          if (!autoToasts) return;

          const meta = getActivityMeta(row.code);
          if (meta && meta.toast_enabled === false) {
            return;
          }

          const prefs = await ensurePreferencesCached(prefsRef, fetchPrefs);
          if (cancelled) return;
          if (prefs?.mute_toasts) return;
          if (prefs?.muted_codes && prefs.muted_codes.includes(row.code)) return;

          const content = mapToast(row, meta);
          if (!content) return;

          const variant = severityToVariant[meta?.severity ?? 'info'];
          toast({
            title: content.title,
            description: content.description,
            variant,
          });
        },
      }
    );

    return () => {
      cancelled = true;
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute);
    };
  }, [autoToasts, fetchPrefs, jobId, queryClient, toast, userId, subscriptionManager]);
}
