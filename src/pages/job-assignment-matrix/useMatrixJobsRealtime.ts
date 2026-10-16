import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { queryKeys } from "@/lib/react-query";

// The matrix job columns come from `optimized-matrix-jobs` (jobs + their
// departments and date types). Nothing listened for those tables here, so a
// job created elsewhere only appeared after a reload.
const MATRIX_JOB_TABLES = [
  { table: "jobs", priority: "high" as const },
  { table: "job_departments", priority: "medium" as const },
  { table: "job_date_types", priority: "low" as const },
];

export function useMatrixJobsRealtime() {
  const queryClient = useQueryClient();
  const manager = useMemo(() => UnifiedSubscriptionManager.getInstance(queryClient), [queryClient]);
  const ownerRef = useRef(`matrix-jobs-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const owner = ownerRef.current;
    for (const { table, priority } of MATRIX_JOB_TABLES) {
      // The manager prefix-invalidates the key and coalesces bursts on the
      // leading edge, so every cached date window refetches once.
      manager.subscribeToTable(
        table,
        queryKeys.scope("optimized-matrix-jobs"),
        { event: "*", schema: "public" },
        priority,
        { ownerRoute: owner },
      );
    }
    return () => manager.cleanupRouteDependentSubscriptions(owner);
  }, [manager]);
}
