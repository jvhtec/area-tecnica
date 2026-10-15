import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildProducerOptions,
  collectProducerNames,
  matchesProducerFilter,
  type ProducerFilterJob,
} from "./producerFilter";

const storageKey = (userId: string) => `project-management:producer-filter:${userId}`;

const readStored = (userId: string): string[] => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

const writeStored = (userId: string, ids: string[]) => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode, blocked): the filter still works for this visit.
  }
};

/**
 * "Responsable de producción" filter for Project Management. The selection is
 * remembered per user on this device, so a producer who filters to their own
 * jobs keeps that view between visits.
 */
export const useProducerFilter = (monthJobs: ProducerFilterJob[], userId: string | null | undefined) => {
  const [selectedProducerIds, setSelectedProducerIds] = useState<string[]>([]);
  const knownNames = useRef(new Map<string, string>());

  useEffect(() => {
    setSelectedProducerIds(userId ? readStored(userId) : []);
  }, [userId]);

  const update = useCallback((next: string[]) => {
    setSelectedProducerIds(next);
    if (userId) writeStored(userId, next);
  }, [userId]);

  const toggleProducer = useCallback((producerId: string) => {
    update(
      selectedProducerIds.includes(producerId)
        ? selectedProducerIds.filter((id) => id !== producerId)
        : [...selectedProducerIds, producerId],
    );
  }, [selectedProducerIds, update]);

  const clearProducers = useCallback(() => update([]), [update]);

  const producerOptions = useMemo(
    () => buildProducerOptions(
      monthJobs,
      userId,
      selectedProducerIds,
      collectProducerNames(monthJobs, knownNames.current),
    ),
    [monthJobs, userId, selectedProducerIds],
  );

  const filterByProducer = useCallback(
    <Job extends ProducerFilterJob>(jobs: Job[]) =>
      jobs.filter((job) => matchesProducerFilter(job, selectedProducerIds)),
    [selectedProducerIds],
  );

  return { selectedProducerIds, producerOptions, toggleProducer, clearProducers, filterByProducer };
};
