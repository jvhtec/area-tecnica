import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query";
import {
  UnifiedSubscriptionManager,
  type RealtimeChangePayload,
} from "@/lib/unified-subscription-manager";

type UseHojaDocumentRealtimeOptions = {
  jobId: string;
  enabled: boolean;
  /** A job assignment changed; recompute the staffing drift banner. */
  onStaffingChange: () => void;
  /** A power requirement table changed; recompute the power drift banner. */
  onPowerChange: () => void;
  /** Another writer moved the Hoja to this document version. */
  onRemoteVersion: (version: number) => void;
};

const versionFromPayload = (payload: RealtimeChangePayload): number => {
  const row = payload.new;
  if (!row || typeof row !== "object" || !("document_version" in row)) return 0;
  const value = Number(row.document_version);
  return Number.isFinite(value) ? value : 0;
};

/**
 * Editor realtime listeners, routed through the unified subscription manager so
 * they share the app's leader election, deduplication and reconnect handling.
 * None of them invalidates queries: each only raises a banner the user acts on.
 */
export const useHojaDocumentRealtime = ({
  jobId,
  enabled,
  onStaffingChange,
  onPowerChange,
  onRemoteVersion,
}: UseHojaDocumentRealtimeOptions) => {
  const queryClient = useQueryClient();
  const manager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient],
  );
  const ownerRef = useRef(`hoja-editor-${Math.random().toString(36).slice(2)}`);
  const handlersRef = useRef({ onStaffingChange, onPowerChange, onRemoteVersion });
  handlersRef.current = { onStaffingChange, onPowerChange, onRemoteVersion };

  useEffect(() => {
    if (!jobId || !enabled) return;
    const ownerRoute = ownerRef.current;
    const filter = `job_id=eq.${jobId}`;

    handlersRef.current.onStaffingChange();
    handlersRef.current.onPowerChange();

    manager.subscribeToTable(
      "job_assignments",
      queryKeys.scope("hoja_editor_staffing", jobId),
      { event: "*", schema: "public", filter },
      "medium",
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: () => handlersRef.current.onStaffingChange(),
      },
    );

    manager.subscribeToTable(
      "power_requirement_tables",
      queryKeys.scope("hoja_editor_power", jobId),
      { event: "*", schema: "public", filter },
      "low",
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: () => handlersRef.current.onPowerChange(),
      },
    );

    manager.subscribeToTable(
      "hoja_de_ruta",
      queryKeys.scope("hoja_editor_version", jobId),
      { event: "UPDATE", schema: "public", filter },
      "high",
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: (payload) => {
          const version = versionFromPayload(payload);
          if (version > 0) handlersRef.current.onRemoteVersion(version);
        },
      },
    );

    return () => {
      manager.cleanupRouteDependentSubscriptions(ownerRoute);
    };
  }, [enabled, jobId, manager]);
};
