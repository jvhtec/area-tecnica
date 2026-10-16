import { useEffect, useMemo, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  UnifiedSubscriptionManager,
  type RealtimeChangePayload,
} from "@/lib/unified-subscription-manager";
import { queryKeys } from "@/lib/react-query";
import { throttle, type ThrottledFunction } from "@/utils/throttle";

/**
 * One realtime source for scoped queries (one per job card, say).
 *
 * `keys(scopeId)` returns the query keys to refresh for the changed row's
 * scope (its job, usually). When a change carries no scope id (a DELETE
 * without REPLICA IDENTITY FULL, or a table keyed by something else)
 * `keys(null)` is used, so return prefix keys there.
 */
export type JobScopedRealtimeSource = {
  table: string;
  keys: (scopeId: string | null) => QueryKey[];
  /** Column holding the scope id; defaults to `job_id`. Use `null` for tables without one. */
  scopeColumn?: string | null;
};

// One change usually comes with siblings (a folder tree, a task list): the
// first refreshes at once, the rest of the burst adds one trailing refresh.
const REFRESH_WINDOW_MS = 300;

/**
 * The scope ids a change touches: the new row's and, when the old row carries
 * it (DELETE, or REPLICA IDENTITY FULL), the old row's too, so a row moved
 * from one job to another refreshes both cards.
 */
export function scopeIdsFromPayload(payload: RealtimeChangePayload, column: string | null): string[] {
  if (!column) return [];
  const ids = new Set<string>();
  for (const row of [payload.new, payload.old]) {
    const value = row?.[column];
    if (typeof value === "string" && value) ids.add(value);
  }
  return Array.from(ids);
}

/**
 * Keeps job-scoped queries (one per job card, say) fresh from realtime, going
 * through the unified subscription manager. Each change refreshes only the
 * affected scope's keys, throttled per key on the leading edge.
 */
export function useJobScopedRealtime(name: string, sources: JobScopedRealtimeSource[], enabled = true) {
  const queryClient = useQueryClient();
  const manager = useMemo(() => UnifiedSubscriptionManager.getInstance(queryClient), [queryClient]);
  const ownerRef = useRef(`${name}-${Math.random().toString(36).slice(2)}`);
  // The caller passes a literal list; subscribe once per name.
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    if (!enabled) return;
    const owner = ownerRef.current;
    const throttles = new Map<string, ThrottledFunction<() => void>>();

    const refresh = (queryKey: QueryKey) => {
      const id = JSON.stringify(queryKey);
      let run = throttles.get(id);
      if (!run) {
        run = throttle(() => {
          void queryClient.invalidateQueries({ queryKey });
        }, REFRESH_WINDOW_MS);
        throttles.set(id, run);
      }
      run();
    };

    for (const source of sourcesRef.current) {
      const column = source.scopeColumn === undefined ? "job_id" : source.scopeColumn;
      manager.subscribeToTable(
        source.table,
        queryKeys.scope("job-scoped-realtime", name, source.table),
        { event: "*", schema: "public" },
        "low",
        {
          ownerRoute: owner,
          invalidateOnPayload: false,
          onPayload: (payload) => {
            const ids = scopeIdsFromPayload(payload, column);
            const keys = ids.length ? ids.flatMap((id) => source.keys(id)) : source.keys(null);
            keys.forEach(refresh);
          },
        },
      );
    }

    return () => {
      throttles.forEach((run) => run.cancel());
      manager.cleanupRouteDependentSubscriptions(owner);
    };
  }, [enabled, manager, name, queryClient]);
}
