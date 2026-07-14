import { supabase } from "@/integrations/supabase/client";
import {
  syncTourDefaultDocuments,
  type SyncTourDefaultDocumentsResult,
} from "@/utils/tourDefaultDocumentSync";

type SupabaseClientLike = typeof supabase;

export const resolveTourIdForTourDate = async (
  tourDateId: string,
  client: SupabaseClientLike = supabase
): Promise<string | null> => {
  const { data, error } = await client
    .from("tour_dates")
    .select("tour_id")
    .eq("id", tourDateId)
    .maybeSingle();

  if (error) throw error;
  return data?.tour_id ?? null;
};

export interface SyncTourDefaultDocumentsForTourDateOutcome {
  tourId: string;
  result: SyncTourDefaultDocumentsResult;
}

/**
 * Regenerate the auto-generated default power/weight PDFs for a single tour
 * date. Used after mutations that only know the tour date (e.g. per-date
 * override edits) — the stored per-date PDFs embed override data, so they go
 * stale the moment an override changes unless this runs.
 */
export const syncTourDefaultDocumentsForTourDate = async ({
  tourDateId,
  client = supabase,
}: {
  tourDateId: string;
  client?: SupabaseClientLike;
}): Promise<SyncTourDefaultDocumentsForTourDateOutcome | null> => {
  const tourId = await resolveTourIdForTourDate(tourDateId, client);
  if (!tourId) return null;

  const result = await syncTourDefaultDocuments({
    tourId,
    tourDateIds: [tourDateId],
    client,
  });
  return { tourId, result };
};

// Override edits often arrive in quick bursts (a mirrored pesos cluster saves
// two overrides back-to-back); coalesce them so the per-date PDFs regenerate
// once with the final state instead of once per mutation.
const pendingTourDateDocumentSyncs = new Map<string, ReturnType<typeof setTimeout>>();

// A sync rewrites the date's tour_documents slots (cleanup then upload), so
// two overlapping runs for the same date could clobber each other; each run
// is chained on the previous one for that date.
const inFlightTourDateDocumentSyncs = new Map<string, Promise<void>>();

export const scheduleTourDateDefaultDocumentSync = ({
  tourDateId,
  client = supabase,
  delayMs = 800,
  onComplete,
  onError,
}: {
  tourDateId: string;
  client?: SupabaseClientLike;
  delayMs?: number;
  onComplete?: (outcome: SyncTourDefaultDocumentsForTourDateOutcome) => void;
  onError?: (error: unknown) => void;
}): void => {
  const pending = pendingTourDateDocumentSyncs.get(tourDateId);
  if (pending) clearTimeout(pending);

  const timer = setTimeout(() => {
    pendingTourDateDocumentSyncs.delete(tourDateId);
    const previous = inFlightTourDateDocumentSyncs.get(tourDateId) ?? Promise.resolve();
    const run = previous
      .then(() => syncTourDefaultDocumentsForTourDate({ tourDateId, client }))
      .then((outcome) => {
        if (outcome) onComplete?.(outcome);
      })
      .catch((error) => {
        console.error("Error syncing tour default documents for tour date:", error);
        onError?.(error);
      });
    inFlightTourDateDocumentSyncs.set(tourDateId, run);
    void run.finally(() => {
      if (inFlightTourDateDocumentSyncs.get(tourDateId) === run) {
        inFlightTourDateDocumentSyncs.delete(tourDateId);
      }
    });
  }, delayMs);

  pendingTourDateDocumentSyncs.set(tourDateId, timer);
};
