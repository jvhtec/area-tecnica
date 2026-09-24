import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { fetchJobProducerContacts, type JobProducerContact } from "@/features/jobs/producer-claims/producerClaims";

import { fetchLogisticsMatrix, fetchMyTransportAssignments, fetchOwnDriverDetails, fetchStaticMap, type StaticMapInput } from "./fleetApi";
import { summarizeDriversByEvent, type EventDriverSummary } from "./fleetModel";

// Shared aggregate key. Route realtime subscriptions for assignments, events,
// fleet, licences and their upstream labels all invalidate this root.
export const LOGISTICS_FLEET_QUERY_ROOT = "transport_driver_assignments";

export const logisticsFleetKeys = {
  matrix: (startKey: string, endKey: string) => [LOGISTICS_FLEET_QUERY_ROOT, "logistics-matrix", startKey, endKey] as const,
  mine: (fromKey?: string, toKey?: string) => [LOGISTICS_FLEET_QUERY_ROOT, "mine", fromKey ?? "", toKey ?? ""] as const,
  driverDetails: (profileId: string) => [LOGISTICS_FLEET_QUERY_ROOT, "driver-details", profileId] as const,
  producerContacts: (jobIds: readonly string[]) => [LOGISTICS_FLEET_QUERY_ROOT, "producer-contacts", ...jobIds] as const,
  // Deliberately outside the fleet root: a map tile never changes with an assignment.
  staticMap: (input: StaticMapInput) => ["static-map", input.lat ?? "", input.lng ?? "", input.address ?? ""] as const,
};

export function useLogisticsMatrix(startKey: string, endKey: string, enabled = true) {
  return useQuery({
    queryKey: logisticsFleetKeys.matrix(startKey, endKey),
    queryFn: () => fetchLogisticsMatrix(startKey, endKey),
    enabled,
    staleTime: 30_000,
  });
}

const NO_SUMMARIES: ReadonlyMap<string, EventDriverSummary[]> = new Map();

/**
 * Who is driving each transport in a date range, for the logistics calendar and
 * the day panel. Shares the matrix query, so the calendar and the Conductores tab
 * never fetch the same range twice. Read-only viewers get it too (same RPC).
 */
export function useEventDriverSummaries(startKey: string, endKey: string, enabled = true) {
  const { data } = useLogisticsMatrix(startKey, endKey, enabled);
  return useMemo(() => (data ? summarizeDriversByEvent(data) : NO_SUMMARIES), [data]);
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

const NO_CONTACTS: ReadonlyMap<string, JobProducerContact[]> = new Map();

/**
 * Responsables de producción for the jobs behind a driver's transports, keyed
 * by job id. The RPC releases rows only for jobs the driver holds a live
 * assignment on; an empty result is a normal denial, not an error.
 */
export function useTransportProducerContacts(jobIds: readonly string[]) {
  const sorted = useMemo(() => [...new Set(jobIds)].sort(), [jobIds]);
  const query = useQuery({
    queryKey: logisticsFleetKeys.producerContacts(sorted),
    queryFn: () => fetchJobProducerContacts(sorted),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    if (!query.data) return NO_CONTACTS;
    const byJob = new Map<string, JobProducerContact[]>();
    for (const contact of query.data) byJob.set(contact.job_id, [...(byJob.get(contact.job_id) ?? []), contact]);
    return byJob;
  }, [query.data]);
}

/** Static map preview for a venue. Cached for the session; a failure just hides the map. */
export function useStaticMap(input: StaticMapInput, enabled = true) {
  const hasTarget = (input.lat !== null && input.lng !== null) || Boolean(input.address);
  return useQuery({
    queryKey: logisticsFleetKeys.staticMap(input),
    queryFn: () => fetchStaticMap(input),
    enabled: enabled && hasTarget,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
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
