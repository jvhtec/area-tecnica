import type { LogisticsEventLocation } from "@/features/logistics/events/useLogisticsEventLocation";
import { dataLayerClient } from "@/services/dataLayerClient";

type JobOption = {
  id: string;
  title: string;
  location_id: string | null;
};

type PlaceField = Pick<LogisticsEventLocation, "input" | "resolve">;

export type ResolvedTransportPlaces =
  | {
      ok: true;
      locationId: string | null;
      originId: string | null;
      effectiveDestinationId: string | null;
      jobTitle: string | null;
    }
  | { ok: false; message: string };

/**
 * Resolve autocomplete selections into stored location ids and, for crew
 * transfers, resolve the job venue fallback used as the effective destination.
 * Typed-but-unselected autocomplete text is rejected instead of silently
 * becoming null or falling back to a different place.
 */
export async function resolveTransportPlaces(input: {
  isCrewTransfer: boolean;
  selectedJob: string | null;
  jobs: readonly JobOption[] | null | undefined;
  location: PlaceField;
  origin: PlaceField;
}): Promise<ResolvedTransportPlaces> {
  const locationId = await input.location.resolve();
  const originId = input.isCrewTransfer ? await input.origin.resolve() : null;

  if (input.location.input.trim() && !locationId) {
    return { ok: false, message: "Selecciona el destino de la lista para guardar una ubicación válida." };
  }
  if (input.isCrewTransfer && input.origin.input.trim() && !originId) {
    return { ok: false, message: "Selecciona el punto de encuentro de la lista para guardar una ubicación válida." };
  }

  const listedJob = input.jobs?.find((candidate) => candidate.id === input.selectedJob);
  let jobLocationId = listedJob?.location_id ?? null;
  let jobTitle = listedJob?.title ?? null;

  if (input.isCrewTransfer && input.selectedJob && ((!locationId && !jobLocationId) || !jobTitle)) {
    const { data, error } = await dataLayerClient
      .from("jobs")
      .select("location_id, title")
      .eq("id", input.selectedJob)
      .maybeSingle();
    if (error) throw error;
    jobLocationId = jobLocationId ?? data?.location_id ?? null;
    jobTitle = jobTitle ?? data?.title ?? null;
  }

  const effectiveDestinationId = locationId ?? jobLocationId;
  if (input.isCrewTransfer && !effectiveDestinationId) {
    return { ok: false, message: "El traslado necesita un destino o un trabajo con recinto." };
  }
  if (input.isCrewTransfer && originId === effectiveDestinationId) {
    return { ok: false, message: "El origen y el destino no pueden ser el mismo lugar." };
  }

  return {
    ok: true,
    locationId,
    originId,
    effectiveDestinationId,
    jobTitle,
  };
}
