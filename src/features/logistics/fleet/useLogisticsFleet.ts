import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { fetchLogisticsMatrix, fetchMyTransportAssignments, fetchOwnDriverDetails } from "./fleetApi";

// Prefixed with the table name so the route realtime subscription on
// transport_driver_assignments (app-route-manifest) invalidates them.
export const LOGISTICS_FLEET_QUERY_ROOT = "transport_driver_assignments";

export const logisticsFleetKeys = {
  matrix: (startKey: string, endKey: string) => [LOGISTICS_FLEET_QUERY_ROOT, "logistics-matrix", startKey, endKey] as const,
  mine: (fromKey?: string, toKey?: string) => [LOGISTICS_FLEET_QUERY_ROOT, "mine", fromKey ?? "", toKey ?? ""] as const,
  driverDetails: (profileId: string) => [LOGISTICS_FLEET_QUERY_ROOT, "driver-details", profileId] as const,
};

export function useLogisticsMatrix(startKey: string, endKey: string, enabled = true) {
  return useQuery({
    queryKey: logisticsFleetKeys.matrix(startKey, endKey),
    queryFn: () => fetchLogisticsMatrix(startKey, endKey),
    enabled,
    staleTime: 30_000,
  });
}

export function useMyTransportAssignments(fromKey?: string, toKey?: string) {
  return useQuery({
    queryKey: logisticsFleetKeys.mine(fromKey, toKey),
    queryFn: () => fetchMyTransportAssignments(fromKey, toKey),
    staleTime: 30_000,
  });
}

export function useOwnDriverDetails(profileId: string | null | undefined) {
  return useQuery({
    queryKey: logisticsFleetKeys.driverDetails(profileId ?? ""),
    queryFn: () => fetchOwnDriverDetails(profileId ?? ""),
    enabled: Boolean(profileId),
  });
}

/** Refreshes every fleet/matrix/driver query after a write. */
export function useInvalidateLogisticsFleet() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: [LOGISTICS_FLEET_QUERY_ROOT] }),
    [queryClient],
  );
}
