import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import type { SubscriptionPriority } from "@/lib/unified-subscription-support";
import { queryKeys } from "@/lib/react-query";

type MatrixRealtimeSource = { table: string; scope: string; priority: SubscriptionPriority };

// Page-level matrix data that only needs a refetch on change. Cell data
// (assignments, timesheets, availability) is patched in place by
// useOptimizedMatrixData and stays there.
const MATRIX_REALTIME_SOURCES: MatrixRealtimeSource[] = [
  // Job columns: a job created or edited elsewhere appears without a reload.
  { table: "jobs", scope: "optimized-matrix-jobs", priority: "high" },
  { table: "job_departments", scope: "optimized-matrix-jobs", priority: "medium" },
  { table: "job_date_types", scope: "optimized-matrix-jobs", priority: "low" },
  // Required personnel: open-slot header badges and the staffing reminder.
  { table: "job_required_roles", scope: "matrix-open-slots", priority: "medium" },
  { table: "job_required_roles", scope: "matrix-staffing-summary", priority: "medium" },
  { table: "job_assignments", scope: "matrix-staffing-summary", priority: "low" },
  // Technician rows and fridge state.
  { table: "profiles", scope: "optimized-matrix-technicians", priority: "low" },
  { table: "profile_skills", scope: "optimized-matrix-technicians", priority: "low" },
  { table: "skills", scope: "optimized-matrix-technicians", priority: "low" },
  // Skill catalog behind the skills filter (shared with settings).
  { table: "skills", scope: "skill_catalog", priority: "low" },
  { table: "profiles", scope: "technician-fridge-status", priority: "low" },
  { table: "technician_fridge", scope: "technician-fridge-status", priority: "medium" },
];

export function useMatrixJobsRealtime() {
  const queryClient = useQueryClient();
  const manager = useMemo(() => UnifiedSubscriptionManager.getInstance(queryClient), [queryClient]);
  const ownerRef = useRef(`matrix-realtime-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const owner = ownerRef.current;
    for (const { table, scope, priority } of MATRIX_REALTIME_SOURCES) {
      // The manager prefix-invalidates the key (every cached window or job set)
      // and coalesces bursts on the leading edge.
      manager.subscribeToTable(
        table,
        queryKeys.scope(scope),
        { event: "*", schema: "public" },
        priority,
        { ownerRoute: owner },
      );
    }
    return () => manager.cleanupRouteDependentSubscriptions(owner);
  }, [manager]);
}
