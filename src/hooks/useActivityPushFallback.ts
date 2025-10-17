import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth'

const COVERED_CODES = new Set<string>([
  'job.created',
  'job.updated',
  'document.uploaded',
  'document.deleted',
  'hoja.updated',
  'document.tech_visible.enabled',
  'staffing.availability.sent',
  'staffing.availability.confirmed',
  'staffing.availability.declined',
  'staffing.availability.cancelled',
  'staffing.offer.sent',
  'staffing.offer.confirmed',
  'staffing.offer.declined',
  'staffing.offer.cancelled',
  'job.status.confirmed',
  'job.status.cancelled',
  'flex.tourdate_folder.created',
])

export function useActivityPushFallback() {
  const { userRole } = useOptimizedAuth()
  const enabled = (import.meta.env.VITE_ENABLE_ACTIVITY_PUSH_FALLBACK as any) === 'true'
  const processed = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    // Only run on management/admin to reduce duplicates
    if (!['admin','management'].includes(userRole || '')) return

    const channel = supabase
      .channel('activity-push-fallback')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
        const row: any = payload.new
        if (!row) return
        const id = row.id as string
        const code = row.code as string
        if (!id || !code) return
        if (processed.current.has(id)) return
        processed.current.add(id)

        // Skip codes we already broadcast elsewhere
        if (COVERED_CODES.has(code)) return

        try {
          const payload: any = {
            action: 'broadcast',
            type: code,
            job_id: row.job_id || null,
            actor_name: row.actor_name || undefined,
          };

          // Enrich tourdate events with context
          if (code && code.startsWith('tourdate.')) {
            const p = (row as any).payload || {};
            const tourId = p.tour_id || (p.diff && p.diff.tour_id && (p.diff.tour_id.to || p.diff.tour_id));
            if (tourId) {
              payload.tour_id = tourId;
              payload.url = `/tours/${tourId}`;
            }
            if (p.diff) {
              payload.changes = p.diff;
            }
          }

          await supabase.functions.invoke('push', { body: payload })
        } catch {}
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [enabled, userRole])
}
